package com.margelo.nitro.nitromaps

/**
 * Splits the marker pipeline's output between the SDK and live `MarkerView` hosts. Live elements
 * are taken out of every diff before it reaches the SDK, and JS hears which live hosts to mount
 * whenever that set changes.
 *
 * `MarkerViewRenderRegistry.swift` is the iOS counterpart; change the two together.
 */
internal class MarkerViewRenderRegistry {
  /** Whether clusters are live hosts (`renderCluster`) rather than SDK badges. */
  var customClusters = false
    private set

  var onChange: ((NativeMarkerViewRenderState) -> Unit)? = null
    set(value) {
      field = value
      publish()
    }

  private val entries = HashMap<String, ClusterElement>()

  /** Whether any live element is displayed, so the synchronous SDK path cannot be used as is. */
  val hasEntries: Boolean
    get() = entries.isNotEmpty()

  /** [sdkVersions] plus the live elements, which count as displayed too: the pipeline diffs against both. */
  fun displayedVersions(sdkVersions: Map<String, Long>): Map<String, Long> {
    if (entries.isEmpty()) {
      return sdkVersions
    }
    val versions = HashMap(sdkVersions)
    entries.forEach { (key, element) -> versions[key] = element.renderVersion }
    return versions
  }

  /** Returns whether the setting changed; the caller then redraws every marker. */
  fun setCustomClusters(enabled: Boolean): Boolean {
    if (customClusters == enabled) {
      return false
    }
    customClusters = enabled
    return true
  }

  fun reset() {
    if (entries.isEmpty()) {
      return
    }
    entries.clear()
    publish()
  }

  /** Takes the live elements out of [diff] and returns what the SDK still has to do. */
  fun consume(diff: MarkerRenderDiff): MarkerRenderDiff {
    val removed = HashSet(diff.removedKeys)
    val added = ArrayList<ClusterElement>()
    val retained = ArrayList<ClusterElement>()
    var changed = false

    for (key in diff.removedKeys) {
      if (entries.remove(key) != null) changed = true
    }

    fun route(
      element: ClusterElement,
      isNew: Boolean,
    ) {
      val key = element.diffKey
      when {
        isLive(element) -> {
          val previous = entries.put(key, element)
          if (previous == null) {
            // Retained but not live until now: the SDK drew it, so it goes.
            if (!isNew) removed.add(key)
            changed = true
          } else if (element is ClusterElement.Cluster) {
            // A cluster's position, count and members come from here; a live marker's own props
            // come from JS, which need not hear about them.
            changed = true
          }
        }

        entries.remove(key) != null -> {
          // Live until now, so the SDK has nothing to update: it adds it.
          added.add(element)
          changed = true
        }

        isNew -> {
          added.add(element)
        }

        else -> {
          retained.add(element)
        }
      }
    }

    diff.added.forEach { route(it, isNew = true) }
    diff.retained.forEach { route(it, isNew = false) }

    if (changed) publish()
    return MarkerRenderDiff(removed, added, retained)
  }

  private fun isLive(element: ClusterElement): Boolean =
    when (element) {
      is ClusterElement.Single -> element.descriptor.liveView == true
      is ClusterElement.Cluster -> customClusters
    }

  private fun publish() {
    val callback = onChange ?: return
    val markerIds = ArrayList<String>()
    val clusters = ArrayList<NativeMarkerViewCluster>()
    for (key in entries.keys.sorted()) {
      when (val element = entries[key]) {
        is ClusterElement.Single -> {
          markerIds.add(element.descriptor.id)
        }

        is ClusterElement.Cluster -> {
          clusters.add(
            NativeMarkerViewCluster(
              key,
              Coordinate(element.position.latitude, element.position.longitude),
              element.memberIds.sorted().toTypedArray(),
            ),
          )
        }

        null -> {
          Unit
        }
      }
    }
    callback(NativeMarkerViewRenderState(markerIds.toTypedArray(), clusters.toTypedArray()))
  }
}

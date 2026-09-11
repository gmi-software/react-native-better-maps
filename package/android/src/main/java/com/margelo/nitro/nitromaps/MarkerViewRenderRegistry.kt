package com.margelo.nitro.nitromaps

/** Splits the native cluster display set between SDK objects and Fabric hosts. */
internal class MarkerViewRenderRegistry {
  var customClusters = false
  var onChange: ((NativeMarkerViewRenderState) -> Unit)? = null
    set(value) {
      field = value
      publish()
    }
  private val entries = HashMap<String, ClusterElement>()
  val versions: Map<String, Long> get() = entries.mapValues { it.value.renderVersion }

  fun reset() {
    if (entries.isEmpty()) return
    entries.clear()
    publish()
  }

  fun consume(diff: MarkerRenderDiff): MarkerRenderDiff {
    val removed = diff.removedKeys.toMutableSet()
    val added = ArrayList<ClusterElement>()
    val retained = ArrayList<ClusterElement>()
    var changed = false
    for (key in diff.removedKeys) {
      if (entries.remove(key) != null) changed = true
    }
    fun consumeEntry(element: ClusterElement, isNew: Boolean) {
      val live = when (element) {
        is ClusterElement.Single -> element.descriptor.customViewId != null
        is ClusterElement.Cluster -> customClusters
      }
      if (live) {
        entries[element.diffKey] = element
        removed.add(element.diffKey)
        changed = true
      } else if (entries.remove(element.diffKey) != null) {
        added.add(element)
        changed = true
      } else if (isNew) {
        added.add(element)
      } else {
        retained.add(element)
      }
    }
    diff.added.forEach { consumeEntry(it, true) }
    diff.retained.forEach { consumeEntry(it, false) }
    if (changed) publish()
    return MarkerRenderDiff(removed, added, retained)
  }

  private fun publish() {
    val callback = onChange ?: return
    val ids = ArrayList<String>()
    val clusters = ArrayList<NativeMarkerViewCluster>()
    for (key in entries.keys.sorted()) {
      when (val element = entries[key]) {
        is ClusterElement.Single -> element.descriptor.customViewId?.let { ids.add(it) }
        is ClusterElement.Cluster -> {
          val sw = element.bounds.southwest
          val ne = element.bounds.northeast
          val longitudeSpan = (ne.longitude - sw.longitude + 360.0) % 360.0
          val longitude = ((sw.longitude + longitudeSpan / 2 + 540.0) % 360.0) - 180.0
          clusters.add(NativeMarkerViewCluster(
            key,
            Coordinate(element.position.latitude, element.position.longitude),
            element.memberIds.sorted().toTypedArray(),
            Region((sw.latitude + ne.latitude) / 2, longitude,
              (ne.latitude - sw.latitude).coerceAtLeast(0.0001), longitudeSpan.coerceAtLeast(0.0001)),
          ))
        }
        null -> Unit
      }
    }
    callback(NativeMarkerViewRenderState(ids.toTypedArray(), clusters.toTypedArray()))
  }
}

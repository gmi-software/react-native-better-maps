package com.margelo.nitro.nitromaps

internal data class MarkerRenderDiff(
  val removedKeys: Set<String>,
  val added: List<ClusterElement>,
  val retained: List<ClusterElement>,
)

internal fun computeMarkerRenderDiff(
  target: List<ClusterElement>,
  displayed: Map<String, Long>,
): MarkerRenderDiff {
  val nextKeys = HashSet<String>(target.size)
  val added = ArrayList<ClusterElement>()
  val retained = ArrayList<ClusterElement>()

  for (element in target) {
    val key = element.diffKey
    if (!nextKeys.add(key)) {
      continue
    }
    val displayedVersion = displayed[key]
    if (displayedVersion == null) {
      added.add(element)
    } else if (displayedVersion != element.renderVersion) {
      retained.add(element)
    }
  }

  return MarkerRenderDiff(
    removedKeys = displayed.keys - nextKeys,
    added = added,
    retained = retained,
  )
}

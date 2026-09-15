package com.margelo.nitro.nitromaps

internal data class MarkerRenderDiff(
  val removedKeys: Set<MarkerRenderKey>,
  val added: List<ClusterElement>,
  val retained: List<ClusterElement>,
  /**
   * Clusters still on screen whose pin did not change. Membership can change
   * without bumping [ClusterElement.Cluster.renderVersion], so these need a
   * membership refresh even when the marker itself is left alone.
   */
  val activeClusters: List<ClusterElement.Cluster> = emptyList(),
)

internal fun computeMarkerRenderDiff(
  target: List<ClusterElement>,
  displayed: Map<MarkerRenderKey, Long>,
): MarkerRenderDiff {
  val nextKeys = HashSet<MarkerRenderKey>(target.size)
  val added = ArrayList<ClusterElement>()
  val retained = ArrayList<ClusterElement>()
  val activeClusters = ArrayList<ClusterElement.Cluster>()

  for (element in target) {
    val key = element.key
    if (!nextKeys.add(key)) {
      continue
    }
    val displayedVersion = displayed[key]
    if (displayedVersion == null) {
      added.add(element)
    } else if (displayedVersion != element.renderVersion) {
      retained.add(element)
    } else if (element is ClusterElement.Cluster) {
      activeClusters.add(element)
    }
  }

  return MarkerRenderDiff(
    removedKeys = displayed.keys - nextKeys,
    added = added,
    retained = retained,
    activeClusters = activeClusters,
  )
}

package com.margelo.nitro.nitromaps

/** Shared cluster badge sizing used by merge tests and drawn icons. */
internal object ClusterBadgeMetrics {
  const val MERGE_GAP_DP = 6.0

  fun badgeRadiusDp(count: Int): Double =
    when {
      count < 2 -> 14.0
      count < 10 -> 17.0
      count < 100 -> 20.0
      count < 1000 -> 24.0
      else -> 28.0
    }

  fun diameterDp(count: Int): Float =
    when {
      count < 10 -> 34f
      count < 100 -> 40f
      count < 1000 -> 48f
      else -> 56f
    }
}

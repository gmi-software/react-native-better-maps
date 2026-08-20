package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import kotlin.math.floor
import kotlin.math.log2
import kotlin.math.pow
import kotlin.math.roundToInt

/** A single display element: an individual marker or a cluster badge. */
internal sealed interface ClusterElement {
  val diffKey: String
  val renderVersion: Long

  data class Single(val descriptor: MarkerDescriptor) : ClusterElement {
    override val diffKey: String get() = "s:" + descriptor.id
    override val renderVersion: Long = descriptor.displayedIdentityVersion()
  }

  data class Cluster(
    val key: String,
    val position: LatLng,
    val count: Int,
    val memberIds: List<String>,
    val bounds: LatLngBounds,
  ) : ClusterElement {
    override val diffKey: String get() = "c:$key"
    override val renderVersion: Long = renderSignature(
      "cluster",
      key,
      position.latitude,
      position.longitude,
      count,
      memberIds.sorted(),
      bounds.southwest.latitude,
      bounds.southwest.longitude,
      bounds.northeast.latitude,
      bounds.northeast.longitude,
    )
  }
}

/**
 * Grid-based marker clustering computed in geographic space.
 *
 * Pure function over descriptor data (no map projection), so it is safe to call
 * from a background thread. Output is bounded by the number of grid cells that
 * fit on screen, keeping per-frame Google Maps work small and constant.
 */
internal object MarkerClusterEngine {
  private const val CELL_DP = 64.0

  private fun wrapsLongitude(sw: LatLng, ne: LatLng): Boolean {
    return ne.longitude < sw.longitude
  }

  private fun longitudeSpan(sw: LatLng, ne: LatLng): Double {
    val raw = ne.longitude - sw.longitude
    return if (raw < 0) raw + 360.0 else raw
  }

  private fun normalizeLongitude(lon: Double, reference: Double): Double {
    var normalized = lon
    while (normalized - reference > 180.0) {
      normalized -= 360.0
    }
    while (normalized - reference < -180.0) {
      normalized += 360.0
    }
    return normalized
  }

  private fun wrapTo180(lon: Double): Double {
    var wrapped = lon
    while (wrapped > 180.0) {
      wrapped -= 360.0
    }
    while (wrapped < -180.0) {
      wrapped += 360.0
    }
    return wrapped
  }

  /**
   * Snaps a cell size (degrees) to the nearest power of two so small zoom
   * changes keep the same absolute grid.
   */
  private fun quantize(value: Double): Double {
    if (value <= 0 || !value.isFinite()) {
      return 1.0
    }
    return 2.0.pow(log2(value).roundToInt())
  }

  fun clusters(
    candidates: List<MarkerDescriptor>,
    bounds: LatLngBounds,
    viewWidthPx: Int,
    viewHeightPx: Int,
    density: Float,
  ): List<ClusterElement> {
    if (candidates.isEmpty()) {
      return emptyList()
    }

    val singles = ArrayList<ClusterElement>()
    val clusterableCandidates = ArrayList<MarkerDescriptor>()
    for (descriptor in candidates) {
      if (descriptor.clusterable == false) {
        singles.add(ClusterElement.Single(descriptor))
      } else {
        clusterableCandidates.add(descriptor)
      }
    }

    if (clusterableCandidates.isEmpty()) {
      return singles
    }

    val cellPx = CELL_DP * density
    val cols = maxOf(1, (viewWidthPx / cellPx).toInt())
    val rows = maxOf(1, (viewHeightPx / cellPx).toInt())
    val sw = bounds.southwest
    val ne = bounds.northeast
    val wraps = wrapsLongitude(sw, ne)
    // Quantize cell size and anchor the grid to absolute (0,0) coordinates so
    // cells stay fixed to geography while panning — clusters don't churn or
    // "swim", only re-forming when the zoom level crosses an octave.
    val cellLat = quantize((ne.latitude - sw.latitude) / rows)
    val cellLon = quantize(longitudeSpan(sw, ne) / cols)

    val buckets = HashMap<String, Bucket>()
    for (descriptor in clusterableCandidates) {
      val lat = descriptor.coordinate.latitude
      val lon = if (wraps) {
        normalizeLongitude(descriptor.coordinate.longitude, sw.longitude)
      } else {
        descriptor.coordinate.longitude
      }
      val row = floor(lat / cellLat).toInt()
      val col = floor(lon / cellLon).toInt()
      val key = "$row:$col"
      val bucket = buckets.getOrPut(key) { Bucket() }
      bucket.key = key
      bucket.count += 1
      bucket.sumLat += lat
      bucket.sumLon += lon
      bucket.minLat = minOf(bucket.minLat, lat)
      bucket.maxLat = maxOf(bucket.maxLat, lat)
      bucket.minLon = minOf(bucket.minLon, lon)
      bucket.maxLon = maxOf(bucket.maxLon, lon)
      if (bucket.first == null) {
        bucket.first = descriptor
      }
      bucket.memberIds.add(descriptor.id)
    }

    val merged = mergeOverlapping(
      ArrayList(buckets.values),
      bounds,
      wraps,
      viewWidthPx,
      viewHeightPx,
      density,
    )

    val result = ArrayList<ClusterElement>(merged.size + singles.size)
    result.addAll(singles)
    for (bucket in merged) {
      val first = bucket.first
      if (bucket.count == 1 && first != null) {
        result.add(ClusterElement.Single(first))
      } else {
        result.add(
          ClusterElement.Cluster(
            key = bucket.key,
            position = LatLng(bucket.sumLat / bucket.count, bucket.sumLon / bucket.count),
            count = bucket.count,
            memberIds = bucket.memberIds,
            bounds = LatLngBounds(
              LatLng(bucket.minLat, wrapTo180(bucket.minLon)),
              LatLng(bucket.maxLat, wrapTo180(bucket.maxLon)),
            ),
          ),
        )
      }
    }
    return result
  }

  /** Approximate badge radius (dp) per count — mirrors the drawn badge sizes. */
  private fun badgeRadiusDp(count: Int): Double = ClusterBadgeMetrics.badgeRadiusDp(count)

  /** Extra slack (dp) so near-touching badges still merge. */
  private val mergeGapDp = ClusterBadgeMetrics.MERGE_GAP_DP

  /**
   * Merges buckets whose badges would overlap on screen, so a zoomed-out view
   * collapses neighbouring cells into one badge instead of stacking them. Uses
   * union-find on screen-space centroid distance; groups are seeded by the
   * largest bucket so the resulting cluster key is stable.
   */
  private fun mergeOverlapping(
    buckets: ArrayList<Bucket>,
    bounds: LatLngBounds,
    wraps: Boolean,
    viewWidthPx: Int,
    viewHeightPx: Int,
    density: Float,
  ): List<Bucket> {
    val n = buckets.size
    if (n <= 1) {
      return buckets
    }

    val width = viewWidthPx.toDouble()
    val height = viewHeightPx.toDouble()
    val sw = bounds.southwest
    val ne = bounds.northeast
    val centerLat = (sw.latitude + ne.latitude) / 2
    val spanLat = maxOf(ne.latitude - sw.latitude, 1e-9)
    val spanLon = maxOf(longitudeSpan(sw, ne), 1e-9)
    val centerLon = if (wraps) {
      normalizeLongitude(sw.longitude + spanLon / 2, sw.longitude)
    } else {
      (sw.longitude + ne.longitude) / 2
    }

    val px = DoubleArray(n)
    val py = DoubleArray(n)
    for (i in 0 until n) {
      val bucket = buckets[i]
      val lat = bucket.sumLat / bucket.count
      val lon = if (wraps) {
        normalizeLongitude(bucket.sumLon / bucket.count, sw.longitude)
      } else {
        bucket.sumLon / bucket.count
      }
      px[i] = (lon - centerLon) / spanLon * width
      py[i] = (centerLat - lat) / spanLat * height
    }

    val parent = IntArray(n) { it }
    fun find(value: Int): Int {
      var root = value
      while (parent[root] != root) {
        parent[root] = parent[parent[root]]
        root = parent[root]
      }
      return root
    }

    for (i in 0 until n) {
      val ri = badgeRadiusDp(buckets[i].count) * density
      for (j in (i + 1) until n) {
        val dx = px[i] - px[j]
        val dy = py[i] - py[j]
        val minDist = ri + badgeRadiusDp(buckets[j].count) * density + mergeGapDp * density
        if (dx * dx + dy * dy < minDist * minDist) {
          val a = find(i)
          val b = find(j)
          if (a != b) {
            parent[b] = a
          }
        }
      }
    }

    val groups = HashMap<Int, Bucket>()
    val order = ArrayList<Int>()
    for (index in (0 until n).sortedByDescending { buckets[it].count }) {
      val root = find(index)
      val existing = groups[root]
      if (existing != null) {
        existing.absorb(buckets[index])
      } else {
        groups[root] = buckets[index]
        order.add(root)
      }
    }
    return order.mapNotNull { groups[it] }
  }

  private class Bucket {
    var key = ""
    var count = 0
    var sumLat = 0.0
    var sumLon = 0.0
    var minLat = Double.MAX_VALUE
    var maxLat = -Double.MAX_VALUE
    var minLon = Double.MAX_VALUE
    var maxLon = -Double.MAX_VALUE
    var first: MarkerDescriptor? = null
    val memberIds = ArrayList<String>()

    /** Folds another bucket's members in; keeps own key/first (seed = dominant). */
    fun absorb(other: Bucket) {
      count += other.count
      sumLat += other.sumLat
      sumLon += other.sumLon
      minLat = minOf(minLat, other.minLat)
      maxLat = maxOf(maxLat, other.maxLat)
      minLon = minOf(minLon, other.minLon)
      maxLon = maxOf(maxLon, other.maxLon)
      memberIds.addAll(other.memberIds)
    }
  }
}

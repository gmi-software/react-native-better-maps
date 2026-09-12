package com.margelo.nitro.nitromaps

/**
 * Buckets from the previous refresh, kept while the zoom octave and the
 * dataset stay the same.
 *
 * The cluster grid is anchored to geography, so a pan within one octave only
 * changes which cells are on screen. Cells that were fully inside the previous
 * padded viewport are reused as they are; only the cells that entered are
 * accumulated. Cells that leave are dropped so the cache stays the size of one
 * viewport. Owned by one compute thread; not thread-safe.
 */
internal class ClusterOctaveCache {
  private var cellLat = Double.NaN
  private var cellLon = Double.NaN
  private var generation = Long.MIN_VALUE
  internal val buckets = HashMap<Long, MarkerClusterEngine.Bucket>()
  private val computed = HashSet<Long>()

  /** Number of candidates skipped because their cell was already computed. */
  var reusedCandidates = 0L
    private set

  /** Starts a refresh; drops everything when the octave or the dataset changed. */
  fun begin(cellLat: Double, cellLon: Double, generation: Long) {
    if (this.cellLat != cellLat || this.cellLon != cellLon || this.generation != generation) {
      buckets.clear()
      computed.clear()
      this.cellLat = cellLat
      this.cellLon = cellLon
      this.generation = generation
    }
  }

  fun isComputed(key: Long): Boolean {
    val hit = computed.contains(key)
    if (hit) reusedCandidates += 1
    return hit
  }

  /**
   * Marks every cell of [range] computed and evicts cells outside it, including
   * the edge cells accumulated this pass that the next viewport may only cover
   * partially.
   */
  fun finish(range: MarkerClusterEngine.CellRange) {
    computed.removeAll { key -> !range.contains(key) }
    buckets.keys.removeAll { key -> !range.contains(key) }
    for (row in range.rowMin..range.rowMax) {
      for (column in range.colMin..range.colMax) {
        computed.add(MarkerClusterEngine.cellKey(row, column))
      }
    }
  }

  fun clear() {
    buckets.clear()
    computed.clear()
    cellLat = Double.NaN
    cellLon = Double.NaN
    generation = Long.MIN_VALUE
  }
}

import Foundation

/// Buckets from the previous refresh, kept while the zoom octave and the
/// dataset stay the same.
///
/// The cluster grid is anchored to geography, so a pan within one octave only
/// changes which cells are on screen. Cells that were fully inside the previous
/// padded viewport are reused as they are; only the cells that entered are
/// accumulated. Cells that leave are dropped so the cache stays the size of one
/// viewport. Owned by one compute queue; not thread-safe.
final class ClusterOctaveCache {
  private var cellLat = Double.nan
  private var cellLon = Double.nan
  private var generation = Int.min
  var buckets: [Int64: MarkerClusterEngine.Bucket] = [:]
  private var computed = Set<Int64>()

  /// Number of candidates skipped because their cell was already computed.
  private(set) var reusedCandidates = 0

  /// Starts a refresh; drops everything when the octave or the dataset changed.
  func begin(cellLat: Double, cellLon: Double, generation: Int) {
    if self.cellLat != cellLat || self.cellLon != cellLon || self.generation != generation {
      buckets.removeAll(keepingCapacity: true)
      computed.removeAll(keepingCapacity: true)
      self.cellLat = cellLat
      self.cellLon = cellLon
      self.generation = generation
    }
  }

  /// Moves the buckets out for accumulation; `buckets` is assigned back afterwards.
  func takeBuckets() -> [Int64: MarkerClusterEngine.Bucket] {
    let taken = buckets
    buckets = [:]
    return taken
  }

  func isComputed(_ key: Int64) -> Bool {
    let hit = computed.contains(key)
    if hit {
      reusedCandidates += 1
    }
    return hit
  }

  /// Marks every cell of `range` computed and evicts cells outside it, including
  /// the edge cells accumulated this pass that the next viewport may only cover
  /// partially.
  func finish(_ range: MarkerClusterEngine.CellRange) {
    computed = computed.filter { range.contains($0) }
    buckets = buckets.filter { range.contains($0.key) }
    guard range.rowMin <= range.rowMax, range.colMin <= range.colMax else {
      return
    }
    for row in range.rowMin...range.rowMax {
      for column in range.colMin...range.colMax {
        computed.insert(MarkerClusterEngine.cellKey(row: row, column: column))
      }
    }
  }

  func clear() {
    buckets.removeAll()
    computed.removeAll()
    cellLat = .nan
    cellLon = .nan
    generation = .min
  }
}

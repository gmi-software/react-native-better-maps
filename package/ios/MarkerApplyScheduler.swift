import MapKit

/// One render diff waiting to be applied over frames.
final class PendingMarkerApply {
  private(set) var removals: [MarkerRenderKey]
  var adds: ArraySlice<MarkerRenderEntry>
  var retained: ArraySlice<MarkerRenderEntry>
  let animateEntering: Bool
  /// Entering animations left for this diff; the sink decrements it.
  var animationBudget: Int

  init(
    diff: MarkerRenderDiff,
    center: CLLocationCoordinate2D?,
    animateEntering: Bool,
    animationBudget: Int
  ) {
    removals = Array(diff.removedKeys)
    adds = Self.sortedByDistance(diff.added, center: center)[...]
    retained = diff.retained[...]
    self.animateEntering = animateEntering
    self.animationBudget = animationBudget
  }

  var isEmpty: Bool {
    removals.isEmpty && adds.isEmpty && retained.isEmpty
  }

  /// Hands out the removals once.
  func takeRemovals() -> [MarkerRenderKey] {
    let taken = removals
    removals = []
    return taken
  }

  /// Nearest to the viewport centre first, so the visible middle fills before the edges.
  static func sortedByDistance(
    _ entries: [MarkerRenderEntry],
    center: CLLocationCoordinate2D?
  ) -> [MarkerRenderEntry] {
    guard let center, entries.count > 1 else {
      return entries
    }
    let cosLat = cos(center.latitude * .pi / 180)
    func distance(_ entry: MarkerRenderEntry) -> Double {
      let coordinate = entry.element.coordinate
      let dLat = coordinate.latitude - center.latitude
      let dLon = (coordinate.longitude - center.longitude) * cosLat
      return dLat * dLat + dLon * dLon
    }
    return entries.sorted { distance($0) < distance($1) }
  }
}

private extension MarkerRenderElement {
  var coordinate: CLLocationCoordinate2D {
    switch self {
    case let .single(descriptor):
      return descriptor.coordinate.toCLLocationCoordinate2D()
    case let .cluster(_, coordinate, _, _, _):
      return coordinate
    }
  }
}

/// Applies render diffs over several frames instead of in one pass.
///
/// Removals go out in full on the first step (cheap, and they free the screen),
/// adds go out a bounded number per frame, nearest to the centre first, and
/// retained updates fill whatever is left of the time budget. The number of
/// adds per frame adapts to the observed frame interval: a long frame halves
/// it, frames on budget grow it back, but only up to three quarters of the
/// last count that dropped a frame; that ceiling creeps up by one per good
/// frame so a one-off hitch does not pin the rate. The display link runs only
/// while work is pending.
///
/// A new diff replaces whatever was still pending. Diffs are computed against
/// what is actually on the map, so anything not yet applied is either in the
/// new diff again or no longer wanted.
final class MarkerApplyScheduler {
  struct Sink {
    let remove: ([MarkerRenderKey]) -> Void
    let add: ([MarkerRenderEntry], PendingMarkerApply) -> Void
    let update: (MarkerRenderEntry) -> Void
  }

  static let initialAddsPerFrame = 32
  static let minimumAddsPerFrame = 8
  static let maximumAddsPerFrame = 256
  /// Time for retained updates after the frame's adds, about a quarter of a 120 Hz frame.
  static let stepBudget: CFTimeInterval = 0.002

  private let sink: Sink
  private var pending: PendingMarkerApply?
  private(set) var addsPerFrame = MarkerApplyScheduler.initialAddsPerFrame
  /// The add count that last dropped a frame, if any.
  private(set) var ceiling: Int?
  private lazy var clock = FrameClock { [weak self] frame in
    self?.tick(frame)
  }

  init(sink: Sink) {
    self.sink = sink
  }

  var hasWork: Bool {
    pending?.isEmpty == false
  }

  /// Replaces pending work, applies the first step right away and continues per frame.
  func schedule(_ next: PendingMarkerApply) {
    pending = next.isEmpty ? nil : next
    step()
    if hasWork {
      clock.start()
    }
  }

  func cancel() {
    pending = nil
    clock.stop()
  }

  /// Adapts the per-frame add count to how long the last frame took.
  func observeFrame(interval: CFTimeInterval, expected: CFTimeInterval) {
    guard expected > 0 else {
      return
    }
    if interval > expected * 1.5 {
      ceiling = addsPerFrame
      addsPerFrame = max(Self.minimumAddsPerFrame, addsPerFrame / 2)
    } else if interval <= expected * 1.1 {
      if let known = ceiling {
        ceiling = known + 1
      }
      let limit = ceiling.map { max(Self.minimumAddsPerFrame, $0 * 3 / 4) }
        ?? Self.maximumAddsPerFrame
      addsPerFrame = min(limit, addsPerFrame + addsPerFrame / 2)
    }
  }

  private func tick(_ frame: FrameClock.Frame) {
    if let interval = frame.interval {
      observeFrame(interval: interval, expected: frame.expected)
    }
    step()
    if !hasWork {
      clock.stop()
    }
  }

  /// One frame's worth of work.
  private func step() {
    guard let current = pending else {
      return
    }
    let signpost = MapTrace.begin("applyMarkerDiff")
    defer { MapTrace.end("applyMarkerDiff", signpost) }
    let start = CACurrentMediaTime()

    let removals = current.takeRemovals()
    if !removals.isEmpty {
      sink.remove(removals)
    }

    if !current.adds.isEmpty {
      let chunk = Array(current.adds.prefix(addsPerFrame))
      current.adds = current.adds.dropFirst(chunk.count)
      sink.add(chunk, current)
    }

    while let entry = current.retained.first, CACurrentMediaTime() - start < Self.stepBudget {
      current.retained = current.retained.dropFirst()
      sink.update(entry)
    }

    if current.isEmpty {
      pending = nil
    }
  }
}

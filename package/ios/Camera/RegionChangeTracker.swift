import Foundation

/// Turns a map SDK's camera callbacks into one `onRegionChange` /
/// `onRegionChangeComplete` pair per move of the camera.
///
/// The SDKs are noisier than that. Google Maps reports a start and an idle for a
/// camera update that leaves the camera exactly where it was - a repeated fit, or a
/// `region` prop sent again with the same values, which an inline object literal does
/// on every render. So a move is announced only once the camera has left the place it
/// last came to rest, and a move that never did announces nothing. Otherwise a handler
/// that re-renders the map would be answered by a move that re-renders it again, for
/// ever.
///
/// The place it last came to rest, rather than wherever the SDK says the camera is when
/// a move starts: MapKit already reports the destination by then when the app sets the
/// camera. Until the camera has come to rest once there is nothing to measure against -
/// the map is still settling into its first position - so that is not announced either.
///
/// Generic over the position and the region so it builds without MapKit, Google Maps
/// or the Nitro-generated types. The Android adapter has the same class in Kotlin.
/// Main thread only, like the delegate callbacks that drive it.
final class RegionChangeTracker<Position: Equatable, Region> {
  private struct Move {
    let isGesture: Bool
    /// `nil` while the map is still settling into its first position.
    let start: (position: Position, region: Region)?
    var hasBegun = false
  }

  private let position: () -> Position
  private let region: () -> Region
  private let onBegin: (Region, _ isGesture: Bool) -> Void
  private let onComplete: (Region, _ isGesture: Bool) -> Void
  private var move: Move?
  private var rest: (position: Position, region: Region)?

  init(
    position: @escaping () -> Position,
    region: @escaping () -> Region,
    onBegin: @escaping (Region, _ isGesture: Bool) -> Void,
    onComplete: @escaping (Region, _ isGesture: Bool) -> Void
  ) {
    self.position = position
    self.region = region
    self.onBegin = onBegin
    self.onComplete = onComplete
  }

  /// True while the finger, rather than the app, is driving the camera.
  var isGesture: Bool {
    move?.isGesture == true
  }

  /// The SDK says the camera is about to move.
  func moveStarted(isGesture: Bool) {
    guard let current = move else {
      move = Move(isGesture: isGesture, start: rest)
      return
    }

    // Still the same move - unless a gesture takes over from the app's own, which ends
    // the app's move where the finger caught the camera and starts the user's there.
    guard isGesture, !current.isGesture else {
      return
    }

    finish()
    move = Move(isGesture: true, start: (position(), region()))
  }

  /// The SDK says the camera has moved on a step.
  func cameraMoved() {
    guard let current = move, !current.hasBegun, let start = current.start,
      position() != start.position
    else {
      return
    }

    move?.hasBegun = true
    onBegin(start.region, current.isGesture)
  }

  /// The SDK says the camera has come to rest.
  func cameraStopped() {
    finish()
    rest = (position(), region())
  }

  /// Forgets the move under way without reporting it, and where the camera last came to
  /// rest: the map view is about to show a different map.
  func reset() {
    move = nil
    rest = nil
  }

  private func finish() {
    // A jump can come to rest without a single step reported in between.
    cameraMoved()
    guard let current = move else {
      return
    }

    move = nil
    if current.hasBegun {
      onComplete(region(), current.isGesture)
    }
  }
}

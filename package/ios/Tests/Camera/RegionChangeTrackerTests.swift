import Testing

@testable import NitroMapsCamera

/// Drives `RegionChangeTracker` with the callback sequences MapKit and Google Maps were
/// seen to produce, with an integer standing in for the camera position and for the
/// region derived from it. The Kotlin `RegionChangeTrackerTest` runs the same cases.
@MainActor
private final class Harness {
  var position = 0
  var events: [String] = []

  lazy var tracker = RegionChangeTracker<Int, Int>(
    position: { [unowned self] in position },
    region: { [unowned self] in position },
    onBegin: { [unowned self] region, isGesture in
      events.append("begin \(isGesture ? "gesture" : "app") @\(region)")
    },
    onComplete: { [unowned self] region, isGesture in
      events.append("complete \(isGesture ? "gesture" : "app") @\(region)")
    }
  )

  /// A map that has settled into its first position, as every case but one assumes.
  static func settled() -> Harness {
    let harness = Harness()
    harness.tracker.cameraStopped()
    return harness
  }
}

@Test @MainActor
func anAnimationEmitsOneBeginAndOneComplete() {
  let harness = Harness.settled()
  harness.tracker.moveStarted(isGesture: false)
  harness.position = 1
  harness.tracker.cameraMoved()
  harness.position = 2
  harness.tracker.cameraMoved()
  harness.tracker.cameraStopped()

  #expect(harness.events == ["begin app @0", "complete app @2"])
}

@Test @MainActor
func aJumpWithNoStepReportedStillEmitsBothEvents() {
  let harness = Harness.settled()
  harness.tracker.moveStarted(isGesture: false)
  harness.position = 5
  harness.tracker.cameraStopped()

  #expect(harness.events == ["begin app @0", "complete app @5"])
}

@Test @MainActor
func measuresAMoveFromWhereTheCameraLastCameToRest() {
  // MapKit already reports the destination when the app sets the camera.
  let harness = Harness.settled()
  harness.position = 4
  harness.tracker.moveStarted(isGesture: false)
  harness.tracker.cameraStopped()

  #expect(harness.events == ["begin app @0", "complete app @4"])
}

@Test @MainActor
func anUpdateThatLeavesTheCameraInPlaceEmitsNothing() {
  // A repeated fit, or a `region` prop sent again with the same values.
  let harness = Harness.settled()
  harness.tracker.moveStarted(isGesture: false)
  harness.tracker.cameraMoved()
  harness.tracker.cameraStopped()

  #expect(harness.events.isEmpty)
}

@Test @MainActor
func theMapSettlingIntoItsFirstPositionEmitsNothing() {
  let harness = Harness()
  harness.tracker.moveStarted(isGesture: false)
  harness.position = 7
  harness.tracker.cameraMoved()
  harness.tracker.cameraStopped()
  #expect(harness.events.isEmpty)

  // From there on, moves are measured against it.
  harness.tracker.moveStarted(isGesture: false)
  harness.position = 8
  harness.tracker.cameraStopped()
  #expect(harness.events == ["begin app @7", "complete app @8"])
}

@Test @MainActor
func aSecondStartForTheSameMoveIsIgnored() {
  // One animation interrupting another, reported as one continuous move.
  let harness = Harness.settled()
  harness.tracker.moveStarted(isGesture: false)
  harness.position = 1
  harness.tracker.cameraMoved()
  harness.tracker.moveStarted(isGesture: false)
  harness.position = 2
  harness.tracker.cameraMoved()
  harness.tracker.cameraStopped()

  #expect(harness.events == ["begin app @0", "complete app @2"])
}

@Test @MainActor
func aGestureTakingOverEndsTheAppsMoveAndStartsItsOwn() {
  let harness = Harness.settled()
  harness.tracker.moveStarted(isGesture: false)
  harness.position = 1
  harness.tracker.cameraMoved()
  harness.tracker.moveStarted(isGesture: true)
  harness.position = 2
  harness.tracker.cameraMoved()
  harness.tracker.cameraStopped()

  #expect(
    harness.events == [
      "begin app @0", "complete app @1", "begin gesture @1", "complete gesture @2",
    ]
  )
}

@Test @MainActor
func aGestureTakingOverBeforeTheCameraMovedLeavesOnlyTheGesture() {
  let harness = Harness.settled()
  harness.tracker.moveStarted(isGesture: false)
  harness.tracker.moveStarted(isGesture: true)
  harness.position = 3
  harness.tracker.cameraMoved()
  harness.tracker.cameraStopped()

  #expect(harness.events == ["begin gesture @0", "complete gesture @3"])
}

@Test @MainActor
func theAppTakingOverFromAGestureStaysOneGestureMove() {
  let harness = Harness.settled()
  harness.tracker.moveStarted(isGesture: true)
  harness.position = 1
  harness.tracker.cameraMoved()
  harness.tracker.moveStarted(isGesture: false)
  harness.position = 2
  harness.tracker.cameraMoved()
  harness.tracker.cameraStopped()

  #expect(harness.events == ["begin gesture @0", "complete gesture @2"])
}

@Test @MainActor
func reportsAGestureOnlyWhileOneIsUnderWay() {
  let harness = Harness.settled()
  #expect(!harness.tracker.isGesture)

  harness.tracker.moveStarted(isGesture: true)
  #expect(harness.tracker.isGesture)

  harness.tracker.cameraStopped()
  #expect(!harness.tracker.isGesture)

  harness.tracker.moveStarted(isGesture: false)
  #expect(!harness.tracker.isGesture)
}

@Test @MainActor
func ignoresStepsOutsideAMove() {
  let harness = Harness.settled()
  harness.position = 1
  harness.tracker.cameraMoved()

  #expect(harness.events.isEmpty)
}

@Test @MainActor
func resetForgetsTheMoveAndWhereTheCameraRested() {
  let harness = Harness.settled()
  harness.tracker.moveStarted(isGesture: false)
  harness.position = 1
  harness.tracker.cameraMoved()
  harness.tracker.reset()
  harness.tracker.cameraStopped()
  #expect(harness.events == ["begin app @0"])

  // A new map settles into its first position without a word.
  harness.tracker.reset()
  harness.tracker.moveStarted(isGesture: false)
  harness.position = 2
  harness.tracker.cameraStopped()
  #expect(harness.events == ["begin app @0"])
}

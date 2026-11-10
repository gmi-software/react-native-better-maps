import Foundation

/// The duration a camera animation takes when the caller passes none, in milliseconds.
let defaultCameraAnimationDurationMilliseconds: Double = 250

/// The duration `MapViewRef` passes, in milliseconds, as the seconds UIKit and Core
/// Animation take. Anything that is not a finite number greater than 0 - a negative
/// value, `NaN` or infinity - comes back as 0, which the adapters treat as a jump. The
/// Kotlin `cameraAnimationDurationMs` gives Android the same default.
func cameraAnimationSeconds(fromMilliseconds milliseconds: Double?) -> TimeInterval {
  let milliseconds = milliseconds ?? defaultCameraAnimationDurationMilliseconds
  guard milliseconds.isFinite, milliseconds > 0 else {
    return 0
  }
  return milliseconds / 1000
}

import Testing

@testable import NitroMapsCamera

/// The Kotlin `CameraAnimationDurationTest` covers the same cases for Android.
@Test
func aMissingDurationTakesAQuarterOfASecond() {
  #expect(cameraAnimationSeconds(fromMilliseconds: nil) == 0.25)
}

@Test
func millisecondsBecomeSeconds() {
  #expect(cameraAnimationSeconds(fromMilliseconds: 1000) == 1)
  #expect(cameraAnimationSeconds(fromMilliseconds: 2000) == 2)
  #expect(cameraAnimationSeconds(fromMilliseconds: 1) == 0.001)
}

@Test
func zeroStaysAJump() {
  #expect(cameraAnimationSeconds(fromMilliseconds: 0) == 0)
}

@Test(arguments: [-1, -100, Double.nan, Double.infinity, -Double.infinity])
func aDurationThatIsNotAFinitePositiveNumberIsAJump(milliseconds: Double) {
  #expect(cameraAnimationSeconds(fromMilliseconds: milliseconds) == 0)
}

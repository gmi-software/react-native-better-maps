import Testing

@testable import NitroMapsGeometry

@Test
func acceptsFramingValuesTheMapCanUse() {
  #expect(CameraFraming.isDrawable(zoom: 12, heading: 90, pitch: 45, altitude: 1000))
  #expect(CameraFraming.isDrawable(zoom: 0, heading: 0, pitch: 0, altitude: 0))
}

@Test
func acceptsAbsentFramingValues() {
  #expect(CameraFraming.isDrawable(zoom: nil, heading: nil, pitch: nil, altitude: nil))
  #expect(CameraFraming.isDrawable(zoom: 12, heading: nil, pitch: nil, altitude: nil))
}

@Test
func rejectsANonFiniteFramingValue() {
  #expect(!CameraFraming.isDrawable(zoom: .nan, heading: nil, pitch: nil, altitude: nil))
  #expect(!CameraFraming.isDrawable(zoom: nil, heading: .infinity, pitch: nil, altitude: nil))
  #expect(!CameraFraming.isDrawable(zoom: nil, heading: nil, pitch: .nan, altitude: nil))
  #expect(!CameraFraming.isDrawable(zoom: nil, heading: nil, pitch: nil, altitude: -.infinity))
}

/// A pitch past the range the SDKs draw is pulled back to it rather than
/// rejected, so the camera still reaches the map.
@Test
func acceptsAPitchOutsideTheDrawableRange() {
  #expect(CameraFraming.isDrawable(zoom: nil, heading: nil, pitch: 120, altitude: nil))
  #expect(CameraFraming.isDrawable(zoom: nil, heading: nil, pitch: -10, altitude: nil))
}

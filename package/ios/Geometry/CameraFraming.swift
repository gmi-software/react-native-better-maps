import Foundation

/// The framing half of a camera - zoom, heading, pitch and altitude - which
/// `CLLocationCoordinate2DIsValid` says nothing about.
enum CameraFraming {
  /// Every value the caller supplied has to be a real number. `MKMapCamera`
  /// does not reject a `NaN` one: it collapses the altitude to the minimum the
  /// map allows, or leaves `MKMapView.region` reading back as `NaN`. On Android
  /// a non-finite tilt throws out of `CameraPosition` instead.
  static func isDrawable(
    zoom: Double?,
    heading: Double?,
    pitch: Double?,
    altitude: Double?
  ) -> Bool {
    isRealOrAbsent(zoom)
      && isRealOrAbsent(heading)
      && isRealOrAbsent(pitch)
      && isRealOrAbsent(altitude)
  }

  /// An omitted value is filled in from the camera the map already has, so only
  /// a supplied one has to be checked.
  private static func isRealOrAbsent(_ value: Double?) -> Bool {
    guard let value else {
      return true
    }

    return value.isFinite
  }
}

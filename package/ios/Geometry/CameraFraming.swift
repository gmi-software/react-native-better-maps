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
    isRealAsFloatOrAbsent(zoom)
      && isRealOrAbsent(heading)
      && isRealOrAbsent(pitch)
      && isRealOrAbsent(altitude)
  }

  /// `GMSCameraPosition` holds zoom as a `Float`, and `CameraPosition` does the
  /// same on Android, so the value the SDK receives is the narrowed one: a
  /// `Double` past `Float.greatestFiniteMagnitude` arrives as `infinity`. Zoom
  /// is the only value narrowed that way - heading, pitch and altitude stay
  /// `Double` through `CLLocationDirection` and `MKMapCamera`.
  private static func isRealAsFloatOrAbsent(_ value: Double?) -> Bool {
    guard let value else {
      return true
    }

    return value.isFinite && Float(value).isFinite
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

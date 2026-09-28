import Foundation

/// Where a map camera is, as a plain value that both SDKs' cameras reduce to.
///
/// `MKMapCamera` and `GMSCameraPosition` are classes, and `MKMapView.camera` hands out a
/// fresh copy on every read, so two reads of a camera that has not moved are never `==`
/// as objects. Compared exactly on purpose: the question is whether the camera moved at
/// all, not whether it moved far.
struct CameraPlacement: Equatable {
  let latitude: Double
  let longitude: Double
  /// The distance to the ground for MapKit, the zoom level for Google Maps. Only ever
  /// compared with a placement from the same SDK.
  let scale: Double
  let heading: Double
  let pitch: Double
}

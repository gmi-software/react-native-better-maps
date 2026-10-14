extension Camera {
  /// Whether the camera can be handed to `MKMapView.camera` without MapKit raising.
  var isValid: Bool {
    center.isValid
      && CameraFraming.isDrawable(
        zoom: zoom,
        heading: heading,
        pitch: pitch,
        altitude: altitude
      )
  }
}

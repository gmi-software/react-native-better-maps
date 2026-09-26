import MapKit

extension MKMapView {
  /// The camera `setRegion(_:animated:)` would give this map for `region`,
  /// worked out without moving the map.
  ///
  /// The altitude that frames a region depends on the view's size, on its
  /// layout margins - `setRegion` fits the region inside them - and on the
  /// projection, so the region is set on an off-screen stand-in of the same
  /// size and margins and the camera is read back from it. Like `setRegion`,
  /// that camera is north up and flat. Needs a map that has been laid out.
  func camera(framing region: MKCoordinateRegion) -> MKMapCamera {
    let framingView = Self.framingView
    framingView.frame = bounds
    framingView.layoutMargins = layoutMargins
    // `regionThatFits` pulls a span whose edges run past a pole back to one
    // `setRegion` accepts, as `applyRegion` does for the live map.
    framingView.setRegion(framingView.regionThatFits(region), animated: false)

    let camera = framingView.camera
    return MKMapCamera(
      lookingAtCenter: camera.centerCoordinate,
      fromDistance: camera.centerCoordinateDistance,
      pitch: camera.pitch,
      heading: camera.heading
    )
  }

  /// Builds the stand-in ahead of the first `camera(framing:)`, which would
  /// otherwise spend its ~20 ms there and start its animation that much late.
  static func prepareFramingView() {
    _ = framingView
  }

  /// Shared, like a sizing cell: it is only used synchronously on the main
  /// thread, and building an `MKMapView` takes around 20 ms.
  private static let framingView: MKMapView = {
    let mapView = MKMapView()
    // The margins copied in already include the source map's safe area.
    mapView.insetsLayoutMarginsFromSafeArea = false
    return mapView
  }()
}

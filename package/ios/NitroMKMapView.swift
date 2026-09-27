import MapKit

/// MapKit view that keeps built-in controls styled for readability on busy basemaps.
final class NitroMKMapView: MKMapView {
  /// Called after every layout pass, for work that has to wait until the map has a size.
  var onLayout: (() -> Void)?

  override func layoutSubviews() {
    super.layoutSubviews()
    applyScaleAppearance()
    onLayout?()
  }
}

import MapKit
import UIKit

/// Native MapKit marker view with system insertion animation, selection bounce, and styling.
final class NitroPinAnnotationView: MKMarkerAnnotationView {
  static let reuseIdentifier = "NitroPin"
  private static let defaultPinSize = CGSize(width: 40, height: 52)

  override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
    super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
    animatesWhenAdded = true
    canShowCallout = false
    collisionMode = .circle
    displayPriority = .required
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func configure(for marker: MapMarkerAnnotation) {
    layer.removeAllAnimations()
    alpha = 1
    transform = .identity
    annotation = marker
    animatesWhenAdded = marker.enteringAnimation.kind == .system && !marker.suppressesNextEnteringAnimation
    isDraggable = marker.draggable
    canShowCallout = marker.title != nil || marker.subtitle != nil
    displayPriority = .required
    alpha = marker.opacity
    markerTintColor = marker.markerColor?.toUIColor(fallback: .systemRed)
    zPriority = marker.zIndex.map {
      MKAnnotationViewZPriority(rawValue: Float($0))
    } ?? .defaultUnselected

    // No forced layout here: this runs inside MapKit's `viewFor` callback for
    // every pin entering the viewport. The marker view keeps one size across
    // reuse, so a zero size only happens before the first layout, and the
    // default covers that.
    let pinSize = bounds.size == .zero ? Self.defaultPinSize : bounds.size
    centerOffset = marker.centerOffset(forImageSize: pinSize)

    let rotation = marker.rotation ?? 0
    transform = marker.flat != true && rotation != 0
      ? CGAffineTransform(rotationAngle: rotation * .pi / 180)
      : .identity
  }
}

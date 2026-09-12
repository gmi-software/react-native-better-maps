import MapKit
import UIKit

/// Single-layer pin: one pre-rendered image on an `MKAnnotationView`.
///
/// `MKMarkerAnnotationView` is a small view tree with its own layout,
/// selection animations and balloon; MapKit repositions every one of them on
/// the main thread per frame, which is what caps how many markers a 120 Hz
/// map can hold. This view is one image layer, and the image is drawn once per
/// screen scale.
final class NitroFlatPinAnnotationView: MKAnnotationView {
  static let reuseIdentifier = "NitroFlatPin"

  override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
    super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
    canShowCallout = false
    collisionMode = .circle
    displayPriority = .required
    image = PinImageRenderer.pin(scale: traitCollection.displayScale)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func configure(for marker: MapMarkerAnnotation) {
    layer.removeAllAnimations()
    transform = .identity
    annotation = marker
    isDraggable = marker.draggable
    canShowCallout = marker.title != nil || marker.subtitle != nil
    displayPriority = .required
    alpha = marker.opacity

    let pinSize = image?.size ?? PinImageRenderer.pinSize
    centerOffset = marker.centerOffset(forImageSize: pinSize)

    let rotation = marker.rotation ?? 0
    transform = marker.flat != true && rotation != 0
      ? CGAffineTransform(rotationAngle: rotation * .pi / 180)
      : .identity
  }
}

/// Draws the default pin once per screen scale.
enum PinImageRenderer {
  static let pinSize = CGSize(width: 30, height: 42)
  private static var cache: [CGFloat: UIImage] = [:]

  static func pin(scale: CGFloat) -> UIImage {
    let key = scale > 0 ? scale : UIScreen.main.scale
    if let cached = cache[key] {
      return cached
    }

    let format = UIGraphicsImageRendererFormat.default()
    format.scale = key
    let image = UIGraphicsImageRenderer(size: pinSize, format: format).image { context in
      let cg = context.cgContext
      let headCenter = CGPoint(x: pinSize.width / 2, y: 14)
      let headRadius: CGFloat = 12

      // Teardrop: the head circle joined to a tail that ends at the coordinate.
      let body = UIBezierPath()
      body.addArc(
        withCenter: headCenter,
        radius: headRadius,
        startAngle: .pi * 0.85,
        endAngle: .pi * 0.15,
        clockwise: true
      )
      body.addLine(to: CGPoint(x: pinSize.width / 2, y: pinSize.height - 1))
      body.close()

      cg.saveGState()
      cg.setShadow(offset: CGSize(width: 0, height: 1), blur: 2, color: UIColor.black.withAlphaComponent(0.35).cgColor)
      UIColor.systemRed.setFill()
      body.fill()
      cg.restoreGState()

      UIColor.white.withAlphaComponent(0.9).setStroke()
      body.lineWidth = 1
      body.stroke()

      UIColor.white.setFill()
      UIBezierPath(
        arcCenter: headCenter,
        radius: 4.5,
        startAngle: 0,
        endAngle: .pi * 2,
        clockwise: true
      ).fill()
    }
    cache[key] = image
    return image
  }
}

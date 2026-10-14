import UIKit

/// Draws the cluster badges `ClusterBadgeStyle` describes. Apple Maps and Google Maps
/// both show these images, so the two iOS providers draw the same badge.
enum ClusterBadgeRenderer {
  private static let cache: NSCache<NSString, UIImage> = {
    let cache = NSCache<NSString, UIImage>()
    cache.countLimit = 128
    return cache
  }()

  private static let fillGradient = CGGradient(
    colorsSpace: CGColorSpace(name: CGColorSpace.sRGB),
    colors: [
      ClusterBadgeStyle.gradientTopColor.toUIColor().cgColor,
      ClusterBadgeStyle.gradientBottomColor.toUIColor().cgColor,
    ] as CFArray,
    locations: [0, 1]
  )

  /// The badge for a cluster of `count` markers: `ClusterBadgeMetrics.diameter(for:)`
  /// across, with `ClusterBadgeStyle.shadowOutset` of room for the shadow on every
  /// side, so the circle's center is the image's center.
  static func image(count: Int) -> UIImage {
    let label = ClusterBadgeStyle.label(for: count)
    let diameter = ClusterBadgeMetrics.diameter(for: count)
    let key = "\(Int(diameter)):\(label)" as NSString
    if let image = cache.object(forKey: key) {
      return image
    }

    let image = draw(label: label, diameter: diameter)
    cache.setObject(image, forKey: key)
    return image
  }

  private static func draw(label: String, diameter: CGFloat) -> UIImage {
    let outset = ClusterBadgeStyle.shadowOutset
    let side = diameter + 2 * outset
    let format = UIGraphicsImageRendererFormat()
    format.scale = UIScreen.main.scale
    // The colors are all sRGB, so a wide-color context would only double the memory.
    format.preferredRange = .standard

    return UIGraphicsImageRenderer(size: CGSize(width: side, height: side), format: format).image { rendererContext in
      let context = rendererContext.cgContext
      let circle = CGRect(x: outset, y: outset, width: diameter, height: diameter)

      // The border is the rim of a white disc that the fill does not cover. A stroke drawn
      // over the fill would let the fill show through its anti-aliased outer edge. The disc
      // is opaque, so it also casts the badge's whole shadow.
      context.saveGState()
      context.setShadow(
        offset: CGSize(width: 0, height: ClusterBadgeStyle.shadowOffsetY),
        blur: 2 * ClusterBadgeStyle.shadowRadius,
        color: ClusterBadgeStyle.shadowColor.toUIColor().cgColor
      )
      context.setFillColor(ClusterBadgeStyle.borderColor.toUIColor().cgColor)
      context.fillEllipse(in: circle)
      context.restoreGState()

      if let fillGradient {
        context.saveGState()
        let borderWidth = ClusterBadgeStyle.borderWidth
        context.addEllipse(in: circle.insetBy(dx: borderWidth, dy: borderWidth))
        context.clip()
        // Runs across the whole circle, border included, as on Android.
        context.drawLinearGradient(
          fillGradient,
          start: CGPoint(x: circle.midX, y: circle.minY),
          end: CGPoint(x: circle.midX, y: circle.maxY),
          options: []
        )
        context.restoreGState()
      }

      drawLabel(label, centeredIn: circle)
    }
  }

  private static func drawLabel(_ label: String, centeredIn circle: CGRect) {
    let text = label as NSString
    var font = UIFont.systemFont(ofSize: ClusterBadgeStyle.labelFontSize, weight: .bold)
    let fittedSize = ClusterBadgeStyle.fittedLabelFontSize(
      labelWidth: text.size(withAttributes: [.font: font]).width,
      diameter: circle.width
    )
    if fittedSize != font.pointSize {
      font = font.withSize(fittedSize)
    }

    let attributes: [NSAttributedString.Key: Any] = [
      .font: font,
      .foregroundColor: ClusterBadgeStyle.labelColor.toUIColor(),
    ]
    let size = text.size(withAttributes: attributes)
    text.draw(
      at: CGPoint(x: circle.midX - size.width / 2, y: circle.midY - size.height / 2),
      withAttributes: attributes
    )
  }
}

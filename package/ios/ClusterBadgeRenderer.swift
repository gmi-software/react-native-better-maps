import UIKit

/// Draws the cluster badges `ClusterBadgeStyle` describes. Apple Maps and Google Maps
/// both show these images, so the two iOS providers draw the same badge.
enum ClusterBadgeRenderer {
  private static let cache: NSCache<NSString, UIImage> = {
    let cache = NSCache<NSString, UIImage>()
    cache.countLimit = 128
    return cache
  }()

  // What a color that does not parse is drawn as: the default badge's color for that part.
  private static let defaultBorderColor = ClusterBadgeStyle.borderColor.toUIColor()
  private static let defaultSolidFillColor = ClusterBadgeStyle.gradientBottomColor.toUIColor()
  private static let defaultLabelColor = ClusterBadgeStyle.labelColor.toUIColor()

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
  ///
  /// `backgroundImage` is drawn in place of the circle; pass it exactly when
  /// `appearance.backgroundImageKey` is set, since that key is what tells it apart in the cache.
  static func image(
    count: Int,
    appearance: ClusterBadgeAppearance = .standard,
    backgroundImage: UIImage? = nil
  ) -> UIImage {
    let label = ClusterBadgeStyle.label(for: count)
    let diameter = ClusterBadgeMetrics.diameter(for: count)
    let key = "\(appearance.cacheKey):\(Int(diameter)):\(label)" as NSString
    if let image = cache.object(forKey: key) {
      return image
    }

    let image = draw(label: label, diameter: diameter, appearance: appearance, backgroundImage: backgroundImage)
    cache.setObject(image, forKey: key)
    return image
  }

  private static func draw(
    label: String,
    diameter: CGFloat,
    appearance: ClusterBadgeAppearance,
    backgroundImage: UIImage?
  ) -> UIImage {
    let outset = ClusterBadgeStyle.shadowOutset
    let side = diameter + 2 * outset
    let format = UIGraphicsImageRendererFormat()
    format.scale = UIScreen.main.scale
    // The colors are all sRGB, so a wide-color context would only double the memory.
    format.preferredRange = .standard

    return UIGraphicsImageRenderer(size: CGSize(width: side, height: side), format: format).image { rendererContext in
      let context = rendererContext.cgContext
      let circle = CGRect(x: outset, y: outset, width: diameter, height: diameter)

      if let backgroundImage {
        backgroundImage.draw(in: aspectFit(backgroundImage.size, in: circle))
      } else {
        drawCircle(in: circle, appearance: appearance, pixel: 1 / format.scale, context: context)
      }

      drawLabel(label, centeredIn: circle, appearance: appearance)
    }
  }

  private static func drawCircle(
    in circle: CGRect,
    appearance: ClusterBadgeAppearance,
    pixel: CGFloat,
    context: CGContext
  ) {
    // The border is the rim of a disc that the fill does not cover. A stroke drawn over
    // the fill would let the fill show through its anti-aliased outer edge. The disc
    // casts the badge's whole shadow.
    context.saveGState()
    context.setShadow(
      offset: CGSize(width: 0, height: ClusterBadgeStyle.shadowOffsetY),
      blur: 2 * ClusterBadgeStyle.shadowRadius,
      color: ClusterBadgeStyle.shadowColor.toUIColor().cgColor
    )
    context.setFillColor(appearance.discColor.toUIColor(fallback: defaultBorderColor).cgColor)
    context.fillEllipse(in: circle)
    context.restoreGState()

    let fillCircle = circle.insetBy(dx: appearance.borderWidth, dy: appearance.borderWidth)
    guard !fillCircle.isEmpty else {
      return
    }

    // Clears the disc and shadow under the fill, so a translucent fill shows the map.
    // The cleared circle is a pixel smaller than the fill, which covers its anti-aliased
    // edge: an opaque fill looks as if drawn on the whole disc.
    let clearedCircle = fillCircle.insetBy(dx: pixel, dy: pixel)
    if !clearedCircle.isEmpty {
      context.saveGState()
      context.setBlendMode(.clear)
      context.fillEllipse(in: clearedCircle)
      context.restoreGState()
    }

    switch appearance.fill {
    case .solid(let color):
      context.setFillColor(color.toUIColor(fallback: defaultSolidFillColor).cgColor)
      context.fillEllipse(in: fillCircle)
    case .gradient:
      guard let fillGradient else {
        return
      }
      context.saveGState()
      context.addEllipse(in: fillCircle)
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
  }

  /// `size` scaled to fit `rect` and centered in it.
  private static func aspectFit(_ size: CGSize, in rect: CGRect) -> CGRect {
    guard size.width > 0, size.height > 0 else {
      return rect
    }
    let scale = min(rect.width / size.width, rect.height / size.height)
    let fitted = CGSize(width: size.width * scale, height: size.height * scale)
    return CGRect(
      x: rect.midX - fitted.width / 2,
      y: rect.midY - fitted.height / 2,
      width: fitted.width,
      height: fitted.height
    )
  }

  private static func drawLabel(
    _ label: String,
    centeredIn circle: CGRect,
    appearance: ClusterBadgeAppearance
  ) {
    let text = label as NSString
    var font = UIFont.systemFont(ofSize: ClusterBadgeStyle.labelFontSize, weight: .bold)
    let fittedSize = ClusterBadgeStyle.fittedLabelFontSize(
      labelWidth: text.size(withAttributes: [.font: font]).width,
      diameter: circle.width,
      inset: appearance.labelInset
    )
    if fittedSize != font.pointSize {
      font = font.withSize(fittedSize)
    }

    let attributes: [NSAttributedString.Key: Any] = [
      .font: font,
      .foregroundColor: appearance.labelColor.toUIColor(fallback: defaultLabelColor),
    ]
    let size = text.size(withAttributes: attributes)
    text.draw(
      at: CGPoint(x: circle.midX - size.width / 2, y: circle.midY - size.height / 2),
      withAttributes: attributes
    )
  }
}

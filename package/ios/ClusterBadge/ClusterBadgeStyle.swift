import CoreGraphics

/// What a cluster badge looks like, for every renderer on iOS.
///
/// Android draws the same badge from `ClusterBadgeStyle.kt`; change the two together.
/// Sizes are in points, and `ClusterBadgeMetrics` has the diameters.
enum ClusterBadgeStyle {
  /// The fill is a vertical gradient from `gradientTopColor` at the top of the circle
  /// to `gradientBottomColor` at the bottom.
  static let gradientTopColor = "#4D9EFF"
  static let gradientBottomColor = "#0A84FF"

  /// The border is a ring along the circle's outer edge, inside its diameter.
  static let borderColor = "#FFFFFF"
  static let borderWidth: CGFloat = 2

  /// Black at 28% opacity.
  static let shadowColor = "#00000047"
  /// Shadow blur in `CALayer.shadowRadius` terms: about one standard deviation of the
  /// Gaussian. Core Graphics takes twice this as its `blur`, and Android converts it
  /// for `BlurMaskFilter`.
  static let shadowRadius: CGFloat = 3
  /// Positive moves the shadow down.
  static let shadowOffsetY: CGFloat = 1.5

  static let labelColor = "#FFFFFF"
  /// Size of the bold system font the count is set in.
  static let labelFontSize: CGFloat = 13
  /// A count too wide for the badge shrinks, down to this share of `labelFontSize`.
  static let labelMinimumScaleFactor: CGFloat = 0.6
  /// Room kept clear on either side of the count, inside the border.
  static let labelPadding: CGFloat = 4

  /// How far past the circle a badge image extends to hold the whole shadow. At 28%
  /// opacity a shadow fades below 1/255 about 2.5 standard deviations out.
  static let shadowOutset: CGFloat = (2.5 * shadowRadius + abs(shadowOffsetY)).rounded(.up)

  /// The count as the badge shows it: `999`, then `1.0k`, `1.5k`, `12.3k`.
  ///
  /// Integer arithmetic rather than `%.1f`: printf rounds the binary value and Java the
  /// decimal one, so `1450` used to read `1.4k` on iOS and `1.5k` on Android.
  static func label(for count: Int) -> String {
    guard count >= 1000 else {
      return String(count)
    }
    let tenths = (count + 50) / 100
    return "\(tenths / 10).\(tenths % 10)k"
  }

  /// The font size that fits a count measuring `labelWidth` at `labelFontSize` inside
  /// a border `inset` wide on a badge `diameter` across.
  static func fittedLabelFontSize(
    labelWidth: CGFloat,
    diameter: CGFloat,
    inset: CGFloat = borderWidth
  ) -> CGFloat {
    let availableWidth = diameter - 2 * (inset + labelPadding)
    guard labelWidth > availableWidth else {
      return labelFontSize
    }
    return labelFontSize * max(labelMinimumScaleFactor, availableWidth / labelWidth)
  }

  /// A background image's declared size scaled down to fit a badge `diameter` across, so a
  /// large declared size does not decode an image far bigger than the badge draws.
  static func fittedImageSize(width: Double, height: Double, diameter: CGFloat) -> CGSize {
    guard width > 0, height > 0 else {
      return CGSize(width: width, height: height)
    }
    let scale = min(1, Double(diameter) / max(width, height))
    return CGSize(width: width * scale, height: height * scale)
  }
}

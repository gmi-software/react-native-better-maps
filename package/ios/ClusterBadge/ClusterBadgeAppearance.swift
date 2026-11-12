import CoreGraphics

/// What one map's cluster badges look like: its `clusterStyle` laid over `ClusterBadgeStyle`.
///
/// Android resolves the same from `ClusterBadgeAppearance.kt`; change the two together.
/// Colors stay hex strings until they are drawn, and one that does not parse is drawn in the
/// default badge's color for that part.
struct ClusterBadgeAppearance: Hashable {
  enum Fill: Hashable {
    /// `ClusterBadgeStyle.gradientTopColor` to `gradientBottomColor`.
    case gradient
    case solid(String)
  }

  static let standard = ClusterBadgeAppearance()

  let fill: Fill
  let borderColor: String
  let borderWidth: CGFloat
  let labelColor: String
  /// Identifies the image drawn in place of the circle, its border and its shadow; `nil`
  /// draws the circle.
  let backgroundImageKey: String?

  init(
    backgroundColor: String? = nil,
    textColor: String? = nil,
    borderColor: String? = nil,
    borderWidth: Double? = nil,
    backgroundImageKey: String? = nil
  ) {
    fill = backgroundColor.map(Fill.solid) ?? .gradient
    labelColor = textColor ?? ClusterBadgeStyle.labelColor
    self.borderColor = borderColor ?? ClusterBadgeStyle.borderColor
    if let borderWidth, borderWidth.isFinite {
      self.borderWidth = max(0, CGFloat(borderWidth))
    } else {
      self.borderWidth = ClusterBadgeStyle.borderWidth
    }
    self.backgroundImageKey = backgroundImageKey
  }

  /// The same look without its image: what shows while the image loads, or if it fails to.
  var withoutBackgroundImage: ClusterBadgeAppearance {
    ClusterBadgeAppearance(fill: fill, borderColor: borderColor, borderWidth: borderWidth, labelColor: labelColor)
  }

  /// The disc the fill is drawn on, which casts the shadow: the border's color, or with no
  /// border the fill's, so the disc does not show along the fill's anti-aliased edge.
  var discColor: String {
    guard borderWidth == 0 else {
      return borderColor
    }
    switch fill {
    case .gradient:
      return ClusterBadgeStyle.gradientBottomColor
    case .solid(let color):
      return color
    }
  }

  /// How far in from the badge's edge the count must stay clear of: the border, which an
  /// image badge does not draw.
  var labelInset: CGFloat {
    backgroundImageKey == nil ? borderWidth : 0
  }

  /// Tells drawn badges apart in a cache shared by every map.
  var cacheKey: String {
    let fillKey: String
    switch fill {
    case .gradient:
      fillKey = "gradient"
    case .solid(let color):
      // Prefixed so a solid fill named "gradient" does not share the default badge's key.
      fillKey = "solid:\(color)"
    }
    return [fillKey, borderColor, "\(borderWidth)", labelColor, backgroundImageKey ?? ""]
      .joined(separator: "|")
  }

  private init(fill: Fill, borderColor: String, borderWidth: CGFloat, labelColor: String) {
    self.fill = fill
    self.borderColor = borderColor
    self.borderWidth = borderWidth
    self.labelColor = labelColor
    backgroundImageKey = nil
  }
}

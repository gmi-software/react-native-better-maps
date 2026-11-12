import UIKit

/// The cluster badges one map draws: its `clusterStyle`, with the background image once it
/// has loaded. Apple Maps and Google Maps each keep one and redraw their shown clusters
/// when `onChange` fires.
final class ClusterBadgeStyleState {
  /// Called on main when the badges look different: a new style, or its image arriving.
  var onChange: (() -> Void)?

  private var appearance = ClusterBadgeAppearance.standard
  private var backgroundImage: UIImage?
  /// Key of the image being loaded, or `nil` when none is.
  private var pendingImageKey: String?
  /// Tells a load that finished after the style changed again apart from the current one.
  private var loadGeneration = 0

  func setStyle(_ style: ClusterStyleDescriptor?) {
    let image = style?.image.map(Self.badgeImage)
    let next = ClusterBadgeAppearance(
      backgroundColor: style?.backgroundColor,
      textColor: style?.textColor,
      borderColor: style?.borderColor,
      borderWidth: style?.borderWidth,
      backgroundImageKey: image.map { MarkerImageLoader.cacheKey(for: $0) as String }
    )
    guard next != appearance else {
      return
    }

    // A new color or border keeps the image already drawn or loading, with no reload or
    // fallback flash. A load still running redraws with the latest look when it finishes.
    let keepsImage =
      next.backgroundImageKey == appearance.backgroundImageKey
      && (backgroundImage != nil || pendingImageKey != nil)
    appearance = next
    if keepsImage {
      onChange?()
      return
    }
    loadGeneration += 1
    backgroundImage = image.flatMap(MarkerImageLoader.cachedImage(for:))
    pendingImageKey = nil
    if let image, backgroundImage == nil {
      let generation = loadGeneration
      pendingImageKey = next.backgroundImageKey
      MarkerImageLoader.load(image) { [weak self] loaded in
        guard let self, generation == self.loadGeneration else {
          return
        }
        self.pendingImageKey = nil
        guard let loaded else {
          return
        }
        self.backgroundImage = loaded
        self.onChange?()
      }
    }
    onChange?()
  }

  /// `image` with its declared size bounded to the largest badge, which is all a badge draws.
  private static func badgeImage(_ image: MarkerImage) -> MarkerImage {
    guard let width = image.width, let height = image.height else {
      return image
    }
    let size = ClusterBadgeStyle.fittedImageSize(
      width: width,
      height: height,
      diameter: ClusterBadgeMetrics.diameter(for: .max)
    )
    return MarkerImage(
      uri: image.uri,
      width: Double(size.width),
      height: Double(size.height),
      scale: image.scale,
      origin: image.origin
    )
  }

  func image(count: Int) -> UIImage {
    guard let backgroundImage else {
      return ClusterBadgeRenderer.image(count: count, appearance: appearance.withoutBackgroundImage)
    }
    return ClusterBadgeRenderer.image(count: count, appearance: appearance, backgroundImage: backgroundImage)
  }
}

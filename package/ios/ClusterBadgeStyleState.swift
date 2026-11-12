import UIKit

/// The cluster badges one map draws: its `clusterStyle`, with the background image once it
/// has loaded. Apple Maps and Google Maps each keep one and redraw their shown clusters
/// when `onChange` fires.
final class ClusterBadgeStyleState {
  /// Called on main when the badges look different: a new style, or its image arriving.
  var onChange: (() -> Void)?

  private var appearance = ClusterBadgeAppearance.standard
  private var backgroundImage: UIImage?
  /// Tells a load that finished after the style changed again apart from the current one.
  private var loadGeneration = 0

  func setStyle(_ style: ClusterStyleDescriptor?) {
    let image = style?.image
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

    // A new color or border keeps the image already drawn, with no reload or fallback flash.
    let keepsImage = backgroundImage != nil && next.backgroundImageKey == appearance.backgroundImageKey
    appearance = next
    if keepsImage {
      onChange?.invoke()
      return
    }
    loadGeneration += 1
    backgroundImage = image.flatMap(MarkerImageLoader.cachedImage(for:))
    if let image, backgroundImage == nil {
      let generation = loadGeneration
      MarkerImageLoader.load(image) { [weak self] loaded in
        guard let self, let loaded, generation == self.loadGeneration else {
          return
        }
        self.backgroundImage = loaded
        self.onChange?()
      }
    }
    onChange?()
  }

  func image(count: Int) -> UIImage {
    guard let backgroundImage else {
      return ClusterBadgeRenderer.image(count: count, appearance: appearance.withoutBackgroundImage)
    }
    return ClusterBadgeRenderer.image(count: count, appearance: appearance, backgroundImage: backgroundImage)
  }
}

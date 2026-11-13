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
  /// The style's image while it is not drawn yet, waiting for clustering or loading.
  private var styleImage: MarkerImage?
  /// What the largest badge draws an image at, which bounds one that declares no size.
  private let maximumImagePixelSize = ClusterBadgeMetrics.diameter(for: .max) * UIScreen.main.scale

  /// A map that does not cluster draws no badge, so its image waits until clustering is on
  /// instead of taking the image loader from the marker icons.
  var clusteringEnabled = false {
    didSet {
      if clusteringEnabled, !oldValue {
        loadImageIfNeeded()
      }
    }
  }

  func setStyle(_ style: ClusterStyleDescriptor?) {
    let image = style?.image.flatMap(Self.badgeImage)
    let next = ClusterBadgeAppearance(
      // A fill that does not parse keeps the default gradient, as on Android.
      backgroundColor: style?.backgroundColor.flatMap { $0.toHexColorComponents() == nil ? nil : $0 },
      textColor: style?.textColor,
      borderColor: style?.borderColor,
      borderWidth: style?.borderWidth,
      backgroundImageKey: image.map {
        MarkerImageLoader.cacheKey(for: $0, maximumPixelSize: maximumImagePixelSize) as String
      }
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
    backgroundImage = image.flatMap {
      MarkerImageLoader.cachedImage(for: $0, maximumPixelSize: maximumImagePixelSize)
    }
    pendingImageKey = nil
    styleImage = backgroundImage == nil ? image : nil
    loadImageIfNeeded()
    onChange?()
  }

  private func loadImageIfNeeded() {
    guard clusteringEnabled, pendingImageKey == nil, let image = styleImage else {
      return
    }
    let generation = loadGeneration
    pendingImageKey = appearance.backgroundImageKey
    MarkerImageLoader.load(image, maximumPixelSize: maximumImagePixelSize) { [weak self] loaded in
      guard let self, generation == self.loadGeneration else {
        return
      }
      self.pendingImageKey = nil
      self.styleImage = nil
      guard let loaded else {
        return
      }
      self.backgroundImage = loaded
      self.onChange?()
    }
  }

  /// `image` with its declared size bounded to the largest badge, which is all a badge draws.
  /// One that declares no size is bounded by `maximumImagePixelSize` as it decodes; one that
  /// declares a size that is not positive and finite is dropped for the default badge.
  private static func badgeImage(_ image: MarkerImage) -> MarkerImage? {
    guard let width = image.width, let height = image.height else {
      return image
    }
    guard
      let size = ClusterBadgeStyle.fittedImageSize(
        width: width,
        height: height,
        diameter: ClusterBadgeMetrics.diameter(for: .max)
      )
    else {
      return nil
    }
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

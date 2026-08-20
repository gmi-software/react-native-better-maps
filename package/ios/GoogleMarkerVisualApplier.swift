import GoogleMaps
import UIKit

/// Applies a marker descriptor's visual fields onto a `GMSMarker`. Main-thread only.
final class GoogleMarkerVisualApplier {
  private static let defaultIconToken: NSString = "__default__"
  private static let defaultPinImage = GMSMarker.markerImage(with: nil)

  private let appliedTokens = NSMapTable<GMSMarker, NSString>.weakToStrongObjects()
  private let pendingTokens = NSMapTable<GMSMarker, NSString>.weakToStrongObjects()

  func apply(_ descriptor: MarkerDescriptor, to marker: GMSMarker) {
    marker.rotation = descriptor.rotation ?? 0
    marker.isFlat = descriptor.flat == true
    marker.opacity = Float(descriptor.opacity ?? 1)
    applyIcon(descriptor, to: marker)
  }

  private func applyIcon(_ descriptor: MarkerDescriptor, to marker: GMSMarker) {
    guard let image = descriptor.image else {
      pendingTokens.removeObject(forKey: marker)
      if appliedTokens.object(forKey: marker) != Self.defaultIconToken {
        marker.icon = nil
        appliedTokens.setObject(Self.defaultIconToken, forKey: marker)
      }
      marker.groundAnchor = descriptor.effectiveGoogleMapsAnchor(
        imageSize: Self.defaultPinImage.size
      )
      return
    }

    let token = MarkerImageLoader.cacheKey(for: image)
    if appliedTokens.object(forKey: marker) == token, let icon = marker.icon {
      marker.groundAnchor = descriptor.effectiveGoogleMapsAnchor(imageSize: icon.size)
      return
    }

    if let cached = MarkerImageLoader.cachedImage(for: image) {
      pendingTokens.removeObject(forKey: marker)
      setIcon(cached, token: token, on: marker, descriptor: descriptor)
      return
    }

    marker.groundAnchor = descriptor.effectiveGoogleMapsAnchor(imageSize: .zero)
    pendingTokens.setObject(token, forKey: marker)
    MarkerImageLoader.load(image) { [weak self, weak marker] uiImage in
      guard let self, let marker, self.pendingTokens.object(forKey: marker) == token else {
        return
      }
      self.pendingTokens.removeObject(forKey: marker)
      guard let uiImage else {
        return
      }
      self.setIcon(uiImage, token: token, on: marker, descriptor: descriptor)
    }
  }

  private func setIcon(
    _ uiImage: UIImage,
    token: NSString,
    on marker: GMSMarker,
    descriptor: MarkerDescriptor
  ) {
    marker.icon = uiImage
    marker.groundAnchor = descriptor.effectiveGoogleMapsAnchor(imageSize: uiImage.size)
    appliedTokens.setObject(token, forKey: marker)
  }
}

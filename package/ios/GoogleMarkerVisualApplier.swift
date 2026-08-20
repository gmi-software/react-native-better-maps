import GoogleMaps
import UIKit

/// Applies a marker descriptor's visual fields onto a `GMSMarker`. Main-thread only.
final class GoogleMarkerVisualApplier {
  private static let defaultIconToken: NSString = "__default__"
  private static let defaultPinImage = GMSMarker.markerImage(with: nil)

  private struct PendingIconLoad {
    let imageToken: NSString
    var descriptor: MarkerDescriptor
  }

  private final class MarkerIconState: NSObject {
    var appliedImageToken: NSString?
    var loadGeneration = 0
    var pending: PendingIconLoad?
  }

  private let states = NSMapTable<GMSMarker, MarkerIconState>.weakToStrongObjects()
  private let cachedImage: (MarkerImage) -> UIImage?
  private let loadImage: (MarkerImage, @escaping (UIImage?) -> Void) -> Void

  init(
    cachedImage: @escaping (MarkerImage) -> UIImage? = MarkerImageLoader.cachedImage(for:),
    loadImage: @escaping (MarkerImage, @escaping (UIImage?) -> Void) -> Void = {
      MarkerImageLoader.load($0, completion: $1)
    }
  ) {
    self.cachedImage = cachedImage
    self.loadImage = loadImage
  }

  func apply(_ descriptor: MarkerDescriptor, to marker: GMSMarker) {
    marker.rotation = descriptor.rotation ?? 0
    marker.isFlat = descriptor.flat == true
    marker.opacity = Float(descriptor.opacity ?? 1)
    applyAnchor(descriptor, to: marker)
    applyIcon(descriptor, to: marker)
  }

  private func applyAnchor(_ descriptor: MarkerDescriptor, to marker: GMSMarker) {
    marker.groundAnchor = descriptor.effectiveGoogleMapsAnchor(
      imageSize: anchorImageSize(descriptor, icon: marker.icon)
    )
  }

  private func applyIcon(_ descriptor: MarkerDescriptor, to marker: GMSMarker) {
    let state = state(for: marker)

    guard let image = descriptor.image else {
      cancelPending(state)
      if state.appliedImageToken != Self.defaultIconToken {
        marker.icon = nil
        state.appliedImageToken = Self.defaultIconToken
      }
      return
    }

    let imageToken = MarkerImageLoader.cacheKey(for: image)
    if state.appliedImageToken == imageToken, marker.icon != nil {
      if state.pending != nil {
        cancelPending(state)
      }
      return
    }

    if var pending = state.pending, pending.imageToken == imageToken {
      pending.descriptor = descriptor
      state.pending = pending
      return
    }

    if let cached = cachedImage(image) {
      cancelPending(state)
      setIcon(cached, token: imageToken, on: marker, descriptor: descriptor, state: state)
      return
    }

    cancelPending(state)
    let generation = state.loadGeneration
    state.pending = PendingIconLoad(imageToken: imageToken, descriptor: descriptor)
    loadImage(image) { [weak self, weak marker] uiImage in
      guard let self, let marker, let state = self.states.object(forKey: marker) else {
        return
      }
      guard state.loadGeneration == generation, let pending = state.pending else {
        return
      }
      state.pending = nil
      guard let uiImage else {
        return
      }
      self.setIcon(
        uiImage,
        token: pending.imageToken,
        on: marker,
        descriptor: pending.descriptor,
        state: state
      )
    }
  }

  private func setIcon(
    _ uiImage: UIImage,
    token: NSString,
    on marker: GMSMarker,
    descriptor: MarkerDescriptor,
    state: MarkerIconState
  ) {
    marker.icon = uiImage
    applyAnchor(descriptor, to: marker)
    state.appliedImageToken = token
  }

  private func state(for marker: GMSMarker) -> MarkerIconState {
    if let existing = states.object(forKey: marker) {
      return existing
    }
    let created = MarkerIconState()
    states.setObject(created, forKey: marker)
    return created
  }

  private func cancelPending(_ state: MarkerIconState) {
    state.loadGeneration += 1
    state.pending = nil
  }

  private func anchorImageSize(_ descriptor: MarkerDescriptor, icon: UIImage?) -> CGSize {
    if let image = descriptor.image, let width = image.width, let height = image.height,
       width > 0, height > 0
    {
      return CGSize(width: width, height: height)
    }
    if descriptor.image == nil {
      return Self.defaultPinImage.size
    }
    if let icon, icon.size.width > 0, icon.size.height > 0 {
      return icon.size
    }
    return Self.defaultPinImage.size
  }
}

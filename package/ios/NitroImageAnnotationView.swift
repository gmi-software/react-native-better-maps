import MapKit
import UIKit

/// Bitmap marker annotation view.
final class NitroImageAnnotationView: MKAnnotationView {
  static let reuseIdentifier = "NitroImage"

  private var loadToken: NSString?
  /// Identifies the latest image request. A completion from an older request is ignored.
  private var loadGeneration = 0
  /// MapKit sets `annotation` on dequeue, before `configure(for:)`, so it cannot tell a reuse.
  private weak var configuredMarker: MapMarkerAnnotation?

  override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
    super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
    canShowCallout = false
    collisionMode = .rectangle
    displayPriority = .required
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func configure(for marker: MapMarkerAnnotation) {
    let isSameAnnotation = configuredMarker === marker
    annotation = marker
    configuredMarker = marker
    isDraggable = marker.draggable
    canShowCallout = marker.title != nil || marker.subtitle != nil
    alpha = marker.opacity
    zPriority =
      marker.zIndex.map {
        MKAnnotationViewZPriority(rawValue: Float($0))
      } ?? .defaultUnselected

    guard let imageDescriptor = marker.image else {
      loadToken = nil
      self.image = nil
      centerOffset = marker.centerOffset(forImageSize: .zero)
      return
    }

    let token = MarkerImageLoader.cacheKey(for: imageDescriptor)
    // Only for the same marker: on a reused view the token may belong to a load that left the
    // previous marker's image showing.
    if loadToken == token, isSameAnnotation {
      applyLayout(for: marker, imageSize: self.image?.size ?? .zero)
      return
    }

    loadToken = token
    loadGeneration += 1
    let generation = loadGeneration
    if let cached = MarkerImageLoader.cachedImage(for: imageDescriptor) {
      self.image = cached
      applyLayout(for: marker, imageSize: cached.size)
      return
    }

    // A swap on the same marker keeps the current image until the new one is ready, so it does
    // not blink. A reused view must not show the previous marker's image.
    if !isSameAnnotation {
      self.image = nil
    }
    applyLayout(for: marker, imageSize: self.image?.size ?? .zero)

    MarkerImageLoader.load(imageDescriptor) { [weak self] uiImage in
      guard let self else { return }
      // A reused view can start a second load for the same image; the older one must not win.
      guard generation == self.loadGeneration else { return }

      guard let marker = self.annotation as? MapMarkerAnnotation,
        let image = marker.image,
        MarkerImageLoader.cacheKey(for: image) == token
      else {
        if self.loadToken == token {
          self.loadToken = nil
        }
        return
      }

      if uiImage == nil, self.loadToken == token {
        self.loadToken = nil
      }

      self.image = uiImage
      self.applyLayout(for: marker, imageSize: uiImage?.size ?? .zero)
    }
  }

  private func applyLayout(for marker: MapMarkerAnnotation, imageSize: CGSize) {
    centerOffset = marker.centerOffset(forImageSize: imageSize)

    let rotation = marker.rotation ?? 0
    transform =
      marker.flat != true && rotation != 0
      ? CGAffineTransform(rotationAngle: rotation * .pi / 180)
      : .identity
  }
}

import MapKit
import UIKit

/// Bitmap marker annotation view.
final class NitroImageAnnotationView: MKAnnotationView {
  static let reuseIdentifier = "NitroImage"

  private var loadToken: NSString?

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
    annotation = marker
    isDraggable = marker.draggable
    canShowCallout = marker.title != nil || marker.subtitle != nil
    alpha = marker.opacity
    zPriority = marker.zIndex.map {
      MKAnnotationViewZPriority(rawValue: Float($0))
    } ?? .defaultUnselected

    guard let imageDescriptor = marker.image else {
      loadToken = nil
      self.image = nil
      centerOffset = marker.centerOffset(forImageSize: .zero)
      return
    }

    let token = MarkerImageLoader.cacheKey(for: imageDescriptor)
    if loadToken == token {
      applyLayout(for: marker, imageSize: self.image?.size ?? .zero)
      return
    }

    loadToken = token
    self.image = nil
    applyLayout(for: marker, imageSize: .zero)

    MarkerImageLoader.load(imageDescriptor) { [weak self] uiImage in
      guard let self else { return }

      guard let marker = self.annotation as? MapMarkerAnnotation,
            let image = marker.image,
            MarkerImageLoader.cacheKey(for: image) == token else {
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
    transform = marker.flat != true && rotation != 0
      ? CGAffineTransform(rotationAngle: rotation * .pi / 180)
      : .identity
  }
}

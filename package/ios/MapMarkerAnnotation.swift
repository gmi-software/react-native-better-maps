import MapKit

/// MapKit annotation backed by a marker descriptor.
final class MapMarkerAnnotation: NSObject, MKAnnotation {
  let id: String
  var draggable: Bool
  var isClusterable: Bool
  private(set) var image: MarkerImage?
  private(set) var markerColor: String?
  private(set) var anchor: MarkerAnchor?
  private(set) var centerOffset: MarkerPoint?
  private(set) var rotation: Double?
  private(set) var flat: Bool?
  private(set) var opacity: CGFloat
  private(set) var zIndex: Double?
  let enteringAnimation: ResolvedOverlayEnteringAnimation

  @objc dynamic var coordinate: CLLocationCoordinate2D
  @objc dynamic var title: String?
  @objc dynamic var subtitle: String?

  init(
    descriptor: MarkerDescriptor,
    enteringAnimation: ResolvedOverlayEnteringAnimation
  ) {
    id = descriptor.id
    self.enteringAnimation = enteringAnimation
    coordinate = CLLocationCoordinate2D(
      latitude: descriptor.coordinate.latitude,
      longitude: descriptor.coordinate.longitude
    )
    title = descriptor.title
    subtitle = descriptor.subtitle
    draggable = descriptor.draggable ?? false
    isClusterable = descriptor.clusterable ?? true
    image = descriptor.image
    markerColor = descriptor.markerColor
    anchor = descriptor.anchor
    centerOffset = descriptor.centerOffset
    rotation = descriptor.rotation
    flat = descriptor.flat
    opacity = CGFloat(descriptor.opacity ?? 1)
    zIndex = descriptor.zIndex
  }

  @discardableResult
  func update(from descriptor: MarkerDescriptor) -> Bool {
    coordinate = CLLocationCoordinate2D(
      latitude: descriptor.coordinate.latitude,
      longitude: descriptor.coordinate.longitude
    )

    let titleChanged = title != descriptor.title
    let subtitleChanged = subtitle != descriptor.subtitle
    let nextDraggable = descriptor.draggable ?? false
    let draggableChanged = draggable != nextDraggable
    let nextClusterable = descriptor.clusterable ?? true
    let clusterableChanged = isClusterable != nextClusterable

    title = descriptor.title
    subtitle = descriptor.subtitle
    draggable = nextDraggable
    isClusterable = nextClusterable

    let imageChanged = switch (image, descriptor.image) {
    case (nil, nil): false
    case let (current?, next?):
      MarkerImageLoader.cacheKey(for: current) != MarkerImageLoader.cacheKey(for: next)
    default: true
    }
    let markerColorChanged = markerColor != descriptor.markerColor
    let anchorChanged = anchor?.x != descriptor.anchor?.x || anchor?.y != descriptor.anchor?.y
    let centerOffsetChanged = centerOffset?.x != descriptor.centerOffset?.x
      || centerOffset?.y != descriptor.centerOffset?.y
    let rotationChanged = rotation != descriptor.rotation
    let flatChanged = flat != descriptor.flat
    let opacityChanged = opacity != CGFloat(descriptor.opacity ?? 1)
    let zIndexChanged = zIndex != descriptor.zIndex

    image = descriptor.image
    markerColor = descriptor.markerColor
    anchor = descriptor.anchor
    centerOffset = descriptor.centerOffset
    rotation = descriptor.rotation
    flat = descriptor.flat
    opacity = CGFloat(descriptor.opacity ?? 1)
    zIndex = descriptor.zIndex

    return titleChanged
      || subtitleChanged
      || draggableChanged
      || clusterableChanged
      || imageChanged
      || markerColorChanged
      || anchorChanged
      || centerOffsetChanged
      || rotationChanged
      || flatChanged
      || opacityChanged
      || zIndexChanged
  }

  func centerOffset(forImageSize imageSize: CGSize) -> CGPoint {
    let anchorX = anchor?.x ?? 0.5
    let anchorY = anchor?.y ?? 1.0
    var offsetX = (0.5 - anchorX) * imageSize.width
    var offsetY = (0.5 - anchorY) * imageSize.height

    if let centerOffset {
      offsetX += centerOffset.x
      offsetY += centerOffset.y
    }

    return CGPoint(x: offsetX, y: offsetY)
  }
}

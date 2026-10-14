import UIKit

@_silgen_name("NitroMapsPublishMarkerProjection")
private func publishMarkerProjection(_ tag: Int32, _ x: Float, _ y: Float)

@_silgen_name("NitroMapsClearMarkerProjection")
private func clearMarkerProjection(_ tag: Int32)

/// Content view of a live `MarkerView`. Fabric mounts the marker's JSX here and
/// keeps owning it; only the outer component view is moved, by a transform.
final class NitroMarkerContentView: UIView {
  var coordinate: Coordinate?
  var anchor: MarkerAnchor?

  /// The Fabric component view this content belongs to; set while mounted in a map.
  weak var host: UIView?
  weak var container: NitroMapContainerView?

  private var publishedTag: Int32 = 0
  private var publishedOrigin = CGPoint(x: CGFloat.nan, y: CGFloat.nan)

  override init(frame: CGRect) {
    super.init(frame: frame)
    clipsToBounds = true
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  @objc(nitroMountChild:atIndex:)
  func mountFabricChild(_ child: UIView, at index: Int) {
    insertSubview(child, at: index)
  }

  @objc(nitroUnmountChild:)
  func unmountFabricChild(_ child: UIView) {
    child.removeFromSuperview()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    // Fabric resized the host; its anchor point moved with it.
    updatePosition(projection: container?.makeProjection?())
  }

  /// Places the host for `projection`, the camera's current one. A marker off
  /// screen is hidden, which also takes it out of hit-testing and drawing.
  func updatePosition(projection: MarkerProjection?) {
    guard let host, let container else {
      return
    }
    let size = host.bounds.size
    guard let coordinate,
      let point = projection?(coordinate),
      point.x.isFinite, point.y.isFinite,
      size.width > 0, size.height > 0
    else {
      setHidden(true, host: host)
      return
    }

    // Snapped to the pixel grid, as MapKit does for annotation views: a
    // fractional origin resamples the layer and blurs text in the marker.
    let scale = max(1, traitCollection.displayScale)
    let origin = CGPoint(
      x: ((point.x - size.width * CGFloat(anchor?.x ?? 0.5)) * scale).rounded() / scale,
      y: ((point.y - size.height * CGFloat(anchor?.y ?? 1)) * scale).rounded() / scale
    )
    let isOnScreen = CGRect(origin: origin, size: size).intersects(container.bounds)
    setHidden(!isOnScreen, host: host)
    guard isOnScreen else {
      return
    }

    let offset = container.hostOffset
    let transform = CGAffineTransform(translationX: origin.x + offset.x, y: origin.y + offset.y)
    if host.transform != transform {
      host.transform = transform
    }
    publish(origin, tag: Int32(truncatingIfNeeded: host.tag))
  }

  /// Unmounted from the map: forget the projection and leave the component
  /// view as Fabric laid it out.
  func detach() {
    clearPublishedProjection()
    host?.transform = .identity
    host?.isHidden = false
    host = nil
    container = nil
  }

  private func setHidden(_ hidden: Bool, host: UIView) {
    if host.isHidden != hidden {
      host.isHidden = hidden
    }
    if hidden {
      clearPublishedProjection()
    }
  }

  /// Hands the translation to the shadow node, so `measure()` reports the
  /// marker where it is drawn. Written only when it changed.
  private func publish(_ origin: CGPoint, tag: Int32) {
    guard tag > 0, tag != publishedTag || origin != publishedOrigin else {
      return
    }
    if publishedTag > 0 && publishedTag != tag {
      clearMarkerProjection(publishedTag)
    }
    publishMarkerProjection(tag, Float(origin.x), Float(origin.y))
    publishedTag = tag
    publishedOrigin = origin
  }

  private func clearPublishedProjection() {
    guard publishedTag > 0 else {
      return
    }
    clearMarkerProjection(publishedTag)
    publishedTag = 0
    publishedOrigin = CGPoint(x: CGFloat.nan, y: CGFloat.nan)
  }
}

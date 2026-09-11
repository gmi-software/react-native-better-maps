import UIKit

/// Owns Fabric children for their entire lifetime. Only the outer host moves.
final class NitroMarkerContentView: UIView {
  var coordinate: Coordinate?
  var anchor: MarkerAnchor?
  weak var mapContainer: NitroMapContainerView?
  weak var fabricHost: UIView?

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
    updatePosition()
  }

  func updatePosition() {
    guard let host = fabricHost, let map = mapContainer else { return }
    guard let coordinate, let point = map.projectCoordinate?(coordinate),
          point.x.isFinite, point.y.isFinite,
          host.bounds.width > 0, host.bounds.height > 0 else {
      host.isHidden = true
      return
    }
    let x = point.x - host.bounds.width * CGFloat(anchor?.x ?? 0.5)
    let y = point.y - host.bounds.height * CGFloat(anchor?.y ?? 1)
    let projectedFrame = CGRect(origin: CGPoint(x: x, y: y), size: host.bounds.size)
    let visible = projectedFrame.intersects(map.bounds)
    host.isHidden = !visible
    if visible {
      let transform = CGAffineTransform(translationX: x, y: y)
      if host.transform != transform { host.transform = transform }
    }
  }
}

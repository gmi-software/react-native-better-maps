import UIKit

/// The SDK surface and live Fabric hosts share this native coordinate space.
final class NitroMapContainerView: UIView {
  var projectCoordinate: ((Coordinate) -> CGPoint?)?
  private var markerContents: [NitroMarkerContentView] = []

  override init(frame: CGRect) {
    super.init(frame: frame)
    clipsToBounds = true
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) is unsupported") }

  weak var mapSurface: UIView? {
    didSet {
      guard oldValue !== mapSurface else { return }
      // Provider replacement keeps the same Fabric children and React state.
      // Also handles children mounted before the provider surface is ready.
      let surface = mapSurface ?? self
      for marker in markerContents {
        if let host = marker.fabricHost { surface.addSubview(host) }
      }
      updateMarkerPositions()
    }
  }

  @objc(nitroMountChild:atIndex:)
  func mountFabricChild(_ child: UIView, at index: Int) {
    let surface = mapSurface ?? self
    let next = markerContents.indices.contains(index) ? markerContents[index].fabricHost : nil
    if let next { surface.insertSubview(child, belowSubview: next) }
    else { surface.addSubview(child) }
    guard let content = child.subviews.first(where: { $0 is NitroMarkerContentView })
      as? NitroMarkerContentView else { return }
    content.mapContainer = self
    content.fabricHost = child
    markerContents.insert(content, at: index)
    content.updatePosition()
  }

  @objc(nitroUnmountChild:)
  func unmountFabricChild(_ child: UIView) {
    if let index = markerContents.firstIndex(where: { $0.fabricHost === child }) {
      let content = markerContents.remove(at: index)
      content.mapContainer = nil
      content.fabricHost = nil
      child.transform = .identity
      child.isHidden = false
    }
    child.removeFromSuperview()
  }

  func containsMarker(at point: CGPoint) -> Bool {
    markerContents.contains { marker in
      guard let host = marker.fabricHost, !host.isHidden else { return false }
      return host.frame.contains(point)
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    updateMarkerPositions()
  }

  func updateMarkerPositions() {
    // No timers, snapshots, or JS callbacks; an empty marker list costs no work.
    UIView.performWithoutAnimation {
      for marker in markerContents { marker.updatePosition() }
    }
  }
}

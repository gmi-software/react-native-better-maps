import UIKit

/// Projects coordinates for one pass over the live markers. Built once per
/// camera frame, so a provider can reuse one projection snapshot for every host.
typealias MarkerProjection = (Coordinate) -> CGPoint?

/// The view `HybridMapView` hands to Fabric. It holds the provider's map view
/// and the live `MarkerView` hosts that Fabric mounts into the map.
///
/// Hosts go inside the view that owns the SDK's pan recognizer - for MapKit an
/// internal content view, not `MKMapView` itself - so a drag that starts on a
/// marker still pans the map. They stay in Fabric's hierarchy: nothing is
/// reparented into SDK annotation views or snapshotted.
final class NitroMapContainerView: UIView {
  /// Returns the projection for the current camera, or nil while the provider
  /// has no map to project with.
  var makeProjection: (() -> MarkerProjection?)? {
    didSet { updateMarkerPositions() }
  }

  private var markerHosts: [MarkerHost] = []
  private var lastTouchStartedOnMarker = false
  private weak var resolvedHostParent: UIView?

  /// Where the hosts are subviews: the SDK's gesture-owning view, else the map
  /// view, else this view while there is no map.
  private var hostParent: UIView {
    resolvedHostParent ?? mapSurface ?? self
  }

  /// Where the map view's origin is in `hostParent`. Projections are in map
  /// view coordinates; the host transform is in `hostParent`'s.
  private(set) var hostOffset: CGPoint = .zero

  /// The provider's map view. Hosts mounted before it exists, or kept across a
  /// provider switch, move into the new one with their React state intact.
  weak var mapSurface: UIView? {
    didSet {
      guard oldValue !== mapSurface else {
        return
      }
      resolveHostParent()
    }
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    clipsToBounds = true
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  /// Whether the touch sequence in progress began on a live marker. Map taps,
  /// POI selection and SDK marker taps beneath a live marker check it, since
  /// the SDK's own recognizers see every touch inside the map view.
  var touchStartedOnMarker: Bool {
    lastTouchStartedOnMarker
  }

  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    let hit = super.hitTest(point, with: event)
    if event?.type == .touches {
      lastTouchStartedOnMarker = containsMarker(at: point)
    }
    return hit
  }

  @objc(nitroMountChild:atIndex:)
  func mountFabricChild(_ child: UIView, at index: Int) {
    guard let content = child.subviews.lazy.compactMap({ $0 as? NitroMarkerContentView }).first else {
      // Only MarkerView hosts are rendered into a MapView.
      return
    }
    if markerHosts.indices.contains(index) {
      hostParent.insertSubview(child, belowSubview: markerHosts[index].view)
    } else {
      hostParent.addSubview(child)
    }
    let host = MarkerHost(view: child, content: content)
    content.host = child
    content.container = self
    markerHosts.insert(host, at: min(index, markerHosts.count))
    content.updatePosition(projection: makeProjection?())
  }

  @objc(nitroUnmountChild:)
  func unmountFabricChild(_ child: UIView) {
    if let index = markerHosts.firstIndex(where: { $0.view === child }) {
      let host = markerHosts.remove(at: index)
      host.content.detach()
    }
    child.removeFromSuperview()
  }

  /// Whether `point`, in this view's coordinates, is on a visible live marker.
  func containsMarker(at point: CGPoint) -> Bool {
    let parent = hostParent
    let parentPoint = parent === self ? point : convert(point, to: parent)
    return markerHosts.contains { host in
      !host.view.isHidden && host.view.frame.contains(parentPoint)
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    if let mapSurface, resolvedHostParent == nil || hostOffset != Self.offset(of: mapSurface, in: hostParent) {
      // The SDK may build its gesture-owning view or lay it out late.
      resolveHostParent()
    } else {
      updateMarkerPositions()
    }
  }

  private func resolveHostParent() {
    let parent = mapSurface.map(Self.gestureOwner(in:)) ?? self
    resolvedHostParent = parent === self ? nil : parent
    hostOffset = mapSurface.map { Self.offset(of: $0, in: parent) } ?? .zero
    for host in markerHosts where host.view.superview !== parent {
      parent.addSubview(host.view)
    }
    updateMarkerPositions()
  }

  private static func offset(of surface: UIView, in parent: UIView) -> CGPoint {
    parent === surface ? .zero : surface.convert(CGPoint.zero, to: parent)
  }

  /// The first view, breadth first from `surface`, whose recognizers pan the
  /// map. MapKit keeps them on a content view inside `MKMapView`; a host that
  /// is not inside that view would swallow every drag that starts on it.
  private static func gestureOwner(in surface: UIView) -> UIView {
    var level: [UIView] = [surface]
    for _ in 0..<4 {
      if let owner = level.first(where: { view in
        view.gestureRecognizers?.contains { $0 is UIPanGestureRecognizer } == true
      }) {
        return owner
      }
      level = level.flatMap(\.subviews)
    }
    return surface
  }

  /// Repositions every host for the current camera. Called on every camera
  /// frame: one projection, a transform per host that moved, no JS.
  func updateMarkerPositions() {
    guard !markerHosts.isEmpty else {
      return
    }
    let projection = makeProjection?()
    UIView.performWithoutAnimation {
      for host in markerHosts {
        host.content.updatePosition(projection: projection)
      }
    }
  }
}

private struct MarkerHost {
  /// The Fabric component view; the one that moves.
  let view: UIView
  /// Its content view, which owns the marker's coordinate and anchor.
  let content: NitroMarkerContentView
}

extension UIView {
  /// Whether the touch in progress began on a live marker drawn over this map
  /// view. The SDK sees that touch too; a tap meant for the marker must not
  /// also press the map, a POI or an SDK marker beneath it.
  var touchStartedOnLiveMarker: Bool {
    (superview as? NitroMapContainerView)?.touchStartedOnMarker == true
  }
}

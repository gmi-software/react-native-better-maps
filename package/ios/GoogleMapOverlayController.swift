#if canImport(GoogleMaps)
import GoogleMaps
import MapKit
import UIKit

/// Reconciles overlay descriptors with Google Maps objects.
final class GoogleMapOverlayController {
  private static let clusterCellPoints: Double = 96
  // GMSMarker entering animations are main-thread work; cap them per diff so
  // bulk viewport refreshes do not block active Google Maps gestures.
  private static let maximumAnimatedMarkersPerDiff = 96

  private enum MarkerPayload {
    case marker(String)
    case cluster(memberIds: [String], region: MKCoordinateRegion)
  }

  private struct MarkerAnimationBatch {
    let animation: ResolvedOverlayEnteringAnimation
    var markers: [GMSMarker]
  }

  private weak var mapView: GMSMapView?
  private var markers: [String: GMSMarker] = [:]
  private var markerVersions: [String: Int] = [:]
  private var polylines: [String: GMSPolyline] = [:]
  private var polygons: [String: GMSPolygon] = [:]
  private var circles: [String: GMSCircle] = [:]
  private let markerPipeline: MarkerRenderPipeline
  private let visualApplier = GoogleMarkerVisualApplier()
  private var clusterIconCache: [String: UIImage] = [:]

  var onMarkerPress: ((String) -> Void)?
  var onMarkerDragEnd: ((String, Coordinate) -> Void)?
  var onPolylinePress: ((String) -> Void)?
  var onPolygonPress: ((String) -> Void)?
  var onCirclePress: ((String) -> Void)?
  var onClusterPress: (([String], Coordinate) -> Void)?
  var animateToClusterRegion: ((MKCoordinateRegion) -> Void)?
  var markerEnteringAnimation: OverlayEnteringAnimationDescriptor?
  var clusterEnteringAnimation: OverlayEnteringAnimationDescriptor?

  init(mapView: GMSMapView) {
    self.mapView = mapView
    markerPipeline = MarkerRenderPipeline(clusterCellPoints: Self.clusterCellPoints)
  }

  private var usesViewportPipeline: Bool {
    markerPipeline.usesViewportPipeline
  }

  func reset() {
    markerPipeline.reset()
    clearMarkers()
    clearShapes()
  }

  func setClusteringEnabled(_ enabled: Bool) {
    guard markerPipeline.setClusteringEnabled(enabled) else {
      return
    }
    reapplyMarkers()
  }

  func setMarkers(_ descriptors: [MarkerDescriptor]?) {
    guard markerPipeline.setMarkers(descriptors) else {
      return
    }
    reapplyMarkers()
  }

  func refreshViewportMarkers(
    animateEntering: Bool = true,
    animationBudget: Int = maximumAnimatedMarkersPerDiff
  ) {
    guard let mapView, usesViewportPipeline else {
      return
    }

    markerPipeline.refreshNow(
      displayedVersions: markerVersions,
      region: mapView.currentNitroRegion().toMKCoordinateRegion(),
      viewSize: mapView.bounds.size,
      apply: { [weak self] diff in
        self?.applyDiff(
          diff,
          animateEntering: animateEntering,
          animationBudget: animationBudget
        )
      }
    )
  }

  func scheduleViewportRefresh(
    immediate: Bool = false,
    animateEntering: Bool = true,
    animationBudget: Int = maximumAnimatedMarkersPerDiff
  ) {
    guard let mapView, usesViewportPipeline else {
      return
    }

    markerPipeline.scheduleViewportRefresh(
      displayedVersions: markerVersions,
      region: mapView.currentNitroRegion().toMKCoordinateRegion(),
      viewSize: mapView.bounds.size,
      immediate: immediate,
      apply: { [weak self] diff in
        self?.applyDiff(
          diff,
          animateEntering: animateEntering,
          animationBudget: animationBudget
        )
      }
    )
  }

  func handleMarkerTap(_ marker: GMSMarker) -> Bool {
    switch marker.userData as? MarkerPayload {
    case let .marker(id):
      onMarkerPress?(id)
      return marker.title == nil && marker.snippet == nil
    case let .cluster(memberIds, region):
      onClusterPress?(
        memberIds,
        Coordinate(latitude: marker.position.latitude, longitude: marker.position.longitude)
      )
      animateToClusterRegion?(region)
      return true
    case .none:
      return false
    }
  }

  func handleMarkerDragEnd(_ marker: GMSMarker) {
    guard case let .marker(id) = marker.userData as? MarkerPayload else {
      return
    }

    onMarkerDragEnd?(
      id,
      Coordinate(latitude: marker.position.latitude, longitude: marker.position.longitude)
    )
  }

  func handleOverlayTap(_ overlay: GMSOverlay) {
    guard let id = overlay.userData as? String else {
      return
    }

    if overlay is GMSPolyline {
      onPolylinePress?(id)
    } else if overlay is GMSPolygon {
      onPolygonPress?(id)
    } else if overlay is GMSCircle {
      onCirclePress?(id)
    }
  }

  func updatePolylines(_ descriptors: [PolylineDescriptor]?) {
    reconcile(
      current: &polylines,
      next: descriptors ?? [],
      make: makePolyline,
      update: updatePolyline
    )
  }

  func updatePolygons(_ descriptors: [PolygonDescriptor]?) {
    reconcile(
      current: &polygons,
      next: descriptors ?? [],
      make: makePolygon,
      update: updatePolygon
    )
  }

  func updateCircles(_ descriptors: [CircleDescriptor]?) {
    reconcile(
      current: &circles,
      next: descriptors ?? [],
      make: makeCircle,
      update: updateCircle
    )
  }

  private func reapplyMarkers() {
    guard let mapView else {
      return
    }

    markerPipeline.reapply(
      displayedVersions: markerVersions,
      region: mapView.currentNitroRegion().toMKCoordinateRegion(),
      viewSize: mapView.bounds.size,
      apply: { [weak self] diff in
        self?.applyDiff(diff)
      }
    )
  }

  private func applyDiff(
    _ diff: MarkerRenderDiff,
    animateEntering: Bool = true,
    animationBudget: Int = maximumAnimatedMarkersPerDiff
  ) {
    guard let mapView else {
      return
    }

    for key in diff.removedKeys {
      markers.removeValue(forKey: key)?.map = nil
      markerVersions.removeValue(forKey: key)
    }

    var animationBatches: [MarkerAnimationBatch] = []
    var remainingAnimationBudget = animateEntering ? max(0, animationBudget) : 0

    for entry in diff.added {
      let marker = GMSMarker()
      updateMarker(marker, with: entry.element)
      let animation = enteringAnimation(for: entry.element)
      let shouldAnimate = animateEntering
        && remainingAnimationBudget > 0
        && OverlayEnteringAnimationResolver.canAnimateGoogleMarker(animation)

      if shouldAnimate {
        OverlayEnteringAnimationResolver.prepareGoogleMarker(marker, animation: animation)
        if OverlayEnteringAnimationResolver.usesBatchedGoogleMarkerAnimation(animation) {
          append(marker, animation: animation, to: &animationBatches)
        }
        remainingAnimationBudget -= 1
      } else {
        OverlayEnteringAnimationResolver.showGoogleMarkerWithoutAnimation(marker)
      }
      marker.map = mapView
      markers[entry.key] = marker
      markerVersions[entry.key] = entry.version
    }

    for batch in animationBatches {
      OverlayEnteringAnimationResolver.animateGoogleMarkers(batch.markers, animation: batch.animation)
    }

    for entry in diff.retained {
      guard let marker = markers[entry.key] else {
        continue
      }
      updateMarker(marker, with: entry.element)
      markerVersions[entry.key] = entry.version
    }
  }

  private func append(
    _ marker: GMSMarker,
    animation: ResolvedOverlayEnteringAnimation,
    to batches: inout [MarkerAnimationBatch]
  ) {
    for index in batches.indices where batches[index].animation == animation {
      batches[index].markers.append(marker)
      return
    }
    batches.append(MarkerAnimationBatch(animation: animation, markers: [marker]))
  }

  private func enteringAnimation(
    for element: MarkerClusterEngine.Element
  ) -> ResolvedOverlayEnteringAnimation {
    switch element {
    case let .single(descriptor):
      return OverlayEnteringAnimationResolver.resolve(
        descriptor.enteringAnimation,
        fallback: markerEnteringAnimation
      )
    case .cluster:
      return OverlayEnteringAnimationResolver.resolve(clusterEnteringAnimation)
    }
  }

  private func updateMarker(_ marker: GMSMarker, with element: MarkerClusterEngine.Element) {
    switch element {
    case let .single(descriptor):
      marker.position = descriptor.coordinate.toCLLocationCoordinate2D()
      marker.title = descriptor.title
      marker.snippet = descriptor.subtitle
      marker.isDraggable = descriptor.draggable == true
      marker.userData = MarkerPayload.marker(descriptor.id)
      visualApplier.apply(descriptor, to: marker)
    case let .cluster(_, coordinate, count, memberIds, region):
      marker.position = coordinate
      marker.title = nil
      marker.snippet = nil
      marker.isDraggable = false
      let icon = clusterIcon(count: count)
      if marker.icon !== icon {
        marker.icon = icon
      }
      marker.groundAnchor = CGPoint(x: 0.5, y: 0.5)
      marker.userData = MarkerPayload.cluster(memberIds: memberIds, region: region)
    }
  }

  private func clusterIcon(count: Int) -> UIImage {
    let diameter = ClusterBadgeMetrics.diameter(for: count)
    let text = Self.formatClusterCount(count)
    let cacheKey = "\(Int(diameter)):\(text)"
    if let icon = clusterIconCache[cacheKey] {
      return icon
    }

    let format = UIGraphicsImageRendererFormat.default()
    format.scale = UIScreen.main.scale
    let icon = UIGraphicsImageRenderer(size: CGSize(width: diameter, height: diameter), format: format)
      .image { context in
        let rect = CGRect(x: 0, y: 0, width: diameter, height: diameter)
        let colors = [
          UIColor(red: 0.30, green: 0.62, blue: 1.0, alpha: 1).cgColor,
          UIColor(red: 0.04, green: 0.52, blue: 1.0, alpha: 1).cgColor,
        ] as CFArray
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let gradient = CGGradient(colorsSpace: colorSpace, colors: colors, locations: [0, 1])!
        context.cgContext.addEllipse(in: rect.insetBy(dx: 1, dy: 1))
        context.cgContext.clip()
        context.cgContext.drawLinearGradient(
          gradient,
          start: CGPoint(x: diameter / 2, y: 0),
          end: CGPoint(x: diameter / 2, y: diameter),
          options: []
        )
        context.cgContext.resetClip()
        UIColor.white.setStroke()
        let borderPath = UIBezierPath(ovalIn: rect.insetBy(dx: 1, dy: 1))
        borderPath.lineWidth = 2
        borderPath.stroke()

        let attributes: [NSAttributedString.Key: Any] = [
          .font: UIFont.systemFont(ofSize: 13, weight: .bold),
          .foregroundColor: UIColor.white,
        ]
        let textSize = text.size(withAttributes: attributes)
        text.draw(
          at: CGPoint(x: (diameter - textSize.width) / 2, y: (diameter - textSize.height) / 2),
          withAttributes: attributes
        )
      }
    clusterIconCache[cacheKey] = icon
    return icon
  }

  private static func formatClusterCount(_ count: Int) -> String {
    if count >= 1000 {
      return String(format: "%.1fk", Double(count) / 1000)
    }
    return String(count)
  }

  private func clearMarkers() {
    for marker in markers.values {
      marker.map = nil
    }
    markers.removeAll()
    markerVersions.removeAll()
  }

  private func clearShapes() {
    for overlay in polylines.values {
      overlay.map = nil
    }
    for overlay in polygons.values {
      overlay.map = nil
    }
    for overlay in circles.values {
      overlay.map = nil
    }
    polylines.removeAll()
    polygons.removeAll()
    circles.removeAll()
  }

  private func makePolyline(_ descriptor: PolylineDescriptor) -> GMSPolyline {
    let polyline = GMSPolyline(path: descriptor.coordinates.toGMSPath())
    updatePolyline(polyline, descriptor)
    return polyline
  }

  private func updatePolyline(_ polyline: GMSPolyline, _ descriptor: PolylineDescriptor) {
    polyline.path = descriptor.coordinates.toGMSPath()
    polyline.strokeColor = descriptor.strokeColor?.toUIColor(fallback: .systemBlue) ?? .systemBlue
    polyline.strokeWidth = CGFloat(descriptor.strokeWidth ?? 4)
    polyline.isTappable = descriptor.tappable ?? false
    polyline.userData = descriptor.id
  }

  private func makePolygon(_ descriptor: PolygonDescriptor) -> GMSPolygon {
    let polygon = GMSPolygon(path: descriptor.coordinates.toGMSPath())
    updatePolygon(polygon, descriptor)
    return polygon
  }

  private func updatePolygon(_ polygon: GMSPolygon, _ descriptor: PolygonDescriptor) {
    polygon.path = descriptor.coordinates.toGMSPath()
    polygon.holes = descriptor.holes?.map { $0.toGMSPath() }
    polygon.strokeColor = descriptor.strokeColor?.toUIColor(fallback: .systemBlue) ?? .systemBlue
    polygon.fillColor = descriptor.fillColor?.toUIColor(
      fallback: UIColor.systemBlue.withAlphaComponent(0.2)
    ) ?? UIColor.systemBlue.withAlphaComponent(0.2)
    polygon.strokeWidth = CGFloat(descriptor.strokeWidth ?? 2)
    polygon.isTappable = descriptor.tappable ?? false
    polygon.userData = descriptor.id
  }

  private func makeCircle(_ descriptor: CircleDescriptor) -> GMSCircle {
    let circle = GMSCircle(
      position: descriptor.center.toCLLocationCoordinate2D(),
      radius: descriptor.radius
    )
    updateCircle(circle, descriptor)
    return circle
  }

  private func updateCircle(_ circle: GMSCircle, _ descriptor: CircleDescriptor) {
    circle.position = descriptor.center.toCLLocationCoordinate2D()
    circle.radius = descriptor.radius
    circle.strokeColor = descriptor.strokeColor?.toUIColor(fallback: .systemBlue) ?? .systemBlue
    circle.fillColor = descriptor.fillColor?.toUIColor(
      fallback: UIColor.systemBlue.withAlphaComponent(0.2)
    ) ?? UIColor.systemBlue.withAlphaComponent(0.2)
    circle.strokeWidth = CGFloat(descriptor.strokeWidth ?? 2)
    circle.isTappable = descriptor.tappable ?? false
    circle.userData = descriptor.id
  }

  private func reconcile<Descriptor, Overlay: GMSOverlay>(
    current: inout [String: Overlay],
    next descriptors: [Descriptor],
    make: (Descriptor) -> Overlay,
    update: (Overlay, Descriptor) -> Void
  ) where Descriptor: IdentifiedOverlayDescriptor {
    guard let mapView else {
      return
    }

    var nextIds = Set<String>()
    for descriptor in descriptors {
      nextIds.insert(descriptor.id)
      if let overlay = current[descriptor.id] {
        update(overlay, descriptor)
      } else {
        let overlay = make(descriptor)
        overlay.map = mapView
        current[descriptor.id] = overlay
      }
    }

    for id in Set(current.keys).subtracting(nextIds) {
      current.removeValue(forKey: id)?.map = nil
    }
  }
}

private protocol IdentifiedOverlayDescriptor {
  var id: String { get }
}

extension PolylineDescriptor: IdentifiedOverlayDescriptor {}
extension PolygonDescriptor: IdentifiedOverlayDescriptor {}
extension CircleDescriptor: IdentifiedOverlayDescriptor {}

private extension Array where Element == Coordinate {
  func toGMSPath() -> GMSPath {
    let path = GMSMutablePath()
    for coordinate in self {
      path.add(coordinate.toCLLocationCoordinate2D())
    }
    return path
  }
}
#endif

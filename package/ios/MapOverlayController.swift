import MapKit
import UIKit

/// Reconciles overlay descriptors with MapKit annotations and overlays.
final class MapOverlayController {
  enum OverlayKind {
    case polyline
    case polygon
    case circle
  }

  struct OverlayStyle {
    let id: String
    let kind: OverlayKind
    let strokeColor: UIColor
    let fillColor: UIColor?
    let strokeWidth: CGFloat
    let tappable: Bool
  }

  private weak var mapView: MKMapView?
  /// All currently shown annotations (singles and clusters), keyed by diff key.
  private var displayedAnnotations: [String: MKAnnotation] = [:]
  private var displayedAnnotationVersions: [String: Int] = [:]
  private let markerPipeline = MarkerRenderPipeline()
  private var shapeOverlays: [String: MKOverlay] = [:]
  private var overlayStyles: [ObjectIdentifier: OverlayStyle] = [:]

  var markerEnteringAnimation: OverlayEnteringAnimationDescriptor?
  var clusterEnteringAnimation: OverlayEnteringAnimationDescriptor?

  init(mapView: MKMapView) {
    self.mapView = mapView
  }

  private var usesViewportPipeline: Bool {
    markerPipeline.usesViewportPipeline
  }

  func setClusteringEnabled(_ enabled: Bool) {
    guard markerPipeline.setClusteringEnabled(enabled) else {
      return
    }
    reapplyMarkers()
  }

  func reset() {
    markerPipeline.reset()
    guard let mapView else {
      return
    }

    mapView.removeAnnotations(Array(displayedAnnotations.values))
    mapView.removeOverlays(Array(shapeOverlays.values))
    displayedAnnotations.removeAll()
    displayedAnnotationVersions.removeAll()
    shapeOverlays.removeAll()
    overlayStyles.removeAll()
  }

  func setMarkers(_ descriptors: [MarkerDescriptor]?) {
    guard markerPipeline.setMarkers(descriptors) else {
      return
    }
    reapplyMarkers()
  }

  private func reapplyMarkers() {
    guard let mapView else {
      return
    }

    markerPipeline.reapply(
      displayedVersions: displayedAnnotationVersions,
      region: mapView.region,
      viewSize: mapView.bounds.size,
      apply: { [weak self] diff in
        self?.applyDiff(diff)
      }
    )
  }

  /// Immediate (non-debounced) refresh used for live updates during gestures.
  func refreshNow() {
    guard let mapView, usesViewportPipeline else {
      return
    }
    markerPipeline.refreshNow(
      displayedVersions: displayedAnnotationVersions,
      region: mapView.region,
      viewSize: mapView.bounds.size,
      apply: { [weak self] diff in
        self?.applyDiff(diff)
      }
    )
  }

  /// Debounced viewport refresh for clustered / large datasets.
  func scheduleViewportRefresh(immediate: Bool = false) {
    guard let mapView, usesViewportPipeline else {
      return
    }

    markerPipeline.scheduleViewportRefresh(
      displayedVersions: displayedAnnotationVersions,
      region: mapView.region,
      viewSize: mapView.bounds.size,
      immediate: immediate,
      apply: { [weak self] diff in
        self?.applyDiff(diff)
      }
    )
  }

  private func applyDiff(_ diff: MarkerRenderDiff) {
    guard let mapView else {
      return
    }

    if !diff.removedKeys.isEmpty {
      let removed = diff.removedKeys.compactMap { key in
        displayedAnnotationVersions.removeValue(forKey: key)
        return displayedAnnotations.removeValue(forKey: key)
      }
      mapView.removeAnnotations(removed)
    }

    if !diff.added.isEmpty {
      var annotations: [MKAnnotation] = []
      annotations.reserveCapacity(diff.added.count)
      for entry in diff.added {
        let annotation = entry.element.makeAnnotation(
          markerEnteringAnimation: markerEnteringAnimation,
          clusterEnteringAnimation: clusterEnteringAnimation
        )
        displayedAnnotations[entry.key] = annotation
        displayedAnnotationVersions[entry.key] = entry.version
        annotations.append(annotation)
      }
      mapView.addAnnotations(annotations)
    }

    for entry in diff.retained {
      guard let existing = displayedAnnotations[entry.key] else {
        continue
      }

      switch entry.element {
      case .single(let descriptor):
        if let marker = existing as? MapMarkerAnnotation {
          let visualChanged = marker.update(from: descriptor)
          if visualChanged {
            refreshMarkerView(for: marker)
          }
        }
      case .cluster(let key, let coordinate, let count, let memberIds, let region):
        if let cluster = existing as? MapClusterAnnotation {
          cluster.update(
            id: key,
            coordinate: coordinate,
            count: count,
            memberIds: memberIds,
            region: region
          )
          if let view = mapView.view(for: cluster) as? NitroClusterAnnotationView {
            view.configure(count: count)
          }
        }
      }
      displayedAnnotationVersions[entry.key] = entry.version
    }
  }

  private func refreshMarkerView(for marker: MapMarkerAnnotation) {
    guard let mapView, let view = mapView.view(for: marker) else {
      return
    }

    let needsImageView = marker.image != nil
    let hasImageView = view is NitroImageAnnotationView

    if needsImageView != hasImageView {
      mapView.removeAnnotation(marker)
      mapView.addAnnotation(marker)
      return
    }

    if let imageView = view as? NitroImageAnnotationView {
      imageView.configure(for: marker)
    } else {
      (view as? NitroPinAnnotationView)?.configure(for: marker)
    }
  }

  func updatePolylines(_ descriptors: [PolylineDescriptor]?) {
    reconcileShapeOverlays(
      descriptors ?? [],
      kind: .polyline,
      makeOverlay: { $0.toMKPolyline() },
      makeStyle: { descriptor in
        OverlayStyle(
          id: descriptor.id,
          kind: .polyline,
          strokeColor: descriptor.strokeColor?.toUIColor(fallback: .systemBlue) ?? .systemBlue,
          fillColor: nil,
          strokeWidth: CGFloat(descriptor.strokeWidth ?? 4),
          tappable: descriptor.tappable ?? false
        )
      }
    )
  }

  func updatePolygons(_ descriptors: [PolygonDescriptor]?) {
    reconcileShapeOverlays(
      descriptors ?? [],
      kind: .polygon,
      makeOverlay: { $0.toMKPolygon() },
      makeStyle: { descriptor in
        OverlayStyle(
          id: descriptor.id,
          kind: .polygon,
          strokeColor: descriptor.strokeColor?.toUIColor(fallback: .systemBlue) ?? .systemBlue,
          fillColor: descriptor.fillColor?.toUIColor(fallback: UIColor.systemBlue.withAlphaComponent(0.2))
            ?? UIColor.systemBlue.withAlphaComponent(0.2),
          strokeWidth: CGFloat(descriptor.strokeWidth ?? 2),
          tappable: descriptor.tappable ?? false
        )
      }
    )
  }

  func updateCircles(_ descriptors: [CircleDescriptor]?) {
    reconcileShapeOverlays(
      descriptors ?? [],
      kind: .circle,
      makeOverlay: { $0.toMKCircle() },
      makeStyle: { descriptor in
        OverlayStyle(
          id: descriptor.id,
          kind: .circle,
          strokeColor: descriptor.strokeColor?.toUIColor(fallback: .systemBlue) ?? .systemBlue,
          fillColor: descriptor.fillColor?.toUIColor(fallback: UIColor.systemBlue.withAlphaComponent(0.2))
            ?? UIColor.systemBlue.withAlphaComponent(0.2),
          strokeWidth: CGFloat(descriptor.strokeWidth ?? 2),
          tappable: descriptor.tappable ?? true
        )
      }
    )
  }

  func renderer(for overlay: MKOverlay) -> MKOverlayRenderer? {
    guard let style = overlayStyles[ObjectIdentifier(overlay)] else {
      return nil
    }

    let renderer: MKOverlayPathRenderer
    switch style.kind {
    case .polyline:
      renderer = MKPolylineRenderer(overlay: overlay)
    case .polygon:
      renderer = MKPolygonRenderer(overlay: overlay)
    case .circle:
      renderer = MKCircleRenderer(overlay: overlay)
    }

    renderer.strokeColor = style.strokeColor
    renderer.lineWidth = style.strokeWidth
    if let fillColor = style.fillColor {
      renderer.fillColor = fillColor
    }

    return renderer
  }

  func overlayId(at point: CGPoint) -> String? {
    guard let mapView else {
      return nil
    }

    for overlay in mapView.overlays.reversed() {
      let overlayKey = ObjectIdentifier(overlay)
      guard let style = overlayStyles[overlayKey], style.tappable else {
        continue
      }

      guard let renderer = mapView.renderer(for: overlay) as? MKOverlayPathRenderer else {
        continue
      }

      let coordinate = mapView.convert(point, toCoordinateFrom: mapView)
      let mapPoint = MKMapPoint(coordinate)
      let rendererPoint = renderer.point(for: mapPoint)

      if renderer.path?.contains(rendererPoint) == true {
        return style.id
      }
    }

    return nil
  }

  func overlayKind(for id: String) -> OverlayKind? {
    shapeOverlays[id].flatMap { overlayStyles[ObjectIdentifier($0)]?.kind }
  }

  private func reconcileShapeOverlays<Descriptor>(
    _ descriptors: [Descriptor],
    kind: OverlayKind,
    makeOverlay: (Descriptor) -> MKOverlay,
    makeStyle: (Descriptor) -> OverlayStyle
  ) {
    guard let mapView else {
      return
    }

    let nextIds = Set(
      descriptors.compactMap { descriptor -> String? in
        let style = makeStyle(descriptor)
        return style.kind == kind ? style.id : nil
      }
    )
    let existingIds = Set(
      shapeOverlays.compactMap { id, overlay -> String? in
        overlayStyles[ObjectIdentifier(overlay)]?.kind == kind ? id : nil
      }
    )

    for removedId in existingIds.subtracting(nextIds) {
      if let overlay = shapeOverlays.removeValue(forKey: removedId) {
        overlayStyles.removeValue(forKey: ObjectIdentifier(overlay))
        mapView.removeOverlay(overlay)
      }
    }

    for descriptor in descriptors {
      let style = makeStyle(descriptor)
      guard style.kind == kind else {
        continue
      }

      if let existingOverlay = shapeOverlays[style.id] {
        overlayStyles.removeValue(forKey: ObjectIdentifier(existingOverlay))
        mapView.removeOverlay(existingOverlay)
      }

      let overlay = makeOverlay(descriptor)
      shapeOverlays[style.id] = overlay
      overlayStyles[ObjectIdentifier(overlay)] = style
      mapView.addOverlay(overlay)
    }
  }
}

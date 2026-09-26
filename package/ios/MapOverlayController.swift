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

  /// The shown overlays of one shape kind and the render version of each,
  /// keyed by overlay id. Kinds are kept apart because an id only has to be
  /// unique within its kind: a polyline and a polygon may share one.
  private final class ShapeLayer {
    var overlays: [String: MKOverlay] = [:]
    var versions: [String: ShapeRenderVersion] = [:]
  }

  /// Every shape is drawn at this level, so its place among the level's
  /// overlays is its place in the draw order.
  private static let shapeLevel = MKOverlayLevel.aboveLabels

  private weak var mapView: MKMapView?
  /// All currently shown annotations (singles and clusters), keyed by diff key.
  private var displayedAnnotations: [String: MKAnnotation] = [:]
  private var displayedAnnotationVersions: [String: Int] = [:]
  private let markerPipeline = MarkerRenderPipeline()
  private let polylineLayer = ShapeLayer()
  private let polygonLayer = ShapeLayer()
  private let circleLayer = ShapeLayer()
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
    for layer in [polylineLayer, polygonLayer, circleLayer] {
      mapView.removeOverlays(Array(layer.overlays.values))
      layer.overlays.removeAll()
      layer.versions.removeAll()
    }
    displayedAnnotations.removeAll()
    displayedAnnotationVersions.removeAll()
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
      in: polylineLayer,
      id: { $0.id },
      renderVersion: { $0.renderVersion() },
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
      in: polygonLayer,
      id: { $0.id },
      renderVersion: { $0.renderVersion() },
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
      in: circleLayer,
      id: { $0.id },
      renderVersion: { $0.renderVersion() },
      makeOverlay: { $0.toMKCircle() },
      makeStyle: { descriptor in
        OverlayStyle(
          id: descriptor.id,
          kind: .circle,
          strokeColor: descriptor.strokeColor?.toUIColor(fallback: .systemBlue) ?? .systemBlue,
          fillColor: descriptor.fillColor?.toUIColor(fallback: UIColor.systemBlue.withAlphaComponent(0.2))
            ?? UIColor.systemBlue.withAlphaComponent(0.2),
          strokeWidth: CGFloat(descriptor.strokeWidth ?? 2),
          tappable: descriptor.tappable ?? false
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

    apply(style, to: renderer)

    return renderer
  }

  private func apply(_ style: OverlayStyle, to renderer: MKOverlayPathRenderer) {
    renderer.strokeColor = style.strokeColor
    renderer.lineWidth = style.strokeWidth
    if let fillColor = style.fillColor {
      renderer.fillColor = fillColor
    }
  }

  /// The topmost tappable shape under `point`.
  func overlayHit(at point: CGPoint) -> (id: String, kind: OverlayKind)? {
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
        return (style.id, style.kind)
      }
    }

    return nil
  }

  /// Applies `computeShapeRenderDiff` to one shape kind. An unchanged shape
  /// costs no MapKit call. A style-only change restyles the cached renderer in
  /// place; a geometry change replaces the overlay at its previous place in the
  /// draw order, because MapKit overlay geometry is immutable.
  ///
  /// A style is registered before MapKit sees its overlay: adding an overlay
  /// asks the delegate for its renderer right away, and a renderer made without
  /// a style draws nothing for as long as the overlay is shown.
  private func reconcileShapeOverlays<Descriptor>(
    _ descriptors: [Descriptor],
    in layer: ShapeLayer,
    id: (Descriptor) -> String,
    renderVersion: (Descriptor) -> ShapeRenderVersion,
    makeOverlay: (Descriptor) -> MKOverlay,
    makeStyle: (Descriptor) -> OverlayStyle
  ) {
    guard let mapView else {
      return
    }

    let diff = computeShapeRenderDiff(
      descriptors,
      displayed: layer.versions,
      id: id,
      version: renderVersion
    )

    for removedId in diff.removedIds {
      guard let overlay = layer.overlays.removeValue(forKey: removedId) else {
        continue
      }
      layer.versions.removeValue(forKey: removedId)
      overlayStyles.removeValue(forKey: ObjectIdentifier(overlay))
      mapView.removeOverlay(overlay)
    }

    for change in diff.updated {
      guard let shown = layer.overlays[change.id] else {
        continue
      }

      let style = makeStyle(change.descriptor)
      if change.geometryChanged {
        let overlay = makeOverlay(change.descriptor)
        overlayStyles[ObjectIdentifier(overlay)] = style
        let index = mapView.overlays(in: Self.shapeLevel).firstIndex { $0 === shown }
        overlayStyles.removeValue(forKey: ObjectIdentifier(shown))
        mapView.removeOverlay(shown)
        if let index {
          mapView.insertOverlay(overlay, at: index, level: Self.shapeLevel)
        } else {
          mapView.addOverlay(overlay, level: Self.shapeLevel)
        }
        layer.overlays[change.id] = overlay
      } else {
        overlayStyles[ObjectIdentifier(shown)] = style
        if let renderer = mapView.renderer(for: shown) as? MKOverlayPathRenderer {
          apply(style, to: renderer)
          renderer.setNeedsDisplay()
        }
      }
      layer.versions[change.id] = change.version
    }

    guard !diff.added.isEmpty else {
      return
    }

    var added: [MKOverlay] = []
    added.reserveCapacity(diff.added.count)
    for change in diff.added {
      let overlay = makeOverlay(change.descriptor)
      overlayStyles[ObjectIdentifier(overlay)] = makeStyle(change.descriptor)
      layer.overlays[change.id] = overlay
      layer.versions[change.id] = change.version
      added.append(overlay)
    }
    mapView.addOverlays(added, level: Self.shapeLevel)
  }
}

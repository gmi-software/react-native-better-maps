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

  /// What a tap on the sprite layer hit, and what the adapter should do about it.
  enum SpritePress {
    case marker(id: String)
    /// The marker was promoted to a selected annotation view; its `didSelect` fires the press.
    case promoted
    case cluster(id: String, coordinate: CLLocationCoordinate2D, count: Int, region: MKCoordinateRegion)
  }

  private weak var mapView: MKMapView?
  /// Annotations on the map (singles and clusters), keyed by render key.
  private var displayedAnnotations: [MarkerRenderKey: MKAnnotation] = [:]
  /// Versions of everything shown, annotations and sprites alike; the pipeline diffs against it.
  private var displayedAnnotationVersions: [MarkerRenderKey: Int] = [:]
  /// What the sprite layer draws, keyed like the annotations.
  private var displayedSprites: [MarkerRenderKey: MarkerSprite] = [:]
  private let spriteOverlay = MarkerSpriteOverlay()
  private weak var spriteRenderer: MarkerSpriteRenderer?
  private var isSpritePublishScheduled = false
  /// One image load per image key, fanned out to every sprite waiting for it.
  private var pendingSpriteImageLoads: [NSString: [MarkerRenderKey]] = [:]
  /// The sprite shown as a selected annotation view for its callout, if any.
  private var promotedSprite: (entry: MarkerRenderEntry, annotation: MapMarkerAnnotation)?
  private(set) var markerRendering: MarkerRendering = .views
  private let markerPipeline = MarkerRenderPipeline()
  private lazy var applyScheduler = MarkerApplyScheduler(sink: MarkerApplyScheduler.Sink(
    remove: { [weak self] keys in self?.applyRemovals(keys) },
    add: { [weak self] entries, _ in self?.applyAdds(entries) },
    update: { [weak self] entry in self?.applyRetained(entry) }
  ))
  private lazy var liveRefreshClock = FrameClock { [weak self] frame in
    self?.liveRefreshTick(frame)
  }
  private var lastLiveRefreshTime: CFTimeInterval = 0
  private var shapeOverlays: [String: MKOverlay] = [:]
  private var shapeVersions: [String: ShapeRenderVersion] = [:]
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
    applyScheduler.cancel()
    liveRefreshClock.stop()
    markerPipeline.store?.removeListener(self)
    markerPipeline.reset()
    promotedSprite = nil
    pendingSpriteImageLoads.removeAll()
    displayedSprites.removeAll()
    spriteOverlay.snapshots.replace(.empty)
    guard let mapView else {
      return
    }

    mapView.removeAnnotations(Array(displayedAnnotations.values))
    mapView.removeOverlays(Array(shapeOverlays.values))
    if markerRendering == .sprites {
      mapView.removeOverlay(spriteOverlay)
    }
    displayedAnnotations.removeAll()
    displayedAnnotationVersions.removeAll()
    shapeOverlays.removeAll()
    shapeVersions.removeAll()
    overlayStyles.removeAll()
  }

  /// Renders markers from `store` and follows its changes until another store
  /// (or nil) is attached.
  func attach(store: MarkerStore?) {
    guard markerPipeline.store !== store else {
      return
    }
    markerPipeline.store?.removeListener(self)
    markerPipeline.attach(store: store)
    store?.addListener(self)
    reapplyMarkers()
  }

  /// Switches between annotation views and the sprite layer. Everything shown
  /// is taken down and re-added through the new path.
  func setMarkerRendering(_ mode: MarkerRendering) {
    guard mode != markerRendering else {
      return
    }
    markerRendering = mode
    applyScheduler.cancel()
    promotedSprite = nil
    pendingSpriteImageLoads.removeAll()
    displayedSprites.removeAll()
    spriteOverlay.snapshots.replace(.empty)
    guard let mapView else {
      return
    }

    mapView.removeAnnotations(Array(displayedAnnotations.values))
    displayedAnnotations.removeAll()
    displayedAnnotationVersions.removeAll()
    if mode == .sprites {
      mapView.addOverlay(spriteOverlay, level: .aboveLabels)
    } else {
      mapView.removeOverlay(spriteOverlay)
    }
    reapplyMarkers()
  }

  /// Ids of the markers inside a displayed cluster; empty once it is gone.
  func clusterMembers(id: String) -> [String] {
    guard let store = markerPipeline.store else {
      return []
    }
    if let cluster = displayedAnnotations[.cluster(id: id)] as? MapClusterAnnotation {
      return store.ids(for: cluster.memberHandles)
    }
    if let sprite = displayedSprites[.cluster(id: id)],
       case let .cluster(_, _, _, memberHandles, _) = sprite.element {
      return store.ids(for: memberHandles)
    }
    return []
  }

  func reapplyMarkers() {
    guard let mapView else {
      return
    }

    markerPipeline.reapply(
      region: mapView.region,
      viewSize: mapView.bounds.size,
      apply: { [weak self] target in
        self?.applyTarget(target)
      }
    )
  }

  /// Starts the vsync-aligned live refresh that runs while the camera moves.
  func beginLiveRefresh() {
    guard usesViewportPipeline else {
      return
    }
    lastLiveRefreshTime = 0
    liveRefreshClock.start()
  }

  /// Stops the live refresh and settles on the final viewport.
  func endLiveRefresh() {
    liveRefreshClock.stop()
    scheduleViewportRefresh(immediate: true)
  }

  private func liveRefreshTick(_ frame: FrameClock.Frame) {
    guard frame.timestamp - lastLiveRefreshTime >= MarkerRenderPipeline.liveRefreshInterval else {
      return
    }
    lastLiveRefreshTime = frame.timestamp
    refreshNow()
  }

  /// Re-creates the annotation views of every displayed marker, for a pin style change.
  func reloadMarkerViews() {
    guard let mapView else {
      return
    }
    let markers = displayedAnnotations.values.compactMap { $0 as? MapMarkerAnnotation }
    guard !markers.isEmpty else {
      return
    }
    for marker in markers {
      marker.suppressesNextEnteringAnimation = true
    }
    mapView.removeAnnotations(markers)
    mapView.addAnnotations(markers)
  }

  /// Immediate (non-debounced) refresh used for live updates during gestures.
  func refreshNow() {
    guard let mapView, usesViewportPipeline else {
      return
    }
    markerPipeline.refreshNow(
      region: mapView.region,
      viewSize: mapView.bounds.size,
      apply: { [weak self] target in
        self?.applyTarget(target)
      }
    )
  }

  /// Debounced viewport refresh for clustered / large datasets.
  func scheduleViewportRefresh(immediate: Bool = false) {
    guard let mapView, usesViewportPipeline else {
      return
    }

    markerPipeline.scheduleViewportRefresh(
      region: mapView.region,
      viewSize: mapView.bounds.size,
      immediate: immediate,
      apply: { [weak self] target in
        self?.applyTarget(target)
      }
    )
  }

  /// Diffs a computed target against what is on the map now. The scheduler
  /// may have applied adds from the previous diff while the target was being
  /// computed, and a diff against an older snapshot would add those twice.
  private func applyTarget(_ target: [MarkerRenderEntry]) {
    applyDiff(MarkerRenderPipeline.computeDiff(target: target, displayed: displayedAnnotationVersions))
  }

  /// Hands a diff to the frame scheduler: removals now, adds spread over
  /// frames nearest to the viewport centre first, retained updates in the
  /// remaining budget.
  private func applyDiff(_ diff: MarkerRenderDiff) {
    guard let mapView else {
      return
    }
    let viewDiff = markerRendering == .sprites ? applySpriteDiff(diff) : diff
    applyScheduler.schedule(PendingMarkerApply(
      diff: viewDiff,
      center: mapView.region.center,
      animateEntering: true,
      animationBudget: .max
    ))
  }

  // MARK: - Sprite layer

  /// Applies the sprite part of a diff at once and returns what still needs an
  /// annotation view: draggable markers, and the marker promoted for its
  /// callout. Sprites are a dictionary update and one bitmap re-render off the
  /// main thread, so they need no frame budget.
  private func applySpriteDiff(_ diff: MarkerRenderDiff) -> MarkerRenderDiff {
    var viewRemovals = Set<MarkerRenderKey>()
    var viewAdds: [MarkerRenderEntry] = []
    var viewRetained: [MarkerRenderEntry] = []
    var changed = false
    // Union of the sprites that changed, so a pan re-renders the edge tiles only.
    var dirty = MKMapRect.null
    func touch(_ sprite: MarkerSprite) {
      dirty = dirty.union(MKMapRect(x: sprite.mapPoint.x, y: sprite.mapPoint.y, width: 0, height: 0))
    }

    for key in diff.removedKeys {
      if let removed = displayedSprites.removeValue(forKey: key) {
        displayedAnnotationVersions.removeValue(forKey: key)
        touch(removed)
        changed = true
      } else {
        if promotedSprite?.entry.key == key {
          promotedSprite = nil
        }
        viewRemovals.insert(key)
      }
    }

    for entry in diff.added {
      if Self.needsAnnotationView(entry) {
        viewAdds.append(entry)
      } else {
        let sprite = makeSprite(for: entry)
        displayedSprites[entry.key] = sprite
        displayedAnnotationVersions[entry.key] = entry.version
        touch(sprite)
        changed = true
      }
    }

    for entry in diff.retained {
      if let current = displayedSprites[entry.key] {
        touch(current)
        if Self.needsAnnotationView(entry) {
          displayedSprites.removeValue(forKey: entry.key)
          displayedAnnotationVersions.removeValue(forKey: entry.key)
          viewAdds.append(entry)
        } else {
          let sprite = makeSprite(for: entry, reusing: current)
          displayedSprites[entry.key] = sprite
          displayedAnnotationVersions[entry.key] = entry.version
          touch(sprite)
        }
        changed = true
      } else if promotedSprite?.entry.key == entry.key {
        promotedSprite?.entry = entry
        viewRetained.append(entry)
      } else if Self.needsAnnotationView(entry) {
        viewRetained.append(entry)
      } else {
        // No longer draggable: the view goes and a sprite takes its place.
        applyRemovals([entry.key])
        let sprite = makeSprite(for: entry)
        displayedSprites[entry.key] = sprite
        displayedAnnotationVersions[entry.key] = entry.version
        touch(sprite)
        changed = true
      }
    }

    if changed {
      publishSprites(invalidating: dirty)
    }
    return MarkerRenderDiff(removedKeys: viewRemovals, added: viewAdds, retained: viewRetained)
  }

  /// Dragging needs touch handling that only an annotation view has.
  private static func needsAnnotationView(_ entry: MarkerRenderEntry) -> Bool {
    if case let .single(descriptor) = entry.element {
      return descriptor.draggable == true
    }
    return false
  }

  private func makeSprite(for entry: MarkerRenderEntry, reusing current: MarkerSprite? = nil) -> MarkerSprite {
    let scale = mapView?.traitCollection.displayScale ?? UIScreen.main.scale
    switch entry.element {
    case let .single(descriptor):
      let coordinate = descriptor.coordinate.toCLLocationCoordinate2D()
      let rotation = descriptor.rotation ?? 0
      let radians: CGFloat = descriptor.flat != true && rotation != 0 ? CGFloat(rotation * .pi / 180) : 0
      var image: CGImage?
      var size = CGSize.zero
      if let imageDescriptor = descriptor.image {
        let token = MarkerImageLoader.cacheKey(for: imageDescriptor)
        if let current,
           case let .single(previous) = current.element,
           let previousImage = previous.image,
           MarkerImageLoader.cacheKey(for: previousImage) == token,
           let loaded = current.image {
          image = loaded
          size = current.size
        } else if let cached = MarkerImageLoader.cachedImage(for: imageDescriptor) {
          image = cached.cgImage
          size = cached.size
        } else {
          loadSpriteImage(imageDescriptor, token: token, key: entry.key)
        }
      } else {
        let pin = PinImageRenderer.pin(scale: scale)
        image = pin.cgImage
        size = pin.size
      }
      return MarkerSprite(
        key: entry.key,
        element: entry.element,
        coordinate: coordinate,
        mapPoint: MKMapPoint(coordinate),
        image: image,
        size: size,
        centerOffset: MapMarkerAnnotation.centerOffset(
          anchor: descriptor.anchor,
          centerOffset: descriptor.centerOffset,
          imageSize: size
        ),
        rotation: radians,
        opacity: CGFloat(descriptor.opacity ?? 1)
      )
    case let .cluster(_, coordinate, count, _, _):
      let badge = ClusterBadgeImageRenderer.badge(count: count, scale: scale)
      return MarkerSprite(
        key: entry.key,
        element: entry.element,
        coordinate: coordinate,
        mapPoint: MKMapPoint(coordinate),
        image: badge.cgImage,
        size: badge.size,
        centerOffset: .zero,
        rotation: 0,
        opacity: 1
      )
    }
  }

  private func loadSpriteImage(_ image: MarkerImage, token: NSString, key: MarkerRenderKey) {
    if pendingSpriteImageLoads[token] != nil {
      pendingSpriteImageLoads[token]?.append(key)
      return
    }
    pendingSpriteImageLoads[token] = [key]
    MarkerImageLoader.load(image) { [weak self] loaded in
      guard let self else {
        return
      }
      let keys = self.pendingSpriteImageLoads.removeValue(forKey: token) ?? []
      guard let loaded else {
        return
      }
      var changed = false
      for key in keys {
        guard var sprite = self.displayedSprites[key],
              case let .single(descriptor) = sprite.element,
              let current = descriptor.image,
              MarkerImageLoader.cacheKey(for: current) == token else {
          continue
        }
        sprite.image = loaded.cgImage
        sprite.size = loaded.size
        sprite.centerOffset = MapMarkerAnnotation.centerOffset(
          anchor: descriptor.anchor,
          centerOffset: descriptor.centerOffset,
          imageSize: loaded.size
        )
        self.displayedSprites[key] = sprite
        changed = true
      }
      if changed {
        self.scheduleSpritePublish()
      }
    }
  }

  /// Hands the sprites to the renderer and asks MapKit for a redraw: of the
  /// tiles around `dirty` when the change is local, of everything when it is
  /// nil or covers most of the view.
  private func publishSprites(invalidating dirty: MKMapRect? = nil) {
    isSpritePublishScheduled = false
    let signpost = MapTrace.begin("publishSprites")
    defer { MapTrace.end("publishSprites", signpost) }
    let snapshot = MarkerSpriteSnapshot.ordered(Array(displayedSprites.values))
    spriteOverlay.snapshots.replace(snapshot)
    guard let renderer = spriteRenderer else {
      return
    }
    guard let mapView, let dirty, !dirty.isNull, mapView.bounds.width > 0 else {
      renderer.setNeedsDisplay()
      return
    }
    // Sprites reach past their coordinate by `maxReach` points; pad in map points.
    let mapPointsPerPoint = mapView.visibleMapRect.width / Double(mapView.bounds.width)
    let padding = Double(snapshot.maxReach + 2) * mapPointsPerPoint
    let area = dirty.insetBy(dx: -padding, dy: -padding)
    let visible = mapView.visibleMapRect
    if area.contains(visible) || area.intersection(visible).width * area.intersection(visible).height > visible.width * visible.height * 0.6 {
      renderer.setNeedsDisplay()
    } else {
      renderer.setNeedsDisplay(area)
    }
  }

  /// Coalesces publishes from image loads that complete in the same turn.
  private func scheduleSpritePublish() {
    guard !isSpritePublishScheduled else {
      return
    }
    isSpritePublishScheduled = true
    DispatchQueue.main.async { [weak self] in
      guard let self, self.isSpritePublishScheduled else {
        return
      }
      self.publishSprites()
    }
  }

  /// Hit-tests the sprites under a tap, topmost first. A marker with a title
  /// or subtitle is promoted to an annotation view and selected so MapKit shows
  /// its callout; its sprite comes back when the callout closes.
  func pressSprite(at point: CGPoint) -> SpritePress? {
    guard let mapView, markerRendering == .sprites else {
      return nil
    }
    let snapshot = spriteOverlay.snapshots.current
    let slop: CGFloat = 6
    let probeHalfSize = snapshot.maxReach + slop
    let probe = mapView.convert(
      CGRect(x: point.x - probeHalfSize, y: point.y - probeHalfSize, width: probeHalfSize * 2, height: probeHalfSize * 2),
      toRegionFrom: mapView
    )
    let probeBounds = MarkerViewportFilter.PaddedBounds(region: probe, padding: 0)

    for sprite in snapshot.sprites.reversed() {
      guard sprite.image != nil,
            probeBounds.contains(latitude: sprite.coordinate.latitude, longitude: sprite.coordinate.longitude) else {
        continue
      }
      let center = mapView.convert(sprite.coordinate, toPointTo: mapView)
      let frame = CGRect(
        x: center.x + sprite.centerOffset.x - sprite.size.width / 2 - slop,
        y: center.y + sprite.centerOffset.y - sprite.size.height / 2 - slop,
        width: sprite.size.width + slop * 2,
        height: sprite.size.height + slop * 2
      )
      guard frame.contains(point) else {
        continue
      }
      switch sprite.element {
      case let .single(descriptor):
        guard descriptor.title != nil || descriptor.subtitle != nil else {
          return .marker(id: descriptor.id)
        }
        promoteSprite(sprite)
        return .promoted
      case let .cluster(id, coordinate, count, _, region):
        return .cluster(id: id, coordinate: coordinate, count: count, region: region)
      }
    }
    return nil
  }

  private func promoteSprite(_ sprite: MarkerSprite) {
    guard let mapView,
          case let .single(descriptor) = sprite.element,
          let version = displayedAnnotationVersions[sprite.key] else {
      return
    }
    demotePromotedSprite(restoringSprite: true)

    let annotation = MapMarkerAnnotation(
      descriptor: descriptor,
      enteringAnimation: OverlayEnteringAnimationResolver.resolve(nil)
    )
    displayedSprites.removeValue(forKey: sprite.key)
    displayedAnnotations[sprite.key] = annotation
    promotedSprite = (
      entry: MarkerRenderEntry(key: sprite.key, element: sprite.element, version: version),
      annotation: annotation
    )
    publishSprites()
    mapView.addAnnotation(annotation)
    DispatchQueue.main.async { [weak self, weak mapView] in
      guard let self, let mapView, self.promotedSprite?.annotation === annotation else {
        return
      }
      mapView.selectAnnotation(annotation, animated: true)
    }
  }

  /// Puts the promoted marker's sprite back once its callout is dismissed.
  func demoteSprite(matching annotation: MKAnnotation?) {
    guard let promoted = promotedSprite,
          let marker = annotation as? MapMarkerAnnotation,
          marker === promoted.annotation else {
      return
    }
    demotePromotedSprite(restoringSprite: true)
  }

  private func demotePromotedSprite(restoringSprite: Bool) {
    guard let promoted = promotedSprite else {
      return
    }
    promotedSprite = nil
    displayedAnnotations.removeValue(forKey: promoted.entry.key)
    mapView?.removeAnnotation(promoted.annotation)
    guard restoringSprite, displayedAnnotationVersions[promoted.entry.key] != nil else {
      return
    }
    displayedSprites[promoted.entry.key] = makeSprite(for: promoted.entry)
    publishSprites()
  }

  private func applyRemovals(_ keys: [MarkerRenderKey]) {
    guard let mapView else {
      return
    }
    let removed = keys.compactMap { key in
      displayedAnnotationVersions.removeValue(forKey: key)
      return displayedAnnotations.removeValue(forKey: key)
    }
    mapView.removeAnnotations(removed)
  }

  private func applyAdds(_ entries: [MarkerRenderEntry]) {
    guard let mapView else {
      return
    }
    var annotations: [MKAnnotation] = []
    annotations.reserveCapacity(entries.count)
    for entry in entries {
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

  private func applyRetained(_ entry: MarkerRenderEntry) {
    guard let mapView, let existing = displayedAnnotations[entry.key] else {
      return
    }

    switch entry.element {
    case let .single(descriptor):
      if let marker = existing as? MapMarkerAnnotation {
        let visualChanged = marker.update(from: descriptor)
        if visualChanged {
          refreshMarkerView(for: marker)
        }
      }
    case let .cluster(id, coordinate, count, memberHandles, region):
      if let cluster = existing as? MapClusterAnnotation {
        cluster.update(
          id: id,
          coordinate: coordinate,
          count: count,
          memberHandles: memberHandles,
          region: region
        )
        if let view = mapView.view(for: cluster) as? NitroClusterAnnotationView {
          view.configure(count: count)
        }
      }
    }
    displayedAnnotationVersions[entry.key] = entry.version
  }

  private func refreshMarkerView(for marker: MapMarkerAnnotation) {
    guard let mapView, let view = mapView.view(for: marker) else {
      return
    }

    let needsImageView = marker.image != nil
    let hasImageView = view is NitroImageAnnotationView

    if needsImageView != hasImageView {
      marker.suppressesNextEnteringAnimation = true
      mapView.removeAnnotation(marker)
      mapView.addAnnotation(marker)
      return
    }

    if let imageView = view as? NitroImageAnnotationView {
      imageView.configure(for: marker)
    } else if let flatView = view as? NitroFlatPinAnnotationView {
      flatView.configure(for: marker)
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
      },
      renderVersion: { $0.renderVersion() }
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
      },
      renderVersion: { $0.renderVersion() }
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
      },
      renderVersion: { $0.renderVersion() }
    )
  }

  func renderer(for overlay: MKOverlay) -> MKOverlayRenderer? {
    if overlay === spriteOverlay {
      let renderer = MarkerSpriteRenderer(overlay: spriteOverlay)
      spriteRenderer = renderer
      return renderer
    }

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

  /// Reconciles one overlay kind against its descriptors.
  ///
  /// Each shown overlay keeps a render version. A descriptor sent again
  /// unchanged is skipped; a style-only change restyles the cached renderer in
  /// place; a geometry change replaces the overlay at its previous z-position,
  /// because MapKit overlay geometry is immutable.
  private func reconcileShapeOverlays<Descriptor>(
    _ descriptors: [Descriptor],
    kind: OverlayKind,
    makeOverlay: (Descriptor) -> MKOverlay,
    makeStyle: (Descriptor) -> OverlayStyle,
    renderVersion: (Descriptor) -> ShapeRenderVersion
  ) {
    guard let mapView else {
      return
    }

    var nextIds = Set<String>()
    nextIds.reserveCapacity(descriptors.count)

    for descriptor in descriptors {
      let style = makeStyle(descriptor)
      guard style.kind == kind else {
        continue
      }
      nextIds.insert(style.id)

      let version = renderVersion(descriptor)
      if let existingOverlay = shapeOverlays[style.id],
         let existingVersion = shapeVersions[style.id] {
        if existingVersion == version {
          continue
        }

        if existingVersion.geometry == version.geometry {
          // Style-only change: restyle the cached renderer in place.
          overlayStyles[ObjectIdentifier(existingOverlay)] = style
          if let renderer = mapView.renderer(for: existingOverlay) as? MKOverlayPathRenderer {
            apply(style, to: renderer)
            renderer.setNeedsDisplay()
          }
          shapeVersions[style.id] = version
          continue
        }
      }

      let overlay = makeOverlay(descriptor)
      if let existingOverlay = shapeOverlays[style.id] {
        overlayStyles.removeValue(forKey: ObjectIdentifier(existingOverlay))
        let previousIndex = mapView.overlays.firstIndex { $0 === existingOverlay }
        mapView.removeOverlay(existingOverlay)
        if let previousIndex {
          mapView.insertOverlay(overlay, at: previousIndex)
        } else {
          mapView.addOverlay(overlay)
        }
      } else {
        mapView.addOverlay(overlay)
      }
      shapeOverlays[style.id] = overlay
      overlayStyles[ObjectIdentifier(overlay)] = style
      shapeVersions[style.id] = version
    }

    let removedIds = shapeOverlays.compactMap { id, overlay -> String? in
      overlayStyles[ObjectIdentifier(overlay)]?.kind == kind && !nextIds.contains(id) ? id : nil
    }
    for removedId in removedIds {
      guard let overlay = shapeOverlays.removeValue(forKey: removedId) else {
        continue
      }
      shapeVersions.removeValue(forKey: removedId)
      overlayStyles.removeValue(forKey: ObjectIdentifier(overlay))
      mapView.removeOverlay(overlay)
    }
  }
}

extension MapOverlayController: MarkerStoreListener {
  func markerStoreDidChange(_ store: MarkerStore) {
    guard markerPipeline.store === store else {
      return
    }
    markerPipeline.invalidateClusterCache()
    reapplyMarkers()
  }
}

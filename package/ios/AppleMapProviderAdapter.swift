import MapKit
import NitroModules
import UIKit

final class AppleMapProviderAdapter: MapProviderAdapter {
  /// MapKit animates `setVisibleMapRect` over a duration it does not publish. This is
  /// only the watchdog's guess at it, not a duration handed to MapKit.
  private static let fitAnimationDuration: TimeInterval = 0.3
  private static let defaultAnimationDuration: TimeInterval = 0.25

  private let mapViewDelegate = HybridMapViewDelegate()
  private let cameraMoves = CameraMoveTracker()
  private lazy var regionChanges = RegionChangeTracker<CameraPlacement, Region>(
    position: { [unowned self] in view.camera.placement },
    region: { [unowned self] in currentRegion() },
    onBegin: { [unowned self] region, isGesture in
      onRegionChange?(region, RegionChangeDetails(isGesture: isGesture))
    },
    onComplete: { [unowned self] region, isGesture in
      onRegionChangeComplete?(region, RegionChangeDetails(isGesture: isGesture))
    }
  )
  /// Whether MapKit is between a `regionWillChange` and its `regionDidChange`.
  private var isRegionChanging = false
  /// The end of a move, held back for a turn of the run loop - see `handleRegionDidChange()`.
  private var pendingRegionChangeEnd: DispatchWorkItem?
  private var isMapReady = false
  private var hasDeliveredMapReady = false
  private var liveClusterTimer: Timer?
  fileprivate lazy var overlayController = MapOverlayController(mapView: view)

  var contentView: UIView {
    view
  }

  lazy var view: MKMapView = {
    let mapView = NitroMKMapView()
    mapViewDelegate.parent = self
    mapView.delegate = mapViewDelegate
    mapView.mapType = mapType.toMKMapType()
    mapView.isScrollEnabled = scrollEnabled ?? true
    mapView.isZoomEnabled = zoomEnabled ?? true
    mapView.isRotateEnabled = rotateEnabled ?? true
    mapView.isPitchEnabled = pitchEnabled ?? true
    applyUserLocationSettings(to: mapView)
    applyControlSettings(to: mapView)
    applyMapPadding(to: mapView)
    applyCustomMapStyle(to: mapView)
    applySelectablePoiFeatures(to: mapView)
    mapView.register(
      NitroPinAnnotationView.self,
      forAnnotationViewWithReuseIdentifier: NitroPinAnnotationView.reuseIdentifier
    )
    mapView.register(
      NitroImageAnnotationView.self,
      forAnnotationViewWithReuseIdentifier: NitroImageAnnotationView.reuseIdentifier
    )
    mapView.register(
      NitroClusterAnnotationView.self,
      forAnnotationViewWithReuseIdentifier: NitroClusterAnnotationView.reuseIdentifier
    )
    mapViewDelegate.installGestureRecognizers(on: mapView)
    return mapView
  }()

  var mapType: MapType = .standard {
    didSet {
      view.mapType = mapType.toMKMapType()
      applyCustomMapStyle(to: view)
    }
  }

  var region: Region? {
    didSet {
      guard let region, !view.isUserInteracting, camera == nil else {
        return
      }
      applyRegion(region)
    }
  }

  var camera: Camera? {
    didSet {
      guard let camera, !view.isUserInteracting else {
        return
      }
      updateMapCamera(camera, animated: false)
    }
  }

  var scrollEnabled: Bool? {
    didSet {
      view.isScrollEnabled = scrollEnabled ?? true
    }
  }

  var zoomEnabled: Bool? {
    didSet {
      view.isZoomEnabled = zoomEnabled ?? true
    }
  }

  var rotateEnabled: Bool? {
    didSet {
      view.isRotateEnabled = rotateEnabled ?? true
    }
  }

  var pitchEnabled: Bool? {
    didSet {
      view.isPitchEnabled = pitchEnabled ?? true
    }
  }

  var showsUserLocation: Bool? {
    didSet {
      applyUserLocationSettings(to: view)
    }
  }

  var followsUserLocation: Bool? {
    didSet {
      applyUserLocationSettings(to: view)
    }
  }

  var showsCompass: Bool? {
    didSet {
      applyControlSettings(to: view)
    }
  }

  var showsScale: Bool? {
    didSet {
      applyControlSettings(to: view)
    }
  }

  var customMapStyle: String? {
    didSet {
      applyCustomMapStyle(to: view)
    }
  }

  var googleMapId: String?

  var clusteringEnabled: Bool? {
    didSet {
      overlayController.setClusteringEnabled(clusteringEnabled == true)
    }
  }

  var mapPadding: EdgePadding? {
    didSet {
      applyMapPadding(to: view)
    }
  }

  var markerEnteringAnimation: OverlayEnteringAnimationDescriptor? {
    didSet {
      overlayController.markerEnteringAnimation = markerEnteringAnimation
    }
  }

  var clusterEnteringAnimation: OverlayEnteringAnimationDescriptor? {
    didSet {
      overlayController.clusterEnteringAnimation = clusterEnteringAnimation
    }
  }

  var onRegionChange: ((Region, RegionChangeDetails) -> Void)?
  var onRegionChangeComplete: ((Region, RegionChangeDetails) -> Void)?
  var onMapReady: (() -> Void)? {
    didSet {
      deliverMapReadyIfPossible()
    }
  }
  var onPress: ((Coordinate) -> Void)?
  var onPoiPress: ((NativePoiPressEvent) -> Void)? {
    didSet {
      applySelectablePoiFeatures(to: view)
    }
  }

  /// Native MapKit detail presentation for selected POIs (iOS 18+). On iOS 18+ it enables
  /// selectable points of interest on its own, independently of `onPoiPress`. On earlier
  /// versions it is ignored and does not turn selection on.
  var applePoiDetailPresentation: ApplePoiDetailPresentation? {
    didSet {
      applySelectablePoiFeatures(to: view)
    }
  }
  var onLongPress: ((Coordinate) -> Void)?

  var markers: [MarkerDescriptor]? {
    didSet {
      overlayController.setMarkers(markers)
    }
  }

  var polylines: [PolylineDescriptor]? {
    didSet {
      overlayController.updatePolylines(polylines)
    }
  }

  var polygons: [PolygonDescriptor]? {
    didSet {
      overlayController.updatePolygons(polygons)
    }
  }

  var circles: [CircleDescriptor]? {
    didSet {
      overlayController.updateCircles(circles)
    }
  }

  var onMarkerPress: ((String) -> Void)?
  var onMarkerDragEnd: ((String, Coordinate) -> Void)?
  var onPolylinePress: ((String) -> Void)?
  var onPolygonPress: ((String) -> Void)?
  var onCirclePress: ((String) -> Void)?
  var onClusterPress: (([String], Coordinate) -> Void)?

  func fetchCamera() throws -> Promise<Camera> {
    Promise.resolved(withResult: view.camera.toCamera())
  }

  func applyCamera(camera: Camera) throws -> Promise<Void> {
    updateMapCamera(camera, animated: false)
    return Promise.resolved()
  }

  func animateCamera(camera: Camera, duration: Double?) throws -> Promise<Void> {
    let animationDuration = duration ?? Self.defaultAnimationDuration
    let promise = Promise<Void>()
    let move = CameraMoveCompletion(promise: promise)

    // UIKit calls the completion when the animation runs out, and straight away when a
    // later camera animation replaces it.
    let didMove = updateMapCamera(camera, animated: true, duration: animationDuration) {
      move.settle()
    }

    // Nothing handed over - an invalid camera, or the one the map is already at - or a
    // camera MapKit applied without animating, as it does for a map that is not on
    // screen yet: either way there is nothing left to wait for.
    guard didMove, isRegionChanging else {
      move.settle()
      return promise
    }

    // Also settled when MapKit reports the camera at rest: a fit or a `region` update
    // that cuts this animation short does not end it for UIKit, whose completion then
    // waits out the full duration.
    cameraMoves.track(move, duration: animationDuration)
    return promise
  }

  func getVisibleRegion() throws -> Promise<VisibleRegion> {
    Promise.resolved(withResult: view.toVisibleRegion())
  }

  func fitToCoordinates(
    coordinates: [Coordinate],
    padding: EdgePadding?,
    animated: Bool?
  ) throws -> Promise<Void> {
    let validCoordinates = coordinates.filter { $0.isValid }
    guard !validCoordinates.isEmpty else {
      return Promise.resolved()
    }

    var mapRect = MKMapRect.null
    for coordinate in validCoordinates {
      let mapPoint = MKMapPoint(
        CLLocationCoordinate2D(
          latitude: coordinate.latitude,
          longitude: coordinate.longitude
        )
      )
      let pointRect = MKMapRect(x: mapPoint.x, y: mapPoint.y, width: 0, height: 0)
      mapRect = mapRect.union(pointRect)
    }

    let edgePadding = padding?.toUIEdgeInsets() ?? .zero
    view.setVisibleMapRect(mapRect, edgePadding: edgePadding, animated: animated ?? true)

    // MapKit reports from inside that call: the end of any move this one cut short, the
    // start of this one, and its end too when it jumps rather than animates - which it
    // does for a rect far from the one on screen, `animated` or not. A rect it already
    // shows it ignores without a word. Only a fit still under way has anything left to
    // wait for.
    guard isRegionChanging else {
      return Promise.resolved()
    }

    // `setVisibleMapRect` takes no completion handler: the `regionDidChange` that ends
    // the move settles it.
    let promise = Promise<Void>()
    cameraMoves.track(promise, duration: Self.fitAnimationDuration)
    return promise
  }

  func applyRegion(_ region: Region, animated: Bool = false) {
    // `setRegion` raises an NSException Swift cannot catch, so there is no
    // recovery once an invalid region has been handed over. `regionThatFits`
    // pulls a span whose edges run past a pole back to something MapKit can
    // show, as `animateToClusterRegion` already does; the guard covers what it
    // cannot fix - a non-finite or out-of-range center.
    guard region.isValid else {
      return
    }

    let targetRegion = view.regionThatFits(region.toMKCoordinateRegion())
    guard !view.region.approximatelyEquals(targetRegion) else {
      return
    }

    view.setRegion(targetRegion, animated: animated)
  }

  /// Moves the camera, and reports whether anything was handed to MapKit: nothing is for
  /// an invalid camera, or for the one the map is already at.
  @discardableResult
  func updateMapCamera(
    _ camera: Camera,
    animated: Bool,
    duration: Double = 0,
    completion: (() -> Void)? = nil
  ) -> Bool {
    // `setCamera` raises an Objective-C NSException - `Invalid camera
    // centerCoordinate` - from `-[MKMapCamera _validate]` for a center MapKit
    // cannot place, and Swift cannot catch that. The framing values do not
    // raise, but a non-finite one collapses the altitude or leaves
    // `view.region` reading back as `NaN`.
    guard camera.isValid else {
      return false
    }

    let mapCamera = camera.toMKMapCamera()
    guard !view.camera.approximatelyEquals(mapCamera) else {
      return false
    }

    if animated {
      UIView.animate(
        withDuration: duration,
        animations: {
          self.view.camera = mapCamera
        },
        completion: { _ in
          completion?()
        }
      )
    } else {
      view.camera = mapCamera
    }

    return true
  }

  // Derived from MKCoordinateRegion (center + span). May differ from Android
  // bounds-derived region when the map is rotated or pitched.
  func currentRegion() -> Region {
    view.region.toRegion()
  }

  func scheduleMarkerViewportRefresh() {
    overlayController.scheduleViewportRefresh()
  }

  func animateToClusterRegion(_ region: MKCoordinateRegion) {
    view.setRegion(view.regionThatFits(region), animated: true)
  }

  func handleRegionWillChange(userInteracting: Bool) {
    startLiveClustering()
    isRegionChanging = true
    pendingRegionChangeEnd?.cancel()
    pendingRegionChangeEnd = nil
    regionChanges.moveStarted(isGesture: userInteracting)
  }

  func handleVisibleRegionChange() {
    regionChanges.cameraMoved()
  }

  func handleRegionDidChange() {
    stopLiveClustering()
    isRegionChanging = false
    cameraMoves.settleAll()

    // MapKit reports the end of each leg of a gesture, including the ones the
    // finger is still driving. The move is only over once it lets go.
    guard !view.isUserInteracting else {
      return
    }

    // A camera command that cuts an animation short makes MapKit end that move and
    // start the next back to back, from inside the command. Google Maps reports the
    // same thing as one move, so the end waits a turn of the run loop, and a move that
    // starts in the meantime carries on the one before.
    let end = DispatchWorkItem { [weak self] in
      self?.pendingRegionChangeEnd = nil
      self?.regionChanges.cameraStopped()
    }
    pendingRegionChangeEnd = end
    DispatchQueue.main.async(execute: end)
  }

  func startLiveClustering() {
    guard liveClusterTimer == nil else {
      return
    }
    let timer = Timer(timeInterval: MarkerRenderPipeline.liveRefreshInterval, repeats: true) { [weak self] _ in
      self?.overlayController.refreshNow()
    }
    RunLoop.main.add(timer, forMode: .common)
    liveClusterTimer = timer
  }

  func stopLiveClustering() {
    liveClusterTimer?.invalidate()
    liveClusterTimer = nil
    overlayController.scheduleViewportRefresh(immediate: true)
  }

  func notifyMapReadyIfNeeded() {
    guard !isMapReady else {
      return
    }

    isMapReady = true
    overlayController.setMarkers(markers)
    deliverMapReadyIfPossible()
  }

  private func deliverMapReadyIfPossible() {
    guard isMapReady, !hasDeliveredMapReady, let onMapReady else {
      return
    }

    hasDeliveredMapReady = true
    onMapReady()
  }

  func notifyPress(at point: CGPoint) {
    let coordinate = view.convert(point, toCoordinateFrom: view)
    onPress?(Coordinate(latitude: coordinate.latitude, longitude: coordinate.longitude))
  }

  func notifyPoiPress(annotation: MKMapFeatureAnnotation) {
    let resolvedCategory = ApplePoiCategory.from(annotation.pointOfInterestCategory)
    let coordinate = annotation.coordinate
    onPoiPress?(
      NativePoiPressEvent(
        provider: .apple,
        coordinate: Coordinate(latitude: coordinate.latitude, longitude: coordinate.longitude),
        name: annotation.title ?? nil,
        category: resolvedCategory.category,
        rawCategory: resolvedCategory.rawCategory,
        placeId: nil
      )
    )
  }

  func notifyLongPress(at point: CGPoint) {
    let coordinate = view.convert(point, toCoordinateFrom: view)
    onLongPress?(Coordinate(latitude: coordinate.latitude, longitude: coordinate.longitude))
  }

  func notifyOverlayPress(at point: CGPoint) -> Bool {
    guard let overlayId = overlayController.overlayId(at: point) else {
      return false
    }

    switch overlayController.overlayKind(for: overlayId) {
    case .polyline:
      onPolylinePress?(overlayId)
    case .polygon:
      onPolygonPress?(overlayId)
    case .circle:
      onCirclePress?(overlayId)
    case .none:
      return false
    }

    return true
  }

  func renderer(for overlay: MKOverlay) -> MKOverlayRenderer? {
    overlayController.renderer(for: overlay)
  }

  func prepareForRecycle() {
    liveClusterTimer?.invalidate()
    liveClusterTimer = nil
    cameraMoves.settleAll()
    pendingRegionChangeEnd?.cancel()
    pendingRegionChangeEnd = nil
    isRegionChanging = false
    regionChanges.reset()
    isMapReady = false
    hasDeliveredMapReady = false
    onRegionChange = nil
    onRegionChangeComplete = nil
    onMapReady = nil
    onPress = nil
    onPoiPress = nil
    applePoiDetailPresentation = nil
    onLongPress = nil
    onMarkerPress = nil
    onMarkerDragEnd = nil
    onPolylinePress = nil
    onPolygonPress = nil
    onCirclePress = nil
    onClusterPress = nil
    markers = nil
    polylines = nil
    polygons = nil
    circles = nil
    overlayController.reset()
    mapType = .standard
    region = nil
    camera = nil
    scrollEnabled = nil
    zoomEnabled = nil
    rotateEnabled = nil
    pitchEnabled = nil
    showsUserLocation = nil
    followsUserLocation = nil
    showsCompass = nil
    showsScale = nil
    customMapStyle = nil
    googleMapId = nil
    clusteringEnabled = nil
    mapPadding = nil
    markerEnteringAnimation = nil
    clusterEnteringAnimation = nil
    view.mapType = .standard
    view.isScrollEnabled = true
    view.isZoomEnabled = true
    view.isRotateEnabled = true
    view.isPitchEnabled = true
    view.showsUserLocation = false
    view.userTrackingMode = .none
    view.showsCompass = true
    view.showsScale = false
    view.layoutMargins = .zero
    if #available(iOS 16.0, *) {
      view.preferredConfiguration = MapType.standard.toMKMapConfiguration()
      view.selectableMapFeatures = []
    }
  }

  private func applyUserLocationSettings(to mapView: MKMapView) {
    mapView.showsUserLocation = showsUserLocation ?? false
    if followsUserLocation == true, showsUserLocation == true {
      mapView.userTrackingMode = .follow
    } else {
      mapView.userTrackingMode = .none
    }
  }

  private func applyControlSettings(to mapView: MKMapView) {
    mapView.showsCompass = showsCompass ?? true
    mapView.showsScale = showsScale ?? false
    mapView.applyScaleAppearance()
  }

  private func applyMapPadding(to mapView: MKMapView) {
    let insets = mapPadding?.toUIEdgeInsets() ?? .zero
    mapView.layoutMargins = insets
  }

  private func applyCustomMapStyle(to mapView: MKMapView) {
    if #available(iOS 16.0, *) {
      CustomMapStyleParser.apply(json: customMapStyle, mapType: mapType, to: mapView)
    }
  }

  private func applySelectablePoiFeatures(to mapView: MKMapView) {
    guard #available(iOS 16.0, *) else {
      return
    }

    // Presentation accessories exist only on iOS 18+. Counting the prop on 16/17 would
    // enable selection with nothing to show and can swallow the next background press.
    let wantsNativeDetails: Bool
    if #available(iOS 18.0, *) {
      wantsNativeDetails = applePoiDetailPresentation != nil
    } else {
      wantsNativeDetails = false
    }

    let wantsSelectablePois = onPoiPress != nil || wantsNativeDetails
    mapView.selectableMapFeatures = wantsSelectablePois ? .pointsOfInterest : []
  }

}

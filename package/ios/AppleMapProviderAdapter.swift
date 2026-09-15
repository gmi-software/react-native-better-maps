import MapKit
import NitroModules
import UIKit

final class AppleMapProviderAdapter: MapProviderAdapter {
  private let mapViewDelegate = HybridMapViewDelegate()
  private var isUserRegionChange = false
  private var isMapReady = false
  private var hasDeliveredMapReady = false
  private lazy var cameraStreamClock = FrameClock { [weak self] frame in
    self?.cameraStreamTick(frame)
  }
  private var lastCameraEmitTime: CFTimeInterval = 0
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
      NitroFlatPinAnnotationView.self,
      forAnnotationViewWithReuseIdentifier: NitroFlatPinAnnotationView.reuseIdentifier
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

  var pinStyle: MarkerPinStyle? {
    didSet {
      guard pinStyle != oldValue else {
        return
      }
      overlayController.reloadMarkerViews()
    }
  }

  var markerRendering: MarkerRendering? {
    didSet {
      guard markerRendering != oldValue else {
        return
      }
      overlayController.setMarkerRendering(markerRendering ?? .views)
    }
  }

  var onRegionChange: ((Region) -> Void)?
  var onRegionChangeComplete: ((Region) -> Void)?
  var onCameraMove: ((Camera) -> Void)? {
    didSet {
      if onCameraMove == nil {
        cameraStreamClock.stop()
      }
    }
  }
  var cameraMoveThrottleMs: Double?
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
  var onLongPress: ((Coordinate) -> Void)?

  var markerCollection: HybridMarkerCollection? {
    didSet {
      overlayController.attach(store: markerCollection?.store)
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
  var onClusterPress: ((NativeClusterPressEvent) -> Void)?

  func fetchCamera() throws -> Promise<Camera> {
    Promise.resolved(withResult: view.camera.toCamera())
  }

  func applyCamera(camera: Camera) throws {
    updateMapCamera(camera, animated: false)
  }

  func animateCamera(camera: Camera, duration: Double?) throws {
    let animationDuration = duration ?? 0.25
    updateMapCamera(camera, animated: true, duration: animationDuration)
  }

  func getVisibleRegion() throws -> Promise<VisibleRegion> {
    Promise.resolved(withResult: view.toVisibleRegion())
  }

  func fitToCoordinates(
    coordinates: [Coordinate],
    padding: EdgePadding?,
    animated: Bool?
  ) throws {
    guard !coordinates.isEmpty else {
      return
    }

    var mapRect = MKMapRect.null
    for coordinate in coordinates {
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
    let shouldAnimate = animated ?? true
    view.setVisibleMapRect(
      mapRect,
      edgePadding: edgePadding,
      animated: shouldAnimate
    )
  }

  func getClusterMembers(clusterId: String) throws -> Promise<[String]> {
    Promise.resolved(withResult: overlayController.clusterMembers(id: clusterId))
  }

  func applyRegion(_ region: Region, animated: Bool = false) {
    let targetRegion = region.toMKCoordinateRegion()
    guard !view.region.approximatelyEquals(targetRegion) else {
      return
    }

    view.setRegion(targetRegion, animated: animated)
  }

  func updateMapCamera(_ camera: Camera, animated: Bool, duration: Double = 0) {
    let mapCamera = camera.toMKMapCamera()
    guard !view.camera.approximatelyEquals(mapCamera) else {
      return
    }

    if animated {
      UIView.animate(
        withDuration: duration,
        animations: {
          self.view.camera = mapCamera
        }
      )
    } else {
      view.camera = mapCamera
    }
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
    startCameraStream()
    guard userInteracting, !isUserRegionChange else {
      return
    }
    isUserRegionChange = true
    emitRegionChange(complete: false)
  }

  func handleRegionDidChange() {
    stopLiveClustering()
    stopCameraStream()

    guard isUserRegionChange else {
      return
    }

    guard !view.isUserInteracting else {
      return
    }

    emitRegionChange(complete: true)
    isUserRegionChange = false
  }

  private func emitRegionChange(complete: Bool) {
    let region = currentRegion()
    if complete {
      onRegionChangeComplete?(region)
    } else {
      onRegionChange?(region)
    }
  }

  /// Emits `onCameraMove` on a display link while the camera moves, at most
  /// every `cameraMoveThrottleMs`, and once more with the final camera. Nothing
  /// runs unless the callback is set.
  private func startCameraStream() {
    guard onCameraMove != nil, !cameraStreamClock.isRunning else {
      return
    }
    lastCameraEmitTime = 0
    cameraStreamClock.start()
  }

  private func stopCameraStream() {
    guard cameraStreamClock.isRunning else {
      return
    }
    cameraStreamClock.stop()
    onCameraMove?(view.camera.toCamera())
  }

  private func cameraStreamTick(_ frame: FrameClock.Frame) {
    guard let onCameraMove else {
      cameraStreamClock.stop()
      return
    }
    let interval = max(0, (cameraMoveThrottleMs ?? 100) / 1000)
    guard frame.timestamp - lastCameraEmitTime >= interval else {
      return
    }
    lastCameraEmitTime = frame.timestamp
    onCameraMove(view.camera.toCamera())
  }

  func startLiveClustering() {
    overlayController.beginLiveRefresh()
  }

  func stopLiveClustering() {
    overlayController.endLiveRefresh()
  }

  func notifyMapReadyIfNeeded() {
    guard !isMapReady else {
      return
    }

    isMapReady = true
    overlayController.reapplyMarkers()
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

  /// A tap on the sprite layer: marker presses fire here, once, whether or not
  /// the marker is promoted to a selected annotation view for its callout;
  /// cluster presses zoom like a cluster view would.
  func notifySpritePress(at point: CGPoint) -> Bool {
    guard let press = overlayController.pressSprite(at: point) else {
      return false
    }

    switch press {
    case let .marker(id), let .promoted(id):
      onMarkerPress?(id)
    case let .cluster(id, coordinate, count, region):
      onClusterPress?(NativeClusterPressEvent(
        clusterId: id,
        count: Double(count),
        coordinate: Coordinate(latitude: coordinate.latitude, longitude: coordinate.longitude)
      ))
      animateToClusterRegion(region)
    }
    return true
  }

  func handleAnnotationDeselect(_ annotation: MKAnnotation?) {
    overlayController.demoteSprite(matching: annotation)
  }

  func isPromotedSprite(_ annotation: MKAnnotation?) -> Bool {
    overlayController.isPromotedSprite(annotation)
  }

  func prepareForRecycle() {
    cameraStreamClock.stop()
    isUserRegionChange = false
    isMapReady = false
    hasDeliveredMapReady = false
    onRegionChange = nil
    onRegionChangeComplete = nil
    onCameraMove = nil
    cameraMoveThrottleMs = nil
    onMapReady = nil
    onPress = nil
    onPoiPress = nil
    onLongPress = nil
    onMarkerPress = nil
    onMarkerDragEnd = nil
    onPolylinePress = nil
    onPolygonPress = nil
    onCirclePress = nil
    onClusterPress = nil
    markerCollection = nil
    polylines = nil
    polygons = nil
    circles = nil
    overlayController.reset()
    markerRendering = nil
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
    pinStyle = nil
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
    if #available(iOS 16.0, *) {
      mapView.selectableMapFeatures = onPoiPress == nil ? [] : .pointsOfInterest
    }
  }

}

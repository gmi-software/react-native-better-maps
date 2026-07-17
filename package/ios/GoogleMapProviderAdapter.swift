#if canImport(GoogleMaps)
import CoreLocation
import GoogleMaps
import MapKit
import NitroModules
import QuartzCore
import UIKit

final class GoogleMapProviderAdapter: NSObject, MapProviderAdapter {
  private static let liveGestureRefreshInterval: CFTimeInterval = 0.18
  private static let liveGestureAnimationBudget = 24

  private var isProgrammaticUpdate = false
  private var pendingProgrammaticUpdateIDs: [Int] = []
  private var nextProgrammaticUpdateID = 0
  private var isMapReady = false
  private var hasDeliveredMapReady = false
  private var isUserGestureMoving = false
  private var lastLiveMarkerRefreshTime: CFTimeInterval = 0
  private var myLocationObservation: NSKeyValueObservation?
  private weak var followedLocationMapView: GMSMapView?
  private var _googleMapId: String?

  fileprivate lazy var overlayController: GoogleMapOverlayController = {
    let controller = GoogleMapOverlayController(mapView: view)
    controller.animateToClusterRegion = { [weak self] region in
      self?.animateToClusterRegion(region)
    }
    return controller
  }()

  var contentView: UIView {
    view
  }

  lazy var view: GMSMapView = {
    let camera = self.camera?.toGMSCameraPosition()
      ?? GMSCameraPosition(latitude: 0, longitude: 0, zoom: 10)
    let mapView: GMSMapView
    if let googleMapId = _googleMapId?.trimmingCharacters(in: .whitespacesAndNewlines),
       !googleMapId.isEmpty {
      mapView = GMSMapView(
        frame: .zero,
        mapID: GMSMapID(identifier: googleMapId),
        camera: camera
      )
    } else {
      mapView = GMSMapView(frame: .zero, camera: camera)
    }

    mapView.delegate = self
    mapView.mapType = mapType.toGMSMapViewType()
    applyGestureSettings(to: mapView)
    applyUserLocationSettings(to: mapView)
    applyControlSettings(to: mapView)
    applyMapPadding(to: mapView)
    applyCustomMapStyle(to: mapView)
    return mapView
  }()

  init(googleMapId: String?) throws {
    try GoogleMapsAPIKey.configureIfNeeded()
    _googleMapId = googleMapId
    super.init()
  }

  deinit {
    stopFollowingUserLocation()
  }

  var mapType: MapType = .standard {
    didSet {
      view.mapType = mapType.toGMSMapViewType()
    }
  }

  var region: Region? {
    didSet {
      guard let region, !isProgrammaticUpdate, camera == nil else {
        return
      }
      applyRegion(region)
    }
  }

  var camera: Camera? {
    didSet {
      guard let camera, !isProgrammaticUpdate else {
        return
      }
      updateMapCamera(camera, animated: false)
    }
  }

  var scrollEnabled: Bool? {
    didSet {
      applyGestureSettings(to: view)
    }
  }

  var zoomEnabled: Bool? {
    didSet {
      applyGestureSettings(to: view)
    }
  }

  var rotateEnabled: Bool? {
    didSet {
      applyGestureSettings(to: view)
    }
  }

  var pitchEnabled: Bool? {
    didSet {
      applyGestureSettings(to: view)
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

  var showsScale: Bool?

  var customMapStyle: String? {
    didSet {
      applyCustomMapStyle(to: view)
    }
  }

  var googleMapId: String? {
    get { _googleMapId }
    set { _googleMapId = newValue }
  }

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

  var onRegionChange: ((Region) -> Void)?
  var onRegionChangeComplete: ((Region) -> Void)?
  var onMapReady: (() -> Void)? {
    didSet {
      deliverMapReadyIfPossible()
    }
  }
  var onPress: ((Coordinate) -> Void)?
  var onPoiPress: ((NativePoiPressEvent) -> Void)?
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

  var onMarkerPress: ((String) -> Void)? {
    didSet { overlayController.onMarkerPress = onMarkerPress }
  }
  var onMarkerDragEnd: ((String, Coordinate) -> Void)? {
    didSet { overlayController.onMarkerDragEnd = onMarkerDragEnd }
  }
  var onPolylinePress: ((String) -> Void)? {
    didSet { overlayController.onPolylinePress = onPolylinePress }
  }
  var onPolygonPress: ((String) -> Void)? {
    didSet { overlayController.onPolygonPress = onPolygonPress }
  }
  var onCirclePress: ((String) -> Void)? {
    didSet { overlayController.onCirclePress = onCirclePress }
  }
  var onClusterPress: (([String], Coordinate) -> Void)? {
    didSet { overlayController.onClusterPress = onClusterPress }
  }

  func fetchCamera() throws -> Promise<Camera> {
    Promise.resolved(withResult: view.camera.toCamera())
  }

  func applyCamera(camera: Camera) throws {
    updateMapCamera(camera, animated: false)
  }

  func animateCamera(camera: Camera, duration: Double?) throws {
    updateMapCamera(camera, animated: true, duration: duration ?? 0.25)
  }

  func getVisibleRegion() throws -> Promise<VisibleRegion> {
    Promise.resolved(withResult: view.toNitroVisibleRegion())
  }

  func fitToCoordinates(
    coordinates: [Coordinate],
    padding: EdgePadding?,
    animated: Bool?
  ) throws {
    guard !coordinates.isEmpty else {
      return
    }

    var bounds = GMSCoordinateBounds()
    for coordinate in coordinates {
      bounds = bounds.includingCoordinate(coordinate.toCLLocationCoordinate2D())
    }
    let edgePadding = padding?.toUIEdgeInsets() ?? .zero
    let update = GMSCameraUpdate.fit(bounds, with: edgePadding)
    applyCameraUpdate(update, animated: animated ?? true, duration: nil)
  }

  func prepareForRecycle() {
    isUserGestureMoving = false
    lastLiveMarkerRefreshTime = 0
    isProgrammaticUpdate = false
    pendingProgrammaticUpdateIDs.removeAll()
    isMapReady = false
    hasDeliveredMapReady = false
    view.delegate = nil
    overlayController.reset()
    onRegionChange = nil
    onRegionChangeComplete = nil
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
    markers = nil
    polylines = nil
    polygons = nil
    circles = nil
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
  }

  private func applyRegion(_ region: Region, animated: Bool = false) {
    applyCameraUpdate(
      GMSCameraUpdate.fit(region.toGMSCoordinateBounds(), with: mapPadding?.toUIEdgeInsets() ?? .zero),
      animated: animated,
      duration: nil
    )
  }

  private func updateMapCamera(_ camera: Camera, animated: Bool, duration: Double? = nil) {
    let update = GMSCameraUpdate.setCamera(camera.toGMSCameraPosition(current: view.camera))
    applyCameraUpdate(update, animated: animated, duration: duration)
  }

  private func applyCameraUpdate(
    _ update: GMSCameraUpdate,
    animated: Bool,
    duration: Double?
  ) {
    let updateID = beginProgrammaticUpdate()
    if animated {
      if let duration {
        CATransaction.begin()
        CATransaction.setAnimationDuration(duration)
        CATransaction.setCompletionBlock { [weak self] in
          self?.endProgrammaticUpdate(updateID)
        }
        view.animate(with: update)
        CATransaction.commit()
        scheduleProgrammaticUpdateFallback(for: updateID, delay: duration + 0.1)
      } else {
        view.animate(with: update)
        scheduleProgrammaticUpdateFallback(for: updateID, delay: 0.5)
      }
    } else {
      view.moveCamera(update)
      scheduleProgrammaticUpdateFallback(for: updateID, delay: 0)
    }
  }

  private func beginProgrammaticUpdate() -> Int {
    nextProgrammaticUpdateID += 1
    let updateID = nextProgrammaticUpdateID
    pendingProgrammaticUpdateIDs.append(updateID)
    isProgrammaticUpdate = true
    return updateID
  }

  private func endProgrammaticUpdate(_ updateID: Int? = nil) {
    if let updateID {
      guard let index = pendingProgrammaticUpdateIDs.firstIndex(of: updateID) else {
        return
      }
      pendingProgrammaticUpdateIDs.remove(at: index)
    } else if !pendingProgrammaticUpdateIDs.isEmpty {
      pendingProgrammaticUpdateIDs.removeFirst()
    }

    isProgrammaticUpdate = !pendingProgrammaticUpdateIDs.isEmpty
  }

  private func scheduleProgrammaticUpdateFallback(for updateID: Int, delay: TimeInterval) {
    DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
      self?.endProgrammaticUpdate(updateID)
    }
  }

  private func refreshVisibleMarkers() {
    overlayController.scheduleViewportRefresh(immediate: true)
  }

  private func refreshVisibleMarkersForInitialRenderIfNeeded() {
    guard !isMapReady else {
      return
    }
    refreshVisibleMarkers()
  }

  private func startGestureMarkerRefresh() {
    isUserGestureMoving = true
    lastLiveMarkerRefreshTime = 0
    refreshGestureMarkersIfNeeded()
  }

  private func refreshGestureMarkersIfNeeded() {
    guard isUserGestureMoving else {
      return
    }

    let now = CACurrentMediaTime()
    guard now - lastLiveMarkerRefreshTime >= Self.liveGestureRefreshInterval else {
      return
    }

    lastLiveMarkerRefreshTime = now
    overlayController.refreshViewportMarkers(
      animateEntering: true,
      animationBudget: Self.liveGestureAnimationBudget
    )
  }

  private func stopGestureMarkerRefresh() {
    isUserGestureMoving = false
    lastLiveMarkerRefreshTime = 0
  }

  private func animateToClusterRegion(_ region: MKCoordinateRegion) {
    let bounds = region.toRegion().toGMSCoordinateBounds()
    view.animate(with: GMSCameraUpdate.fit(bounds, withPadding: 72))
  }

  private func notifyRegionChange(complete: Bool) {
    guard !isProgrammaticUpdate else {
      return
    }

    let region = view.currentNitroRegion()
    if complete {
      onRegionChangeComplete?(region)
    } else {
      onRegionChange?(region)
    }
  }

  private func notifyMapReadyIfNeeded() {
    isMapReady = true
    deliverMapReadyIfPossible()
  }

  private func deliverMapReadyIfPossible() {
    guard isMapReady, !hasDeliveredMapReady, let onMapReady else {
      return
    }

    hasDeliveredMapReady = true
    onMapReady()
  }

  private func applyGestureSettings(to mapView: GMSMapView) {
    mapView.settings.scrollGestures = scrollEnabled ?? true
    mapView.settings.zoomGestures = zoomEnabled ?? true
    mapView.settings.rotateGestures = rotateEnabled ?? true
    mapView.settings.tiltGestures = pitchEnabled ?? true
  }

  private func applyUserLocationSettings(to mapView: GMSMapView) {
    let shouldShowUserLocation = showsUserLocation ?? false
    let shouldFollowUserLocation = followsUserLocation == true && shouldShowUserLocation

    mapView.isMyLocationEnabled = shouldShowUserLocation
    mapView.settings.myLocationButton = shouldFollowUserLocation

    if shouldFollowUserLocation {
      startFollowingUserLocation(on: mapView)
      animateToCurrentUserLocation(on: mapView)
    } else {
      stopFollowingUserLocation()
    }
  }

  private func startFollowingUserLocation(on mapView: GMSMapView) {
    if followedLocationMapView !== mapView {
      stopFollowingUserLocation()
    }

    guard myLocationObservation == nil else {
      return
    }

    followedLocationMapView = mapView
    myLocationObservation = mapView.observe(\.myLocation, options: [.new]) { [weak self, weak mapView] _, change in
      guard let self,
            self.followsUserLocation == true,
            self.showsUserLocation == true,
            let mapView,
            let location = change.newValue ?? mapView.myLocation else {
        return
      }

      self.animateToUserLocation(location, on: mapView)
    }
  }

  private func stopFollowingUserLocation() {
    myLocationObservation?.invalidate()
    myLocationObservation = nil
    followedLocationMapView = nil
  }

  private func animateToCurrentUserLocation(on mapView: GMSMapView) {
    guard let location = mapView.myLocation else {
      return
    }

    animateToUserLocation(location, on: mapView)
  }

  private func animateToUserLocation(_ location: CLLocation, on mapView: GMSMapView) {
    let updateID = beginProgrammaticUpdate()
    mapView.animate(with: GMSCameraUpdate.setTarget(location.coordinate))
    scheduleProgrammaticUpdateFallback(for: updateID, delay: 0.5)
  }

  private func applyControlSettings(to mapView: GMSMapView) {
    mapView.settings.compassButton = showsCompass ?? true
  }

  private func applyMapPadding(to mapView: GMSMapView) {
    mapView.padding = mapPadding?.toUIEdgeInsets() ?? .zero
  }

  private func applyCustomMapStyle(to mapView: GMSMapView) {
    guard let customMapStyle, !customMapStyle.isEmpty else {
      mapView.mapStyle = nil
      return
    }

    mapView.mapStyle = try? GMSMapStyle(jsonString: customMapStyle)
  }
}

extension GoogleMapProviderAdapter: GMSMapViewDelegate {
  func mapView(_ mapView: GMSMapView, willMove gesture: Bool) {
    if gesture {
      startGestureMarkerRefresh()
      notifyRegionChange(complete: false)
    }
  }

  func mapView(_ mapView: GMSMapView, didChange position: GMSCameraPosition) {
    refreshGestureMarkersIfNeeded()
  }

  func mapView(_ mapView: GMSMapView, idleAt position: GMSCameraPosition) {
    stopGestureMarkerRefresh()
    refreshVisibleMarkers()
    notifyRegionChange(complete: true)
    endProgrammaticUpdate()
    notifyMapReadyIfNeeded()
  }

  func mapView(_ mapView: GMSMapView, didTapAt coordinate: CLLocationCoordinate2D) {
    onPress?(Coordinate(latitude: coordinate.latitude, longitude: coordinate.longitude))
  }

  func mapView(
    _ mapView: GMSMapView,
    didTapPOIWithPlaceID placeID: String,
    name: String,
    location: CLLocationCoordinate2D
  ) {
    onPoiPress?(
      NativePoiPressEvent(
        provider: .google,
        coordinate: Coordinate(latitude: location.latitude, longitude: location.longitude),
        name: name,
        category: nil,
        rawCategory: nil,
        placeId: placeID
      )
    )
  }

  func mapView(_ mapView: GMSMapView, didLongPressAt coordinate: CLLocationCoordinate2D) {
    onLongPress?(Coordinate(latitude: coordinate.latitude, longitude: coordinate.longitude))
  }

  func mapView(_ mapView: GMSMapView, didTap marker: GMSMarker) -> Bool {
    overlayController.handleMarkerTap(marker)
  }

  func mapView(_ mapView: GMSMapView, didEndDragging marker: GMSMarker) {
    overlayController.handleMarkerDragEnd(marker)
  }

  func mapView(_ mapView: GMSMapView, didTap overlay: GMSOverlay) {
    overlayController.handleOverlayTap(overlay)
  }

  func mapViewSnapshotReady(_ mapView: GMSMapView) {
    refreshVisibleMarkersForInitialRenderIfNeeded()
    notifyMapReadyIfNeeded()
  }
}
#endif

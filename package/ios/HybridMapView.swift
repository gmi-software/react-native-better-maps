import NitroModules
import UIKit

final class HybridMapView: HybridMapViewSpec {
  private let containerView = UIView()
  private let lifecycleLock = NSLock()
  private var adapter: MapProviderAdapter?
  private var lifecycleGeneration: UInt64 = 0
  private var isRecycled = false

  private var _provider: MapProvider = .apple
  private var _mapType: MapType = .standard
  private var _region: Region?
  private var _camera: Camera?
  private var _scrollEnabled: Bool?
  private var _zoomEnabled: Bool?
  private var _rotateEnabled: Bool?
  private var _pitchEnabled: Bool?
  private var _showsUserLocation: Bool?
  private var _followsUserLocation: Bool?
  private var _showsCompass: Bool?
  private var _showsScale: Bool?
  private var _customMapStyle: String?
  private var _googleMapId: String?
  private var _clusteringEnabled: Bool?
  private var _mapPadding: EdgePadding?
  private var _markerEnteringAnimation: OverlayEnteringAnimationDescriptor?
  private var _clusterEnteringAnimation: OverlayEnteringAnimationDescriptor?
  private var _onRegionChange: ((Region) -> Void)?
  private var _onRegionChangeComplete: ((Region) -> Void)?
  private var _onMapReady: (() -> Void)?
  private var _onPress: ((Coordinate) -> Void)?
  private var _onPoiPress: ((NativePoiPressEvent) -> Void)?
  private var _onLongPress: ((Coordinate) -> Void)?
  private var _markers: [MarkerDescriptor]?
  private var _polylines: [PolylineDescriptor]?
  private var _polygons: [PolygonDescriptor]?
  private var _circles: [CircleDescriptor]?
  private var _onMarkerPress: ((String) -> Void)?
  private var _onMarkerDragEnd: ((String, Coordinate) -> Void)?
  private var _onPolylinePress: ((String) -> Void)?
  private var _onPolygonPress: ((String) -> Void)?
  private var _onCirclePress: ((String) -> Void)?
  private var _onClusterPress: (([String], Coordinate) -> Void)?

  lazy var view: UIView = {
    containerView
  }()

  var provider: MapProvider? {
    get { onMain { _provider } }
    set {
      let nextProvider = newValue ?? .apple
      onMain {
        guard nextProvider != _provider || adapter == nil else {
          return
        }

        _provider = nextProvider
        installAdapter(for: nextProvider)
      }
    }
  }

  var mapType: MapType {
    get { onMain { _mapType } }
    set {
      onMain {
        _mapType = newValue
        adapter?.mapType = newValue
      }
    }
  }

  var region: Region? {
    get { onMain { _region } }
    set {
      onMain {
        _region = newValue
        adapter?.region = newValue
      }
    }
  }

  var camera: Camera? {
    get { onMain { _camera } }
    set {
      onMain {
        _camera = newValue
        adapter?.camera = newValue
      }
    }
  }

  var scrollEnabled: Bool? {
    get { onMain { _scrollEnabled } }
    set {
      onMain {
        _scrollEnabled = newValue
        adapter?.scrollEnabled = newValue
      }
    }
  }

  var zoomEnabled: Bool? {
    get { onMain { _zoomEnabled } }
    set {
      onMain {
        _zoomEnabled = newValue
        adapter?.zoomEnabled = newValue
      }
    }
  }

  var rotateEnabled: Bool? {
    get { onMain { _rotateEnabled } }
    set {
      onMain {
        _rotateEnabled = newValue
        adapter?.rotateEnabled = newValue
      }
    }
  }

  var pitchEnabled: Bool? {
    get { onMain { _pitchEnabled } }
    set {
      onMain {
        _pitchEnabled = newValue
        adapter?.pitchEnabled = newValue
      }
    }
  }

  var showsUserLocation: Bool? {
    get { onMain { _showsUserLocation } }
    set {
      onMain {
        _showsUserLocation = newValue
        adapter?.showsUserLocation = newValue
      }
    }
  }

  var followsUserLocation: Bool? {
    get { onMain { _followsUserLocation } }
    set {
      onMain {
        _followsUserLocation = newValue
        adapter?.followsUserLocation = newValue
      }
    }
  }

  var showsCompass: Bool? {
    get { onMain { _showsCompass } }
    set {
      onMain {
        _showsCompass = newValue
        adapter?.showsCompass = newValue
      }
    }
  }

  var showsScale: Bool? {
    get { onMain { _showsScale } }
    set {
      onMain {
        _showsScale = newValue
        adapter?.showsScale = newValue
      }
    }
  }

  var customMapStyle: String? {
    get { onMain { _customMapStyle } }
    set {
      onMain {
        _customMapStyle = newValue
        adapter?.customMapStyle = newValue
      }
    }
  }

  var googleMapId: String? {
    get { onMain { _googleMapId } }
    set {
      onMain {
        guard _googleMapId != newValue else {
          return
        }

        _googleMapId = newValue
        if _provider == .google, adapter != nil {
          installAdapter(for: _provider)
        }
      }
    }
  }

  var clusteringEnabled: Bool? {
    get { onMain { _clusteringEnabled } }
    set {
      onMain {
        _clusteringEnabled = newValue
        adapter?.clusteringEnabled = newValue
      }
    }
  }

  var mapPadding: EdgePadding? {
    get { onMain { _mapPadding } }
    set {
      onMain {
        _mapPadding = newValue
        adapter?.mapPadding = newValue
      }
    }
  }

  var markerEnteringAnimation: OverlayEnteringAnimationDescriptor? {
    get { onMain { _markerEnteringAnimation } }
    set {
      onMain {
        _markerEnteringAnimation = newValue
        adapter?.markerEnteringAnimation = newValue
      }
    }
  }

  var clusterEnteringAnimation: OverlayEnteringAnimationDescriptor? {
    get { onMain { _clusterEnteringAnimation } }
    set {
      onMain {
        _clusterEnteringAnimation = newValue
        adapter?.clusterEnteringAnimation = newValue
      }
    }
  }

  var onRegionChange: ((Region) -> Void)? {
    get { onMain { _onRegionChange } }
    set {
      onMain {
        _onRegionChange = newValue
        adapter?.onRegionChange = newValue
      }
    }
  }

  var onRegionChangeComplete: ((Region) -> Void)? {
    get { onMain { _onRegionChangeComplete } }
    set {
      onMain {
        _onRegionChangeComplete = newValue
        adapter?.onRegionChangeComplete = newValue
      }
    }
  }

  var onMapReady: (() -> Void)? {
    get { onMain { _onMapReady } }
    set {
      onMain {
        _onMapReady = newValue
        adapter?.onMapReady = newValue
      }
    }
  }

  var onPress: ((Coordinate) -> Void)? {
    get { onMain { _onPress } }
    set {
      onMain {
        _onPress = newValue
        adapter?.onPress = newValue
      }
    }
  }

  var onPoiPress: ((NativePoiPressEvent) -> Void)? {
    get { onMain { _onPoiPress } }
    set {
      onMain {
        _onPoiPress = newValue
        adapter?.onPoiPress = newValue
      }
    }
  }

  var onLongPress: ((Coordinate) -> Void)? {
    get { onMain { _onLongPress } }
    set {
      onMain {
        _onLongPress = newValue
        adapter?.onLongPress = newValue
      }
    }
  }

  var markers: [MarkerDescriptor]? {
    get { onMain { _markers } }
    set {
      onMain {
        _markers = newValue
        adapter?.markers = newValue
      }
    }
  }

  var polylines: [PolylineDescriptor]? {
    get { onMain { _polylines } }
    set {
      onMain {
        _polylines = newValue
        adapter?.polylines = newValue
      }
    }
  }

  var polygons: [PolygonDescriptor]? {
    get { onMain { _polygons } }
    set {
      onMain {
        _polygons = newValue
        adapter?.polygons = newValue
      }
    }
  }

  var circles: [CircleDescriptor]? {
    get { onMain { _circles } }
    set {
      onMain {
        _circles = newValue
        adapter?.circles = newValue
      }
    }
  }

  var onMarkerPress: ((String) -> Void)? {
    get { onMain { _onMarkerPress } }
    set {
      onMain {
        _onMarkerPress = newValue
        adapter?.onMarkerPress = newValue
      }
    }
  }

  var onMarkerDragEnd: ((String, Coordinate) -> Void)? {
    get { onMain { _onMarkerDragEnd } }
    set {
      onMain {
        _onMarkerDragEnd = newValue
        adapter?.onMarkerDragEnd = newValue
      }
    }
  }

  var onPolylinePress: ((String) -> Void)? {
    get { onMain { _onPolylinePress } }
    set {
      onMain {
        _onPolylinePress = newValue
        adapter?.onPolylinePress = newValue
      }
    }
  }

  var onPolygonPress: ((String) -> Void)? {
    get { onMain { _onPolygonPress } }
    set {
      onMain {
        _onPolygonPress = newValue
        adapter?.onPolygonPress = newValue
      }
    }
  }

  var onCirclePress: ((String) -> Void)? {
    get { onMain { _onCirclePress } }
    set {
      onMain {
        _onCirclePress = newValue
        adapter?.onCirclePress = newValue
      }
    }
  }

  var onClusterPress: (([String], Coordinate) -> Void)? {
    get { onMain { _onClusterPress } }
    set {
      onMain {
        _onClusterPress = newValue
        adapter?.onClusterPress = newValue
      }
    }
  }

  func fetchCamera() throws -> Promise<Camera> {
    promiseOnMain { try $0.fetchCamera() }
  }

  func applyCamera(camera: Camera) throws {
    let lifecycle = currentLifecycleSnapshot()
    try onMain { try currentAdapter(matching: lifecycle).applyCamera(camera: camera) }
  }

  func animateCamera(camera: Camera, duration: Double?) throws {
    let lifecycle = currentLifecycleSnapshot()
    try onMain {
      try currentAdapter(matching: lifecycle)
        .animateCamera(camera: camera, duration: duration)
    }
  }

  func getVisibleRegion() throws -> Promise<VisibleRegion> {
    promiseOnMain { try $0.getVisibleRegion() }
  }

  func fitToCoordinates(
    coordinates: [Coordinate],
    padding: EdgePadding?,
    animated: Bool?
  ) throws {
    let lifecycle = currentLifecycleSnapshot()
    try onMain {
      try currentAdapter(matching: lifecycle).fitToCoordinates(
        coordinates: coordinates,
        padding: padding,
        animated: animated
      )
    }
  }

  func afterUpdate() {
    onMain {
      activateLifecycle()
    }
  }

  func prepareForRecycle() {
    onMain {
      recycleLifecycle()
      adapter?.prepareForRecycle()
      adapter?.contentView.removeFromSuperview()
      adapter = nil
      _provider = .apple
      _mapType = .standard
      _region = nil
      _camera = nil
      _scrollEnabled = nil
      _zoomEnabled = nil
      _rotateEnabled = nil
      _pitchEnabled = nil
      _showsUserLocation = nil
      _followsUserLocation = nil
      _showsCompass = nil
      _showsScale = nil
      _customMapStyle = nil
      _googleMapId = nil
      _clusteringEnabled = nil
      _mapPadding = nil
      _markerEnteringAnimation = nil
      _clusterEnteringAnimation = nil
      _markers = nil
      _polylines = nil
      _polygons = nil
      _circles = nil
      _onRegionChange = nil
      _onRegionChangeComplete = nil
      _onMapReady = nil
      _onPress = nil
      _onPoiPress = nil
      _onLongPress = nil
      _onMarkerPress = nil
      _onMarkerDragEnd = nil
      _onPolylinePress = nil
      _onPolygonPress = nil
      _onCirclePress = nil
      _onClusterPress = nil
    }
  }

  private func currentAdapter(
    matching lifecycle: (generation: UInt64, isRecycled: Bool)? = nil
  ) throws -> MapProviderAdapter {
    try validateActiveLifecycle(matching: lifecycle)

    if let adapter {
      return adapter
    }

    installAdapter(for: _provider)
    return adapter!
  }

  private func currentLifecycleSnapshot() -> (generation: UInt64, isRecycled: Bool) {
    lifecycleLock.lock()
    defer { lifecycleLock.unlock() }
    return (lifecycleGeneration, isRecycled)
  }

  private func activateLifecycle() {
    lifecycleLock.lock()
    if isRecycled {
      lifecycleGeneration &+= 1
      isRecycled = false
    }
    lifecycleLock.unlock()
  }

  private func recycleLifecycle() {
    lifecycleLock.lock()
    lifecycleGeneration &+= 1
    isRecycled = true
    lifecycleLock.unlock()
  }

  private func validateActiveLifecycle(
    matching lifecycle: (generation: UInt64, isRecycled: Bool)? = nil
  ) throws {
    lifecycleLock.lock()
    let currentGeneration = lifecycleGeneration
    let currentlyRecycled = isRecycled
    lifecycleLock.unlock()

    if currentlyRecycled {
      throw Self.mapViewNotMountedError()
    }

    if let lifecycle,
       lifecycle.isRecycled || lifecycle.generation != currentGeneration {
      throw Self.mapViewNotMountedError()
    }
  }

  private static func mapViewNotMountedError() -> Error {
    RuntimeError.error(withMessage: "MapView is not mounted")
  }

  private func installAdapter(for provider: MapProvider) {
    precondition(Thread.isMainThread)

    adapter?.prepareForRecycle()
    adapter?.contentView.removeFromSuperview()

    let nextAdapter = makeAdapter(for: provider)
    adapter = nextAdapter
    attach(contentView: nextAdapter.contentView)
    syncState(to: nextAdapter)
  }

  private func makeAdapter(for provider: MapProvider) -> MapProviderAdapter {
    switch provider {
    case .apple:
      return AppleMapProviderAdapter()
    case .google:
#if canImport(GoogleMaps)
      do {
        return try GoogleMapProviderAdapter(googleMapId: _googleMapId)
      } catch {
        return UnavailableMapProviderAdapter(error: error)
      }
#else
      return UnavailableMapProviderAdapter(
        error: MapProviderConfigurationError.unsupportedIOSProvider(provider)
      )
#endif
    case .openstreetmap, .mapbox:
      return UnavailableMapProviderAdapter(
        error: MapProviderConfigurationError.unsupportedIOSProvider(provider)
      )
    }
  }

  private func attach(contentView: UIView) {
    contentView.translatesAutoresizingMaskIntoConstraints = false
    containerView.addSubview(contentView)
    NSLayoutConstraint.activate([
      contentView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
      contentView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
      contentView.topAnchor.constraint(equalTo: containerView.topAnchor),
      contentView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),
    ])
  }

  private func syncState(to adapter: MapProviderAdapter) {
    adapter.mapType = _mapType
    adapter.region = _region
    adapter.camera = _camera
    adapter.scrollEnabled = _scrollEnabled
    adapter.zoomEnabled = _zoomEnabled
    adapter.rotateEnabled = _rotateEnabled
    adapter.pitchEnabled = _pitchEnabled
    adapter.showsUserLocation = _showsUserLocation
    adapter.followsUserLocation = _followsUserLocation
    adapter.showsCompass = _showsCompass
    adapter.showsScale = _showsScale
    adapter.customMapStyle = _customMapStyle
    adapter.googleMapId = _googleMapId
    adapter.clusteringEnabled = _clusteringEnabled
    adapter.mapPadding = _mapPadding
    adapter.markerEnteringAnimation = _markerEnteringAnimation
    adapter.clusterEnteringAnimation = _clusterEnteringAnimation
    adapter.onRegionChange = _onRegionChange
    adapter.onRegionChangeComplete = _onRegionChangeComplete
    adapter.onMapReady = _onMapReady
    adapter.onPress = _onPress
    adapter.onPoiPress = _onPoiPress
    adapter.onLongPress = _onLongPress
    adapter.markers = _markers
    adapter.polylines = _polylines
    adapter.polygons = _polygons
    adapter.circles = _circles
    adapter.onMarkerPress = _onMarkerPress
    adapter.onMarkerDragEnd = _onMarkerDragEnd
    adapter.onPolylinePress = _onPolylinePress
    adapter.onPolygonPress = _onPolygonPress
    adapter.onCirclePress = _onCirclePress
    adapter.onClusterPress = _onClusterPress
  }

  private func onMain<T>(_ work: () throws -> T) rethrows -> T {
    if Thread.isMainThread {
      return try work()
    }

    return try DispatchQueue.main.sync(execute: work)
  }

  private func promiseOnMain<T>(
    _ work: @escaping (MapProviderAdapter) throws -> Promise<T>
  ) -> Promise<T> {
    let promise = Promise<T>()
    let lifecycle = currentLifecycleSnapshot()
    let run = { [weak self] in
      guard let self else {
        promise.reject(
          withError: Self.mapViewNotMountedError()
        )
        return
      }

      do {
        let adapter = try self.currentAdapter(matching: lifecycle)
        try work(adapter)
          .then { promise.resolve(withResult: $0) }
          .catch { promise.reject(withError: $0) }
      } catch {
        promise.reject(withError: error)
      }
    }

    if Thread.isMainThread {
      run()
    } else {
      DispatchQueue.main.async(execute: run)
    }

    return promise
  }
}

extension HybridMapView: RecyclableView {}

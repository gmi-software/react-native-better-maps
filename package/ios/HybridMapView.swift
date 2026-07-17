import NitroModules
import UIKit

final class HybridMapView: HybridMapViewSpec {
  private let containerView = UIView()
  private let lifecycleLock = NSLock()
  private let stateLock = NSLock()
  private var adapter: MapProviderAdapter?
  private var lifecycleGeneration: UInt64 = 0
  private var isRecycled = false
  private var _state = MapViewState()

  lazy var view: UIView = {
    containerView
  }()

  var provider: MapProvider? {
    get { getBacked(\.provider) }
    set {
      let nextProvider = newValue ?? .apple
      runOnMain { [weak self] in
        guard let self else {
          return
        }

        let shouldInstall = withStateLock { () -> Bool in
          guard nextProvider != self._state.provider || self.adapter == nil else {
            return false
          }

          self._state.provider = nextProvider
          return true
        }

        guard shouldInstall else {
          return
        }

        installAdapter(for: nextProvider)
      }
    }
  }

  var mapType: MapType {
    get { getBacked(\.mapType) }
    set { setBackedOnMain(newValue, store: \.mapType) { $0.mapType = $1 } }
  }

  var region: Region? {
    get { getBacked(\.region) }
    set { setBackedOnMain(newValue, store: \.region) { $0.region = $1 } }
  }

  var camera: Camera? {
    get { getBacked(\.camera) }
    set { setBackedOnMain(newValue, store: \.camera) { $0.camera = $1 } }
  }

  var scrollEnabled: Bool? {
    get { getBacked(\.scrollEnabled) }
    set { setBackedOnMain(newValue, store: \.scrollEnabled) { $0.scrollEnabled = $1 } }
  }

  var zoomEnabled: Bool? {
    get { getBacked(\.zoomEnabled) }
    set { setBackedOnMain(newValue, store: \.zoomEnabled) { $0.zoomEnabled = $1 } }
  }

  var rotateEnabled: Bool? {
    get { getBacked(\.rotateEnabled) }
    set { setBackedOnMain(newValue, store: \.rotateEnabled) { $0.rotateEnabled = $1 } }
  }

  var pitchEnabled: Bool? {
    get { getBacked(\.pitchEnabled) }
    set { setBackedOnMain(newValue, store: \.pitchEnabled) { $0.pitchEnabled = $1 } }
  }

  var showsUserLocation: Bool? {
    get { getBacked(\.showsUserLocation) }
    set {
      setBackedOnMain(newValue, store: \.showsUserLocation) { $0.showsUserLocation = $1 }
    }
  }

  var followsUserLocation: Bool? {
    get { getBacked(\.followsUserLocation) }
    set {
      setBackedOnMain(newValue, store: \.followsUserLocation) { $0.followsUserLocation = $1 }
    }
  }

  var showsCompass: Bool? {
    get { getBacked(\.showsCompass) }
    set { setBackedOnMain(newValue, store: \.showsCompass) { $0.showsCompass = $1 } }
  }

  var showsScale: Bool? {
    get { getBacked(\.showsScale) }
    set { setBackedOnMain(newValue, store: \.showsScale) { $0.showsScale = $1 } }
  }

  var customMapStyle: String? {
    get { getBacked(\.customMapStyle) }
    set { setBackedOnMain(newValue, store: \.customMapStyle) { $0.customMapStyle = $1 } }
  }

  var googleMapId: String? {
    get { getBacked(\.googleMapId) }
    set {
      let nextGoogleMapId = newValue
      runOnMain { [weak self] in
        guard let self else {
          return
        }

        let shouldReinstall = withStateLock { () -> Bool in
          guard self._state.googleMapId != nextGoogleMapId else {
            return false
          }

          self._state.googleMapId = nextGoogleMapId
          return self._state.provider == .google && self.adapter != nil
        }

        guard shouldReinstall else {
          return
        }

        installAdapter(for: withStateLock { self._state.provider })
      }
    }
  }

  var clusteringEnabled: Bool? {
    get { getBacked(\.clusteringEnabled) }
    set {
      setBackedOnMain(newValue, store: \.clusteringEnabled) { $0.clusteringEnabled = $1 }
    }
  }

  var mapPadding: EdgePadding? {
    get { getBacked(\.mapPadding) }
    set { setBackedOnMain(newValue, store: \.mapPadding) { $0.mapPadding = $1 } }
  }

  var markerEnteringAnimation: OverlayEnteringAnimationDescriptor? {
    get { getBacked(\.markerEnteringAnimation) }
    set {
      setBackedOnMain(newValue, store: \.markerEnteringAnimation) {
        $0.markerEnteringAnimation = $1
      }
    }
  }

  var clusterEnteringAnimation: OverlayEnteringAnimationDescriptor? {
    get { getBacked(\.clusterEnteringAnimation) }
    set {
      setBackedOnMain(newValue, store: \.clusterEnteringAnimation) {
        $0.clusterEnteringAnimation = $1
      }
    }
  }

  var onRegionChange: ((Region) -> Void)? {
    get { getBacked(\.onRegionChange) }
    set { setBackedOnMain(newValue, store: \.onRegionChange) { $0.onRegionChange = $1 } }
  }

  var onRegionChangeComplete: ((Region) -> Void)? {
    get { getBacked(\.onRegionChangeComplete) }
    set {
      setBackedOnMain(newValue, store: \.onRegionChangeComplete) {
        $0.onRegionChangeComplete = $1
      }
    }
  }

  var onMapReady: (() -> Void)? {
    get { getBacked(\.onMapReady) }
    set { setBackedOnMain(newValue, store: \.onMapReady) { $0.onMapReady = $1 } }
  }

  var onPress: ((Coordinate) -> Void)? {
    get { getBacked(\.onPress) }
    set { setBackedOnMain(newValue, store: \.onPress) { $0.onPress = $1 } }
  }

  var onPoiPress: ((NativePoiPressEvent) -> Void)? {
    get { getBacked(\.onPoiPress) }
    set { setBackedOnMain(newValue, store: \.onPoiPress) { $0.onPoiPress = $1 } }
  }

  var onLongPress: ((Coordinate) -> Void)? {
    get { getBacked(\.onLongPress) }
    set { setBackedOnMain(newValue, store: \.onLongPress) { $0.onLongPress = $1 } }
  }

  var markers: [MarkerDescriptor]? {
    get { getBacked(\.markers) }
    set { setBackedOnMain(newValue, store: \.markers) { $0.markers = $1 } }
  }

  var polylines: [PolylineDescriptor]? {
    get { getBacked(\.polylines) }
    set { setBackedOnMain(newValue, store: \.polylines) { $0.polylines = $1 } }
  }

  var polygons: [PolygonDescriptor]? {
    get { getBacked(\.polygons) }
    set { setBackedOnMain(newValue, store: \.polygons) { $0.polygons = $1 } }
  }

  var circles: [CircleDescriptor]? {
    get { getBacked(\.circles) }
    set { setBackedOnMain(newValue, store: \.circles) { $0.circles = $1 } }
  }

  var onMarkerPress: ((String) -> Void)? {
    get { getBacked(\.onMarkerPress) }
    set { setBackedOnMain(newValue, store: \.onMarkerPress) { $0.onMarkerPress = $1 } }
  }

  var onMarkerDragEnd: ((String, Coordinate) -> Void)? {
    get { getBacked(\.onMarkerDragEnd) }
    set {
      setBackedOnMain(newValue, store: \.onMarkerDragEnd) { $0.onMarkerDragEnd = $1 }
    }
  }

  var onPolylinePress: ((String) -> Void)? {
    get { getBacked(\.onPolylinePress) }
    set { setBackedOnMain(newValue, store: \.onPolylinePress) { $0.onPolylinePress = $1 } }
  }

  var onPolygonPress: ((String) -> Void)? {
    get { getBacked(\.onPolygonPress) }
    set { setBackedOnMain(newValue, store: \.onPolygonPress) { $0.onPolygonPress = $1 } }
  }

  var onCirclePress: ((String) -> Void)? {
    get { getBacked(\.onCirclePress) }
    set { setBackedOnMain(newValue, store: \.onCirclePress) { $0.onCirclePress = $1 } }
  }

  var onClusterPress: (([String], Coordinate) -> Void)? {
    get { getBacked(\.onClusterPress) }
    set { setBackedOnMain(newValue, store: \.onClusterPress) { $0.onClusterPress = $1 } }
  }

  func fetchCamera() throws -> Promise<Camera> {
    promiseOnMain { try $0.fetchCamera() }
  }

  func applyCamera(camera: Camera) throws -> Promise<Void> {
    promiseOnMainVoid { try $0.applyCamera(camera: camera) }
  }

  func animateCamera(camera: Camera, duration: Double?) throws -> Promise<Void> {
    promiseOnMainVoid {
      try $0.animateCamera(camera: camera, duration: duration)
    }
  }

  func getVisibleRegion() throws -> Promise<VisibleRegion> {
    promiseOnMain { try $0.getVisibleRegion() }
  }

  func fitToCoordinates(
    coordinates: [Coordinate],
    padding: EdgePadding?,
    animated: Bool?
  ) throws -> Promise<Void> {
    promiseOnMainVoid {
      try $0.fitToCoordinates(
        coordinates: coordinates,
        padding: padding,
        animated: animated
      )
    }
  }

  func afterUpdate() {
    runOnMain { [weak self] in
      self?.activateLifecycle()
    }
  }

  func prepareForRecycle() {
    runOnMain { [weak self] in
      guard let self else {
        return
      }

      recycleLifecycle()
      adapter?.prepareForRecycle()
      adapter?.contentView.removeFromSuperview()
      adapter = nil
      withStateLock {
        self._state = MapViewState()
      }
    }
  }

  private func currentAdapter(
    matching lifecycle: (generation: UInt64, isRecycled: Bool)? = nil
  ) throws -> MapProviderAdapter {
    try validateActiveLifecycle(matching: lifecycle)

    if let adapter {
      return adapter
    }

    installAdapter(for: withStateLock { self._state.provider })
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
        return try GoogleMapProviderAdapter(googleMapId: withStateLock { self._state.googleMapId })
      } catch {
        return UnavailableMapProviderAdapter(error: error)
      }
#else
      return UnavailableMapProviderAdapter(
        error: MapProviderConfigurationError.googleMapsSdkNotLinked
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
    let snapshot = withStateLock { self._state }
    snapshot.apply(to: adapter)
  }

  private func withStateLock<T>(_ body: () -> T) -> T {
    stateLock.lock()
    defer { stateLock.unlock() }
    return body()
  }

  private func getBacked<T>(_ keyPath: KeyPath<MapViewState, T>) -> T {
    withStateLock { self._state[keyPath: keyPath] }
  }

  private func setBackedOnMain<T>(
    _ value: T,
    store: WritableKeyPath<MapViewState, T>,
    sync: @escaping (MapProviderAdapter, T) -> Void
  ) {
    withStateLock { self._state[keyPath: store] = value }
    runOnMain { [weak self] in
      guard let self, let adapter = self.adapter else {
        return
      }

      sync(adapter, value)
    }
  }

  private func runOnMain(_ work: @escaping () -> Void) {
    if Thread.isMainThread {
      work()
    } else {
      DispatchQueue.main.async(execute: work)
    }
  }

  private func promiseOnMainVoid(
    _ work: @escaping (MapProviderAdapter) throws -> Void
  ) -> Promise<Void> {
    let promise = Promise<Void>()
    let lifecycle = currentLifecycleSnapshot()
    let run = { [weak self] in
      guard let self else {
        promise.reject(withError: Self.mapViewNotMountedError())
        return
      }

      do {
        let adapter = try self.currentAdapter(matching: lifecycle)
        try work(adapter)
        promise.resolve(withResult: ())
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

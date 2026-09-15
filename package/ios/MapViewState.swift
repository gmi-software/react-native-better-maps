import NitroModules

struct MapViewState {
  var provider: MapProvider = .apple
  var mapType: MapType = .standard
  var region: Region?
  var camera: Camera?
  var scrollEnabled: Bool?
  var zoomEnabled: Bool?
  var rotateEnabled: Bool?
  var pitchEnabled: Bool?
  var showsUserLocation: Bool?
  var followsUserLocation: Bool?
  var showsCompass: Bool?
  var showsScale: Bool?
  var customMapStyle: String?
  var googleMapId: String?
  var clusteringEnabled: Bool?
  var mapPadding: EdgePadding?
  var markerEnteringAnimation: OverlayEnteringAnimationDescriptor?
  var clusterEnteringAnimation: OverlayEnteringAnimationDescriptor?
  var pinStyle: MarkerPinStyle?
  var onRegionChange: ((Region) -> Void)?
  var onRegionChangeComplete: ((Region) -> Void)?
  var onCameraMove: ((Camera) -> Void)?
  var cameraMoveThrottleMs: Double?
  var onMapReady: (() -> Void)?
  var onPress: ((Coordinate) -> Void)?
  var onPoiPress: ((NativePoiPressEvent) -> Void)?
  var onLongPress: ((Coordinate) -> Void)?
  var markerCollection: (any HybridMarkerCollectionSpec)?
  var polylines: [PolylineDescriptor]?
  var polygons: [PolygonDescriptor]?
  var circles: [CircleDescriptor]?
  var onMarkerPress: ((String) -> Void)?
  var onMarkerDragEnd: ((String, Coordinate) -> Void)?
  var onPolylinePress: ((String) -> Void)?
  var onPolygonPress: ((String) -> Void)?
  var onCirclePress: ((String) -> Void)?
  var onClusterPress: ((NativeClusterPressEvent) -> Void)?

  func apply(to adapter: MapProviderAdapter) {
    adapter.mapType = mapType
    adapter.region = region
    adapter.camera = camera
    adapter.scrollEnabled = scrollEnabled
    adapter.zoomEnabled = zoomEnabled
    adapter.rotateEnabled = rotateEnabled
    adapter.pitchEnabled = pitchEnabled
    adapter.showsUserLocation = showsUserLocation
    adapter.followsUserLocation = followsUserLocation
    adapter.showsCompass = showsCompass
    adapter.showsScale = showsScale
    adapter.customMapStyle = customMapStyle
    adapter.googleMapId = googleMapId
    adapter.clusteringEnabled = clusteringEnabled
    adapter.mapPadding = mapPadding
    adapter.markerEnteringAnimation = markerEnteringAnimation
    adapter.clusterEnteringAnimation = clusterEnteringAnimation
    adapter.pinStyle = pinStyle
    adapter.onRegionChange = onRegionChange
    adapter.onRegionChangeComplete = onRegionChangeComplete
    adapter.cameraMoveThrottleMs = cameraMoveThrottleMs
    adapter.onCameraMove = onCameraMove
    adapter.onMapReady = onMapReady
    adapter.onPress = onPress
    adapter.onPoiPress = onPoiPress
    adapter.onLongPress = onLongPress
    adapter.markerCollection = markerCollection as? HybridMarkerCollection
    adapter.polylines = polylines
    adapter.polygons = polygons
    adapter.circles = circles
    adapter.onMarkerPress = onMarkerPress
    adapter.onMarkerDragEnd = onMarkerDragEnd
    adapter.onPolylinePress = onPolylinePress
    adapter.onPolygonPress = onPolygonPress
    adapter.onCirclePress = onCirclePress
    adapter.onClusterPress = onClusterPress
  }
}

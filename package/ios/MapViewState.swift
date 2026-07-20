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
  var onRegionChange: ((Region) -> Void)?
  var onRegionChangeComplete: ((Region) -> Void)?
  var onMapReady: (() -> Void)?
  var onPress: ((Coordinate) -> Void)?
  var onPoiPress: ((NativePoiPressEvent) -> Void)?
  var onLongPress: ((Coordinate) -> Void)?
  var markers: [MarkerDescriptor]?
  var polylines: [PolylineDescriptor]?
  var polygons: [PolygonDescriptor]?
  var circles: [CircleDescriptor]?
  var onMarkerPress: ((String) -> Void)?
  var onMarkerDragEnd: ((String, Coordinate) -> Void)?
  var onPolylinePress: ((String) -> Void)?
  var onPolygonPress: ((String) -> Void)?
  var onCirclePress: ((String) -> Void)?
  var onClusterPress: (([String], Coordinate) -> Void)?

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
    adapter.onRegionChange = onRegionChange
    adapter.onRegionChangeComplete = onRegionChangeComplete
    adapter.onMapReady = onMapReady
    adapter.onPress = onPress
    adapter.onPoiPress = onPoiPress
    adapter.onLongPress = onLongPress
    adapter.markers = markers
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

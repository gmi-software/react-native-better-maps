package com.margelo.nitro.nitromaps

import android.view.View
import android.widget.FrameLayout
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.core.Promise
import com.margelo.nitro.views.RecyclableView

@Keep
@DoNotStrip
class HybridMapView(private val context: ThemedReactContext) :
  HybridMapViewSpec(),
  RecyclableView {

  private var adapter: MapProviderAdapter? = null

  private var _provider = MapProvider.GOOGLE
  private var _mapType = MapType.STANDARD
  private var _region: Region? = null
  private var _camera: Camera? = null
  private var _scrollEnabled: Boolean? = true
  private var _zoomEnabled: Boolean? = true
  private var _rotateEnabled: Boolean? = true
  private var _pitchEnabled: Boolean? = true
  private var _showsUserLocation: Boolean? = null
  private var _followsUserLocation: Boolean? = null
  private var _showsCompass: Boolean? = null
  private var _showsScale: Boolean? = null
  private var _customMapStyle: String? = null
  private var _googleMapId: String? = null
  private var _clusteringEnabled: Boolean? = null
  private var _mapPadding: EdgePadding? = null
  private var _markerEnteringAnimation: OverlayEnteringAnimationDescriptor? = null
  private var _clusterEnteringAnimation: OverlayEnteringAnimationDescriptor? = null

  override val view: FrameLayout = FrameLayout(context)

  override var provider: MapProvider?
    get() = _provider
    set(value) {
      val nextProvider = value ?: MapProvider.GOOGLE
      if (nextProvider == _provider && adapter != null) {
        return
      }

      installAdapter(nextProvider)
      _provider = nextProvider
    }

  override var mapType: MapType
    get() = _mapType
    set(value) {
      _mapType = value
      adapter?.mapType = value
    }

  override var region: Region?
    get() = _region
    set(value) {
      _region = value
      adapter?.region = value
    }

  override var camera: Camera?
    get() = _camera
    set(value) {
      _camera = value
      adapter?.camera = value
    }

  override var scrollEnabled: Boolean?
    get() = _scrollEnabled
    set(value) {
      _scrollEnabled = value
      adapter?.scrollEnabled = value
    }

  override var zoomEnabled: Boolean?
    get() = _zoomEnabled
    set(value) {
      _zoomEnabled = value
      adapter?.zoomEnabled = value
    }

  override var rotateEnabled: Boolean?
    get() = _rotateEnabled
    set(value) {
      _rotateEnabled = value
      adapter?.rotateEnabled = value
    }

  override var pitchEnabled: Boolean?
    get() = _pitchEnabled
    set(value) {
      _pitchEnabled = value
      adapter?.pitchEnabled = value
    }

  override var showsUserLocation: Boolean?
    get() = _showsUserLocation
    set(value) {
      _showsUserLocation = value
      adapter?.showsUserLocation = value
    }

  override var followsUserLocation: Boolean?
    get() = _followsUserLocation
    set(value) {
      _followsUserLocation = value
      adapter?.followsUserLocation = value
    }

  override var showsCompass: Boolean?
    get() = _showsCompass
    set(value) {
      _showsCompass = value
      adapter?.showsCompass = value
    }

  override var showsScale: Boolean?
    get() = _showsScale
    set(value) {
      _showsScale = value
      adapter?.showsScale = value
    }

  override var customMapStyle: String?
    get() = _customMapStyle
    set(value) {
      _customMapStyle = value
      adapter?.customMapStyle = value
    }

  override var googleMapId: String?
    get() = _googleMapId
    set(value) {
      if (_googleMapId == value) {
        return
      }
      _googleMapId = value
      if (_provider == MapProvider.GOOGLE && adapter != null) {
        installAdapter(_provider)
      }
    }

  override var clusteringEnabled: Boolean?
    get() = _clusteringEnabled
    set(value) {
      _clusteringEnabled = value
      adapter?.clusteringEnabled = value
    }

  override var mapPadding: EdgePadding?
    get() = _mapPadding
    set(value) {
      _mapPadding = value
      adapter?.mapPadding = value
    }

  override var markerEnteringAnimation: OverlayEnteringAnimationDescriptor?
    get() = _markerEnteringAnimation
    set(value) {
      _markerEnteringAnimation = value
      adapter?.markerEnteringAnimation = value
    }

  override var clusterEnteringAnimation: OverlayEnteringAnimationDescriptor?
    get() = _clusterEnteringAnimation
    set(value) {
      _clusterEnteringAnimation = value
      adapter?.clusterEnteringAnimation = value
    }

  override var onRegionChange: ((region: Region) -> Unit)? = null
    set(value) {
      field = value
      adapter?.onRegionChange = value
    }

  override var onRegionChangeComplete: ((region: Region) -> Unit)? = null
    set(value) {
      field = value
      adapter?.onRegionChangeComplete = value
    }

  override var onMapReady: (() -> Unit)? = null
    set(value) {
      field = value
      adapter?.onMapReady = value
    }

  override var onPress: ((coordinate: Coordinate) -> Unit)? = null
    set(value) {
      field = value
      adapter?.onPress = value
    }

  override var onPoiPress: ((event: NativePoiPressEvent) -> Unit)? = null
    set(value) {
      field = value
      adapter?.onPoiPress = value
    }

  override var onLongPress: ((coordinate: Coordinate) -> Unit)? = null
    set(value) {
      field = value
      adapter?.onLongPress = value
    }

  override var markers: Array<MarkerDescriptor>? = null
    set(value) {
      field = value
      adapter?.markers = value
    }

  override var polylines: Array<PolylineDescriptor>? = null
    set(value) {
      field = value
      adapter?.polylines = value
    }

  override var polygons: Array<PolygonDescriptor>? = null
    set(value) {
      field = value
      adapter?.polygons = value
    }

  override var circles: Array<CircleDescriptor>? = null
    set(value) {
      field = value
      adapter?.circles = value
    }

  override var onMarkerPress: ((id: String) -> Unit)? = null
    set(value) {
      field = value
      adapter?.onMarkerPress = value
    }

  override var onMarkerDragEnd: ((id: String, coordinate: Coordinate) -> Unit)? = null
    set(value) {
      field = value
      adapter?.onMarkerDragEnd = value
    }

  override var onPolylinePress: ((id: String) -> Unit)? = null
    set(value) {
      field = value
      adapter?.onPolylinePress = value
    }

  override var onPolygonPress: ((id: String) -> Unit)? = null
    set(value) {
      field = value
      adapter?.onPolygonPress = value
    }

  override var onCirclePress: ((id: String) -> Unit)? = null
    set(value) {
      field = value
      adapter?.onCirclePress = value
    }

  override var onClusterPress: ((markerIds: Array<String>, coordinate: Coordinate) -> Unit)? = null
    set(value) {
      field = value
      adapter?.onClusterPress = value
    }

  override fun fetchCamera(): Promise<Camera> = currentAdapter().fetchCamera()

  override fun applyCamera(camera: Camera): Promise<Unit> {
    currentAdapter().applyCamera(camera)
    return Promise.resolved(Unit)
  }

  override fun animateCamera(camera: Camera, duration: Double?): Promise<Unit> {
    currentAdapter().animateCamera(camera, duration)
    return Promise.resolved(Unit)
  }

  override fun getVisibleRegion(): Promise<VisibleRegion> = currentAdapter().getVisibleRegion()

  override fun fitToCoordinates(
    coordinates: Array<Coordinate>,
    padding: EdgePadding?,
    animated: Boolean?,
  ): Promise<Unit> {
    currentAdapter().fitToCoordinates(coordinates, padding, animated)
    return Promise.resolved(Unit)
  }

  override fun prepareForRecycle() {
    adapter?.prepareForRecycle()
    adapter?.view?.let(view::removeView)
    adapter = null
    _provider = MapProvider.GOOGLE
    _mapType = MapType.STANDARD
    _region = null
    _camera = null
    _scrollEnabled = true
    _zoomEnabled = true
    _rotateEnabled = true
    _pitchEnabled = true
    _showsUserLocation = null
    _followsUserLocation = null
    _showsCompass = null
    _showsScale = null
    _customMapStyle = null
    _googleMapId = null
    _clusteringEnabled = null
    _mapPadding = null
    _markerEnteringAnimation = null
    _clusterEnteringAnimation = null
    onRegionChange = null
    onRegionChangeComplete = null
    onMapReady = null
    onPress = null
    onPoiPress = null
    onLongPress = null
    markers = null
    polylines = null
    polygons = null
    circles = null
    onMarkerPress = null
    onMarkerDragEnd = null
    onPolylinePress = null
    onPolygonPress = null
    onCirclePress = null
    onClusterPress = null
  }

  private fun currentAdapter(): MapProviderAdapter {
    adapter?.let { return it }
    installAdapter(_provider)
    return requireNotNull(adapter)
  }

  private fun installAdapter(provider: MapProvider) {
    val nextAdapter = makeAdapter(provider)
    val previousAdapter = adapter

    previousAdapter?.prepareForRecycle()
    previousAdapter?.view?.let(view::removeView)
    adapter = nextAdapter
    attach(nextAdapter.view)
    syncState(nextAdapter)
  }

  private fun makeAdapter(provider: MapProvider): MapProviderAdapter {
    return when (provider) {
      MapProvider.GOOGLE -> GoogleMapProviderAdapter(context, _googleMapId)
      MapProvider.APPLE,
      MapProvider.OPENSTREETMAP,
      MapProvider.MAPBOX,
      -> error("Map provider \"$provider\" is not supported on Android.")
    }
  }

  private fun attach(contentView: View) {
    view.addView(
      contentView,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT,
      ),
    )
  }

  private fun syncState(adapter: MapProviderAdapter) {
    adapter.mapType = _mapType
    adapter.mapPadding = _mapPadding
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
    adapter.markerEnteringAnimation = _markerEnteringAnimation
    adapter.clusterEnteringAnimation = _clusterEnteringAnimation
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

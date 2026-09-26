package com.margelo.nitro.nitromaps

import android.view.View
import android.widget.FrameLayout
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.core.Promise
import com.margelo.nitro.views.RecyclableView

private const val MAP_VIEW_NOT_MOUNTED_MESSAGE = "MapView is not mounted"

/** What a provider adapter is built from; the SDK takes both only when it creates its map. */
private data class AdapterConfiguration(
  val provider: MapProvider,
  val googleMapId: String?,
)

@Keep
@DoNotStrip
class HybridMapView(
  private val context: ThemedReactContext,
) : HybridMapViewSpec(),
  RecyclableView {
  private val adapterSlot =
    ProviderAdapterSlot<AdapterConfiguration, MapProviderAdapter>(
      build = ::makeAdapter,
      destroy = ::destroyAdapter,
    )

  private val adapter: MapProviderAdapter?
    get() = adapterSlot.adapter

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
  private var _applePoiDetailPresentation: ApplePoiDetailPresentation? = null
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
      // Rejected before it is recorded, so the map on screen stays as it is.
      check(nextProvider == MapProvider.GOOGLE) {
        "Map provider \"$nextProvider\" is not supported on Android."
      }
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

  /** Apple MapKit only; the Google Maps SDK has no native POI detail surface. */
  override var applePoiDetailPresentation: ApplePoiDetailPresentation?
    get() = _applePoiDetailPresentation
    set(value) {
      _applePoiDetailPresentation = value
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
      _googleMapId = value
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

  override fun fetchCamera(): Promise<Camera> = withAdapter { it.fetchCamera() }

  override fun applyCamera(camera: Camera): Promise<Unit> = withAdapter { it.applyCamera(camera) }

  override fun animateCamera(
    camera: Camera,
    duration: Double?,
  ): Promise<Unit> = withAdapter { it.animateCamera(camera, duration) }

  override fun animateToRegion(
    region: Region,
    duration: Double?,
  ): Promise<Unit> = withAdapter { it.animateToRegion(region, duration) }

  override fun getVisibleRegion(): Promise<VisibleRegion> = withAdapter { it.getVisibleRegion() }

  override fun fitToCoordinates(
    coordinates: Array<Coordinate>,
    padding: EdgePadding?,
    animated: Boolean?,
  ): Promise<Unit> = withAdapter { it.fitToCoordinates(coordinates, padding, animated) }

  override fun pointForCoordinate(coordinate: Coordinate): Promise<Point> = withAdapter { it.pointForCoordinate(coordinate) }

  override fun coordinateForPoint(point: Point): Promise<Coordinate> = withAdapter { it.coordinateForPoint(point) }

  /**
   * Builds the adapter once per prop transaction. The generated updater sets [provider] before
   * [googleMapId], and Google takes a map ID only when it creates its map, so a setter that
   * built it would build it without one.
   */
  override fun afterUpdate() {
    val nextAdapter = adapterSlot.commit(AdapterConfiguration(_provider, _googleMapId)) ?: return
    attach(nextAdapter.view)
    syncState(nextAdapter)
  }

  override fun onDropView() {
    adapterSlot.release()
  }

  override fun prepareForRecycle() {
    adapterSlot.release()
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
    _applePoiDetailPresentation = null
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

  /**
   * Runs [command] against the adapter. A view that is still mounting has none yet: the
   * generated updater hands JS the `hybridRef` before [afterUpdate] builds the first adapter, so
   * such a call waits for that build on the main thread and is rejected only if it left none.
   */
  private fun <T> withAdapter(command: (MapProviderAdapter) -> Promise<T>): Promise<T> {
    adapter?.let { return command(it) }

    val promise = Promise<T>()
    // Posted even from the main thread: inline, a call made there mid-transaction would find
    // no adapter before `afterUpdate()` has built it.
    postOnMain {
      val mounted = adapter
      if (mounted == null) {
        promise.reject(IllegalStateException(MAP_VIEW_NOT_MOUNTED_MESSAGE))
        return@postOnMain
      }

      // Caught: on the main thread a throw would take the app down instead of rejecting.
      runCatching { command(mounted) }
        .onSuccess { result ->
          result
            .then { value -> promise.resolve(value) }
            .catch { error -> promise.reject(error) }
        }.onFailure { error -> promise.reject(error) }
    }
    return promise
  }

  /**
   * Detaches and destroys [outgoing]. Every teardown lands here: a rebuild in [afterUpdate],
   * [onDropView] on every unmount, and [prepareForRecycle], which only fires when React
   * Native has view recycling enabled.
   */
  private fun destroyAdapter(outgoing: MapProviderAdapter) {
    outgoing.release()
    view.removeView(outgoing.view)
  }

  /** Only ever sees [MapProvider.GOOGLE]: the [provider] setter rejects every other one. */
  private fun makeAdapter(configuration: AdapterConfiguration): MapProviderAdapter =
    GoogleMapProviderAdapter(context, configuration.googleMapId)

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

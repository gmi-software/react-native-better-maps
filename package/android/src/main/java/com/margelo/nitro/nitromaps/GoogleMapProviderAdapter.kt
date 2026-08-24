package com.margelo.nitro.nitromaps

import android.Manifest
import android.content.ComponentCallbacks
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewTreeObserver
import androidx.annotation.Keep
import androidx.core.content.ContextCompat
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.uimanager.ThemedReactContext
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.GoogleMapOptions
import com.google.android.gms.maps.MapView
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import com.google.android.gms.maps.model.MapStyleOptions
import com.margelo.nitro.core.Promise

@Keep
@DoNotStrip
class GoogleMapProviderAdapter(
  private val context: ThemedReactContext,
  initialGoogleMapId: String?,
) :
  MapProviderAdapter,
  LifecycleEventListener {

  private var googleMap: GoogleMap? = null
  private var isUserGesture = false
  private var hasFiredMapReady = false
  private val overlayController = MapOverlayController(null, context)
  private var pendingMarkers: Array<MarkerDescriptor>? = null
  private var pendingPolylines: Array<PolylineDescriptor>? = null
  private var pendingPolygons: Array<PolygonDescriptor>? = null
  private var pendingCircles: Array<CircleDescriptor>? = null
  private val mainHandler = Handler(Looper.getMainLooper())

  private val googleMapIdAtCreation: String? = normalizeGoogleMapId(initialGoogleMapId)

  override val view: MapView = MapView(
    context,
    GoogleMapOptions().apply {
      googleMapIdAtCreation?.let { mapId ->
        mapId(mapId)
      }
    },
  )

  private val lifecycle = MapViewLifecycleOwner(view)

  private var isAttachedToWindow = false

  /** React only mounts views while the host runs; [onHostPause] corrects this. */
  private var isHostResumed = true

  private val attachStateListener = object : View.OnAttachStateChangeListener {
    override fun onViewAttachedToWindow(v: View) {
      isAttachedToWindow = true
      syncLifecycleState()
    }

    override fun onViewDetachedFromWindow(v: View) {
      isAttachedToWindow = false
      syncLifecycleState()
    }
  }

  private val memoryCallbacks = object : ComponentCallbacks {
    override fun onConfigurationChanged(newConfig: Configuration) = Unit

    override fun onLowMemory() {
      lifecycle.onLowMemory()
    }
  }

  init {
    context.addLifecycleEventListener(this)
    context.registerComponentCallbacks(memoryCallbacks)
    view.addOnAttachStateChangeListener(attachStateListener)

    view.getMapAsync { map ->
      googleMap = map
      configureMap(map)
    }

    installViewportSizeListener(view)
  }

  private var _mapType = MapType.STANDARD
  override var mapType: MapType
    get() = _mapType
    set(value) {
      _mapType = value
      googleMap?.mapType = value.toGoogleMapType()
    }

  private var _region: Region? = null
  override var region: Region?
    get() = _region
    set(value) {
      _region = value
      if (value != null && !isUserGesture && _camera == null) {
        applyRegion(value)
      }
    }

  private var _camera: Camera? = null
  override var camera: Camera?
    get() = _camera
    set(value) {
      _camera = value
      if (value != null && !isUserGesture) {
        updateMapCamera(value, animated = false)
      }
    }

  override var scrollEnabled: Boolean? = true
    set(value) {
      field = value
      applyUiSettings()
    }

  override var zoomEnabled: Boolean? = true
    set(value) {
      field = value
      applyUiSettings()
    }

  override var rotateEnabled: Boolean? = true
    set(value) {
      field = value
      applyUiSettings()
    }

  override var pitchEnabled: Boolean? = true
    set(value) {
      field = value
      applyUiSettings()
    }

  private var _showsUserLocation: Boolean? = null
  override var showsUserLocation: Boolean?
    get() = _showsUserLocation
    set(value) {
      _showsUserLocation = value
      applyUserLocationSettings()
    }

  private var _followsUserLocation: Boolean? = null
  override var followsUserLocation: Boolean?
    get() = _followsUserLocation
    set(value) {
      _followsUserLocation = value
      applyUserLocationSettings()
    }

  private var _showsCompass: Boolean? = null
  override var showsCompass: Boolean?
    get() = _showsCompass
    set(value) {
      _showsCompass = value
      applyUiSettings()
    }

  private var _showsScale: Boolean? = null
  override var showsScale: Boolean?
    get() = _showsScale
    set(value) {
      _showsScale = value
    }

  private var _customMapStyle: String? = null
  override var customMapStyle: String?
    get() = _customMapStyle
    set(value) {
      _customMapStyle = value
      applyCustomMapStyle()
    }

  override var googleMapId: String?
    get() = googleMapIdAtCreation
    set(value) {
      check(normalizeGoogleMapId(value) == googleMapIdAtCreation) {
        "googleMapId is applied when the Google MapView is created. Recreate the adapter to change it."
      }
    }

  private var _clusteringEnabled: Boolean? = null
  override var clusteringEnabled: Boolean?
    get() = _clusteringEnabled
    set(value) {
      _clusteringEnabled = value
      updateOverlayViewportSize()
      overlayController.setClusteringEnabled(value == true)
      googleMap?.let { map ->
        if (value == true) {
          map.setOnMarkerClickListener { marker ->
            overlayController.onMarkerClick(marker)
          }
        } else {
          map.setOnMarkerClickListener { marker ->
            val id = marker.tag as? String
            if (id != null) {
              onMarkerPress?.invoke(id)
            }
            false
          }
        }
      }
      overlayController.setMarkers(_markers)
    }

  private var _mapPadding: EdgePadding? = null
  override var mapPadding: EdgePadding?
    get() = _mapPadding
    set(value) {
      _mapPadding = value
      applyMapPadding()
    }

  private var _markerEnteringAnimation: OverlayEnteringAnimationDescriptor? = null
  override var markerEnteringAnimation: OverlayEnteringAnimationDescriptor?
    get() = _markerEnteringAnimation
    set(value) {
      _markerEnteringAnimation = value
      overlayController.markerEnteringAnimation = value
    }

  private var _clusterEnteringAnimation: OverlayEnteringAnimationDescriptor? = null
  override var clusterEnteringAnimation: OverlayEnteringAnimationDescriptor?
    get() = _clusterEnteringAnimation
    set(value) {
      _clusterEnteringAnimation = value
      overlayController.clusterEnteringAnimation = value
    }

  override var onRegionChange: ((region: Region) -> Unit)? = null
  override var onRegionChangeComplete: ((region: Region) -> Unit)? = null
  override var onMapReady: (() -> Unit)? = null
  override var onPress: ((coordinate: Coordinate) -> Unit)? = null
  override var onPoiPress: ((event: NativePoiPressEvent) -> Unit)? = null
  override var onLongPress: ((coordinate: Coordinate) -> Unit)? = null

  private var _markers: Array<MarkerDescriptor>? = null
  override var markers: Array<MarkerDescriptor>?
    get() = _markers
    set(value) {
      _markers = value
      if (googleMap != null) {
        updateOverlayViewportSize()
        overlayController.setMarkers(value)
      } else {
        pendingMarkers = value
      }
    }

  private var _polylines: Array<PolylineDescriptor>? = null
  override var polylines: Array<PolylineDescriptor>?
    get() = _polylines
    set(value) {
      _polylines = value
      if (googleMap != null) {
        overlayController.updatePolylines(value)
      } else {
        pendingPolylines = value
      }
    }

  private var _polygons: Array<PolygonDescriptor>? = null
  override var polygons: Array<PolygonDescriptor>?
    get() = _polygons
    set(value) {
      _polygons = value
      if (googleMap != null) {
        overlayController.updatePolygons(value)
      } else {
        pendingPolygons = value
      }
    }

  private var _circles: Array<CircleDescriptor>? = null
  override var circles: Array<CircleDescriptor>?
    get() = _circles
    set(value) {
      _circles = value
      if (googleMap != null) {
        overlayController.updateCircles(value)
      } else {
        pendingCircles = value
      }
    }

  override var onMarkerPress: ((id: String) -> Unit)? = null
    set(value) {
      field = value
      syncMarkerPressHandlers()
    }

  override var onMarkerDragEnd: ((id: String, coordinate: Coordinate) -> Unit)? = null
  override var onPolylinePress: ((id: String) -> Unit)? = null
  override var onPolygonPress: ((id: String) -> Unit)? = null
  override var onCirclePress: ((id: String) -> Unit)? = null

  override var onClusterPress: ((markerIds: Array<String>, coordinate: Coordinate) -> Unit)? = null
    set(value) {
      field = value
      syncMarkerPressHandlers()
    }

  override fun fetchCamera(): Promise<Camera> {
    val map = googleMap
    if (map != null) {
      return promiseOnMain { map.cameraPosition.toCamera() }
    }

    return Promise.resolved(
      _camera ?: Camera(
        center = Coordinate(
          latitude = _region?.latitude ?: 0.0,
          longitude = _region?.longitude ?: 0.0,
        ),
        zoom = 10.0,
        heading = null,
        pitch = null,
        altitude = null,
      ),
    )
  }

  override fun applyCamera(camera: Camera) {
    updateMapCamera(camera, animated = false)
  }

  override fun animateCamera(camera: Camera, duration: Double?) {
    val animationDuration = duration ?: 0.25
    updateMapCamera(camera, animated = true, durationMs = (animationDuration * 1000).toInt())
  }

  override fun getVisibleRegion(): Promise<VisibleRegion> {
    val map = googleMap
    if (map != null) {
      return promiseOnMain { map.projection.toNitroVisibleRegion() }
    }

    val zero = Coordinate(latitude = 0.0, longitude = 0.0)
    return Promise.resolved(
      VisibleRegion(
        nearLeft = zero,
        nearRight = zero,
        farLeft = zero,
        farRight = zero,
      ),
    )
  }

  override fun fitToCoordinates(
    coordinates: Array<Coordinate>,
    padding: EdgePadding?,
    animated: Boolean?,
  ) {
    if (coordinates.isEmpty()) {
      return
    }

    runOnMain {
      val map = googleMap ?: return@runOnMain
      val builder = LatLngBounds.Builder()
      for (coordinate in coordinates) {
        builder.include(LatLng(coordinate.latitude, coordinate.longitude))
      }
      val bounds = builder.build()
      val paddingPx = padding.toPaddingPixels()

      val runUpdate = {
        val update = CameraUpdateFactory.newLatLngBounds(bounds, paddingPx)
        if (animated == true) {
          map.animateCamera(update)
        } else {
          map.moveCamera(update)
        }
      }

      runWhenMapViewLaidOut(runUpdate)
    }
  }

  override fun onHostResume() {
    isHostResumed = true
    syncLifecycleState()
  }

  override fun onHostPause() {
    isHostResumed = false
    syncLifecycleState()
  }

  override fun onHostDestroy() {
    destroyMapView()
  }

  /**
   * Brings the map to the state implied by whether it is on screen and whether the
   * host is in the foreground. Leaving the window stops the map, never destroys it.
   */
  private fun syncLifecycleState() {
    val target = when {
      !isAttachedToWindow -> MapViewLifecycleState.CREATED
      isHostResumed -> MapViewLifecycleState.RESUMED
      else -> MapViewLifecycleState.STARTED
    }

    lifecycle.moveTo(target)
  }

  private fun configureMap(map: GoogleMap) {
    map.mapType = _mapType.toGoogleMapType()
    applyUiSettings(map)
    applyUserLocationSettings(map)
    applyMapPadding(map)
    applyCustomMapStyle(map)
    overlayController.setGoogleMap(map)
    updateOverlayViewportSize()
    overlayController.setClusteringEnabled(_clusteringEnabled == true)
    syncMarkerPressHandlers()

    map.setOnCameraMoveStartedListener { reason ->
      handleRegionWillChange(
        userInteracting = reason == GoogleMap.OnCameraMoveStartedListener.REASON_GESTURE,
      )
    }
    map.setOnCameraMoveListener {
      overlayController.onCameraMove()
    }
    map.setOnCameraIdleListener {
      overlayController.onCameraIdle()
      handleRegionDidChange()
    }
    map.setOnMapClickListener { latLng ->
      onPress?.invoke(latLng.toCoordinate())
    }
    map.setOnPoiClickListener { poi ->
      onPoiPress?.invoke(
        NativePoiPressEvent(
          provider = MapProvider.GOOGLE,
          coordinate = poi.latLng.toCoordinate(),
          name = poi.name,
          category = null,
          rawCategory = null,
          placeId = poi.placeId,
        ),
      )
    }
    map.setOnMapLongClickListener { latLng ->
      onLongPress?.invoke(latLng.toCoordinate())
    }
    map.setOnMapLoadedCallback {
      notifyMapReadyIfNeeded()
    }
    if (_clusteringEnabled != true) {
      map.setOnMarkerClickListener { marker ->
        val id = marker.tag as? String
        if (id != null) {
          onMarkerPress?.invoke(id)
        }
        false
      }
    } else {
      map.setOnMarkerClickListener { marker ->
        overlayController.onMarkerClick(marker)
      }
    }
    map.setOnMarkerDragListener(
      object : GoogleMap.OnMarkerDragListener {
        override fun onMarkerDragStart(marker: com.google.android.gms.maps.model.Marker) = Unit

        override fun onMarkerDrag(marker: com.google.android.gms.maps.model.Marker) = Unit

        override fun onMarkerDragEnd(marker: com.google.android.gms.maps.model.Marker) {
          val id = marker.tag as? String ?: return
          onMarkerDragEnd?.invoke(
            id,
            Coordinate(
              latitude = marker.position.latitude,
              longitude = marker.position.longitude,
            ),
          )
        }
      },
    )
    map.setOnPolylineClickListener { polyline ->
      val id = polyline.tag as? String
      if (id != null) {
        onPolylinePress?.invoke(id)
      }
    }
    map.setOnPolygonClickListener { polygon ->
      val id = polygon.tag as? String
      if (id != null) {
        onPolygonPress?.invoke(id)
      }
    }
    map.setOnCircleClickListener { circle ->
      val id = circle.tag as? String
      if (id != null) {
        onCirclePress?.invoke(id)
      }
    }

    overlayController.setMarkers(pendingMarkers ?: _markers)
    overlayController.updatePolylines(pendingPolylines ?: _polylines)
    overlayController.updatePolygons(pendingPolygons ?: _polygons)
    overlayController.updateCircles(pendingCircles ?: _circles)
    pendingMarkers = null
    pendingPolylines = null
    pendingPolygons = null
    pendingCircles = null

    _region?.let { region ->
      if (_camera == null) {
        applyRegion(region)
      }
    }
    _camera?.let { updateMapCamera(it, animated = false) }
  }

  private fun syncMarkerPressHandlers() {
    overlayController.setMarkerPressHandlers(
      onMarkerPress = onMarkerPress,
      onClusterPress = onClusterPress?.let { callback ->
        { ids, coordinate -> callback(ids.toTypedArray(), coordinate) }
      },
    )
  }

  private fun applyUiSettings(map: GoogleMap? = googleMap) {
    map?.uiSettings?.apply {
      isScrollGesturesEnabled = scrollEnabled ?: true
      isZoomGesturesEnabled = zoomEnabled ?: true
      isRotateGesturesEnabled = rotateEnabled ?: true
      isTiltGesturesEnabled = pitchEnabled ?: true
      isCompassEnabled = _showsCompass ?: true
    }
  }

  private fun applyUserLocationSettings(map: GoogleMap? = googleMap) {
    val enabled = _showsUserLocation == true
    if (!enabled) {
      map?.isMyLocationEnabled = false
      return
    }

    val hasFineLocationPermission = ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.ACCESS_FINE_LOCATION,
    ) == PackageManager.PERMISSION_GRANTED
    val hasCoarseLocationPermission = ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.ACCESS_COARSE_LOCATION,
    ) == PackageManager.PERMISSION_GRANTED

    if (hasFineLocationPermission || hasCoarseLocationPermission) {
      map?.isMyLocationEnabled = true
      if (_followsUserLocation == true) {
        // Google Maps does not have a direct follow mode; host apps can animate camera separately.
      }
    }
  }

  private fun applyMapPadding(map: GoogleMap? = googleMap) {
    val padding = _mapPadding
    if (padding == null) {
      map?.setPadding(0, 0, 0, 0)
      return
    }

    map?.setPadding(
      padding.left.toInt(),
      padding.top.toInt(),
      padding.right.toInt(),
      padding.bottom.toInt(),
    )
  }

  private fun applyCustomMapStyle(map: GoogleMap? = googleMap) {
    val styleJson = _customMapStyle
    if (styleJson.isNullOrEmpty()) {
      map?.setMapStyle(null)
      return
    }

    map?.setMapStyle(MapStyleOptions(styleJson))
  }

  private fun applyRegion(region: Region, animated: Boolean = false) {
    val map = googleMap ?: return
    val bounds = region.toLatLngBounds()
    val paddingPx = _mapPadding.toPaddingPixels()

    val runUpdate = {
      val update = CameraUpdateFactory.newLatLngBounds(bounds, paddingPx)
      if (animated) {
        map.animateCamera(update)
      } else {
        map.moveCamera(update)
      }
    }

    runWhenMapViewLaidOut(runUpdate)
  }

  private fun updateMapCamera(
    camera: Camera,
    animated: Boolean,
    durationMs: Int = 0,
  ) {
    runOnMain {
      val map = googleMap ?: return@runOnMain
      val target = camera.toCameraPosition(map.cameraPosition)
      if (map.cameraPosition.approximatelyEquals(target)) {
        return@runOnMain
      }

      val update = CameraUpdateFactory.newCameraPosition(target)
      if (animated) {
        if (durationMs > 0) {
          map.animateCamera(update, durationMs, null)
        } else {
          map.animateCamera(update)
        }
      } else {
        map.moveCamera(update)
      }
    }
  }

  private fun installViewportSizeListener(mapView: MapView) {
    val syncViewportSize = {
      if (mapView.width > 0 && mapView.height > 0) {
        overlayController.setViewportSize(mapView.width, mapView.height)
      }
    }

    mapView.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ ->
      syncViewportSize()
    }
    runWhenViewLaidOut(mapView, syncViewportSize)
  }

  private fun runWhenMapViewLaidOut(block: () -> Unit) {
    runWhenViewLaidOut(view, block)
  }

  private fun runWhenViewLaidOut(target: View, block: () -> Unit) {
    if (target.width > 0 && target.height > 0) {
      updateOverlayViewportSize()
      block()
      return
    }

    target.viewTreeObserver.addOnGlobalLayoutListener(
      object : ViewTreeObserver.OnGlobalLayoutListener {
        override fun onGlobalLayout() {
          if (target.width <= 0 || target.height <= 0) {
            return
          }

          target.viewTreeObserver.removeOnGlobalLayoutListener(this)
          updateOverlayViewportSize()
          block()
        }
      },
    )
  }

  private fun updateOverlayViewportSize() {
    overlayController.setViewportSize(view.width, view.height)
  }

  private fun runOnMain(block: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) {
      block()
    } else {
      mainHandler.post(block)
    }
  }

  private fun <T> promiseOnMain(block: () -> T): Promise<T> {
    val promise = Promise<T>()
    runOnMain {
      try {
        promise.resolve(block())
      } catch (error: Throwable) {
        promise.reject(error)
      }
    }
    return promise
  }

  private fun handleRegionWillChange(userInteracting: Boolean) {
    if (userInteracting && !isUserGesture) {
      isUserGesture = true
      emitRegionChange(complete = false)
    }
  }

  private fun handleRegionDidChange() {
    if (isUserGesture) {
      emitRegionChange(complete = true)
      isUserGesture = false
    }
  }

  private fun emitRegionChange(complete: Boolean) {
    val region = currentRegion()
    if (complete) {
      onRegionChangeComplete?.invoke(region)
    } else {
      onRegionChange?.invoke(region)
    }
  }

  private fun currentRegion(): Region {
    val bounds = googleMap?.projection?.visibleRegion?.latLngBounds
    if (bounds != null) {
      return bounds.toRegion()
    }

    return _region ?: Region(
      latitude = 0.0,
      longitude = 0.0,
      latitudeDelta = 0.0,
      longitudeDelta = 0.0,
    )
  }

  private fun notifyMapReadyIfNeeded() {
    if (hasFiredMapReady) {
      return
    }

    hasFiredMapReady = true
    onMapReady?.invoke()
  }

  override fun prepareForRecycle() {
    isUserGesture = false
    hasFiredMapReady = false
    onRegionChange = null
    onRegionChangeComplete = null
    onMapReady = null
    onPress = null
    onPoiPress = null
    onLongPress = null
    onMarkerPress = null
    onMarkerDragEnd = null
    onPolylinePress = null
    onPolygonPress = null
    onCirclePress = null
    onClusterPress = null
    _markers = null
    _polylines = null
    _polygons = null
    _circles = null
    pendingMarkers = null
    pendingPolylines = null
    pendingPolygons = null
    pendingCircles = null
    overlayController.clear()
    _mapType = MapType.STANDARD
    _region = null
    _camera = null
    scrollEnabled = true
    zoomEnabled = true
    rotateEnabled = true
    pitchEnabled = true
    _showsUserLocation = null
    _followsUserLocation = null
    _showsCompass = null
    _showsScale = null
    _customMapStyle = null
    _clusteringEnabled = null
    _mapPadding = null
    _markerEnteringAnimation = null
    _clusterEnteringAnimation = null
    overlayController.markerEnteringAnimation = null
    overlayController.clusterEnteringAnimation = null
    googleMap?.mapType = MapType.STANDARD.toGoogleMapType()
    googleMap?.isMyLocationEnabled = false
    googleMap?.setMapStyle(null)
    googleMap?.setPadding(0, 0, 0, 0)
    applyUiSettings()
    destroyMapView()
  }

  /**
   * Tears the map down for good. Both call sites discard the adapter afterwards;
   * detaching from the window deliberately does not come here.
   */
  private fun destroyMapView() {
    if (lifecycle.isDestroyed) {
      return
    }

    context.removeLifecycleEventListener(this)
    context.unregisterComponentCallbacks(memoryCallbacks)
    view.removeOnAttachStateChangeListener(attachStateListener)
    lifecycle.moveTo(MapViewLifecycleState.DESTROYED)
    googleMap = null
  }
}

private fun normalizeGoogleMapId(value: String?): String? = value?.trim()?.takeIf { it.isNotEmpty() }

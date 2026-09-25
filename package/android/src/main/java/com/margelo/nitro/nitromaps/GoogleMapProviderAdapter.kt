package com.margelo.nitro.nitromaps

import android.Manifest
import android.content.ComponentCallbacks
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.util.Log
import android.view.View
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

private const val MAP_RELEASED_BEFORE_LAYOUT_MESSAGE = "MapView was released before it was laid out"

@Keep
@DoNotStrip
class GoogleMapProviderAdapter(
  private val context: ThemedReactContext,
  initialGoogleMapId: String?,
) : MapProviderAdapter,
  LifecycleEventListener {
  private var googleMap: GoogleMap? = null
  private var isUserGesture = false
  private var hasFiredMapReady = false
  private val overlayController = MapOverlayController(context)
  private var pendingMarkers: Array<MarkerDescriptor>? = null
  private var pendingPolylines: Array<PolylineDescriptor>? = null
  private var pendingPolygons: Array<PolygonDescriptor>? = null
  private var pendingCircles: Array<CircleDescriptor>? = null
  private val density: Float = context.resources.displayMetrics.density
  private val deferredMap = DeferredGoogleMap()

  private val googleMapIdAtCreation: String? = normalizeGoogleMapId(initialGoogleMapId)

  override val view: MapView =
    MapView(
      context,
      GoogleMapOptions().apply {
        googleMapIdAtCreation?.let { mapId ->
          mapId(mapId)
        }
      },
    )

  private val lifecycle = MapViewLifecycleOwner(view)
  private val deferredLayout = DeferredLayout(view)

  private var isAttachedToWindow = false

  /** React only mounts views while the host runs; [onHostPause] corrects this. */
  private var isHostResumed = true

  private val attachStateListener =
    object : View.OnAttachStateChangeListener {
      override fun onViewAttachedToWindow(v: View) {
        isAttachedToWindow = true
        syncLifecycleState()
      }

      override fun onViewDetachedFromWindow(v: View) {
        isAttachedToWindow = false
        syncLifecycleState()
      }
    }

  private val memoryCallbacks =
    object : ComponentCallbacks {
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
        applyCameraProp(value)
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
      // Without a map the markers are parked, not drawn, so they must not be redelivered.
      if (googleMap != null) {
        overlayController.setMarkers(_markers)
      }
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

  override fun fetchCamera(): Promise<Camera> = deferredMap.promise { map -> map.cameraPosition.toCamera() }

  override fun applyCamera(camera: Camera): Promise<Unit> =
    deferredMap.promise { map ->
      updateMapCamera(map, camera, animated = false)
    }

  override fun animateCamera(
    camera: Camera,
    duration: Double?,
  ): Promise<Unit> {
    val animationDuration = duration ?: 0.25
    return deferredMap.promise { map ->
      updateMapCamera(map, camera, animated = true, durationMs = (animationDuration * 1000).toInt())
    }
  }

  override fun getVisibleRegion(): Promise<VisibleRegion> = deferredMap.promise { map -> map.projection.toNitroVisibleRegion() }

  override fun fitToCoordinates(
    coordinates: Array<Coordinate>,
    padding: EdgePadding?,
    animated: Boolean?,
  ): Promise<Unit> {
    // Filtered up front: `LatLngBounds` throws on a coordinate outside the world,
    // and a skipped one deserves a warning rather than a rejected promise.
    val validCoordinates = coordinates.filter { it.isValid() }
    val skipped = coordinates.size - validCoordinates.size
    if (skipped > 0) {
      Log.w(NITRO_MAPS_LOG_TAG, "fitToCoordinates skipped $skipped coordinate(s) outside the world.")
    }
    if (validCoordinates.isEmpty()) {
      return Promise.resolved(Unit)
    }

    return deferredMap.promiseCompletion { map, complete ->
      val builder = LatLngBounds.Builder()
      for (coordinate in validCoordinates) {
        builder.include(LatLng(coordinate.latitude, coordinate.longitude))
      }
      val bounds = builder.build()

      // `newLatLngBounds` throws on a map that has no size yet, so the camera
      // update waits for the first layout pass -- and so does the promise, which
      // rejects if the view is released before that pass comes.
      runWhenMapViewLaidOut(
        onCancel = {
          complete(Result.failure(IllegalStateException(MAP_RELEASED_BEFORE_LAYOUT_MESSAGE)))
        },
      ) {
        complete(
          runCatching {
            // Inside the callback: converting the insets needs the size the map was laid out with.
            val target =
              bounds.expandedForEdgePadding(
                padding?.toPixels(density),
                _mapPadding?.toPixels(density),
                view.width,
                view.height,
              ) ?: bounds
            val update = CameraUpdateFactory.newLatLngBounds(target, 0)
            if (animated == true) {
              map.animateCamera(update)
            } else {
              map.moveCamera(update)
            }
          },
        )
      }
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
    val target =
      when {
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
    _camera?.let { camera -> updateMapCamera(map, camera, animated = false) }

    // Last, so an imperative call made while the map was still loading wins over
    // the `region`/`camera` props it was issued after.
    deferredMap.attach(map)
  }

  private fun applyCameraProp(camera: Camera) {
    runOnMain {
      val map = googleMap ?: return@runOnMain
      updateMapCamera(map, camera, animated = false)
    }
  }

  private fun syncMarkerPressHandlers() {
    overlayController.setMarkerPressHandlers(
      onMarkerPress = onMarkerPress,
      onClusterPress =
        onClusterPress?.let { callback ->
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

    val hasFineLocationPermission =
      ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.ACCESS_FINE_LOCATION,
      ) == PackageManager.PERMISSION_GRANTED
    val hasCoarseLocationPermission =
      ContextCompat.checkSelfPermission(
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
    val padding = _mapPadding?.toPixels(density)
    if (padding == null) {
      map?.setPadding(0, 0, 0, 0)
      return
    }

    map?.setPadding(padding.left, padding.top, padding.right, padding.bottom)
  }

  private fun applyCustomMapStyle(map: GoogleMap? = googleMap) {
    val styleJson = _customMapStyle
    if (styleJson.isNullOrEmpty()) {
      map?.setMapStyle(null)
      return
    }

    map?.setMapStyle(MapStyleOptions(styleJson))
  }

  private fun applyRegion(
    region: Region,
    animated: Boolean = false,
  ) {
    if (!region.isValid()) {
      Log.w(NITRO_MAPS_LOG_TAG, "Ignored an invalid region: $region.")
      return
    }

    val map = googleMap ?: return
    val bounds = region.toLatLngBounds()

    val runUpdate = {
      // No padding argument: Google Maps already fits bounds inside the region `setPadding`
      // leaves over, so passing `mapPadding` here as well would inset the region twice.
      val update = CameraUpdateFactory.newLatLngBounds(bounds, 0)
      if (animated) {
        map.animateCamera(update)
      } else {
        map.moveCamera(update)
      }
    }

    runWhenMapViewLaidOut(block = runUpdate)
  }

  private fun updateMapCamera(
    map: GoogleMap,
    camera: Camera,
    animated: Boolean,
    durationMs: Int = 0,
  ) {
    // Every camera path ends here - the `camera` prop, its replay in `configureMap`, and
    // `applyCamera`/`animateCamera` - so this one check covers them all. An invalid camera is
    // skipped rather than thrown: the prop path has no promise to reject, so a throw out of
    // `CameraPosition` would surface as an uncaught main-thread exception. For the two
    // imperative calls it is only a backstop: `MapViewRef` rejects an invalid camera in JS
    // before the call is queued.
    if (!camera.isValid()) {
      Log.w(NITRO_MAPS_LOG_TAG, "Ignored an invalid camera: $camera.")
      return
    }

    val target = camera.toCameraPosition(map.cameraPosition)
    if (map.cameraPosition.approximatelyEquals(target)) {
      return
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

  private fun installViewportSizeListener(mapView: MapView) {
    val syncViewportSize = {
      if (mapView.width > 0 && mapView.height > 0) {
        overlayController.setViewportSize(mapView.width, mapView.height)
      }
    }

    mapView.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ ->
      syncViewportSize()
    }
    runWhenMapViewLaidOut(block = syncViewportSize)
  }

  /**
   * Runs [block] once the map view has a size - see [DeferredLayout]. [onCancel] runs
   * instead if the map is destroyed before that.
   */
  private fun runWhenMapViewLaidOut(
    onCancel: () -> Unit = {},
    block: () -> Unit,
  ) {
    deferredLayout.run(onCancel) {
      updateOverlayViewportSize()
      block()
    }
  }

  private fun updateOverlayViewportSize() {
    overlayController.setViewportSize(view.width, view.height)
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

  override fun release() {
    // Drop the JS callbacks first: a map event still in flight must not reach a
    // view that is already gone.
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

    overlayController.clear()
    destroyMapView()
  }

  /**
   * Tears the map down for good. Both call sites discard the adapter afterwards;
   * detaching from the window deliberately does not come here.
   */
  private fun destroyMapView() {
    deferredMap.release()
    deferredLayout.release()

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

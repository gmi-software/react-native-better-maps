package com.margelo.nitro.nitromaps

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import com.facebook.react.uimanager.ThemedReactContext
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.model.Circle
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.Marker
import com.google.android.gms.maps.model.MarkerOptions
import com.google.android.gms.maps.model.Polygon
import com.google.android.gms.maps.model.Polyline
import java.util.concurrent.Executors

/** Reconciles overlay descriptors with Google Maps overlay objects. */
class MapOverlayController(
  private var googleMap: GoogleMap?,
  private val context: ThemedReactContext,
) {
  private val markers = HashMap<String, Marker>()
  private val mainHandler = Handler(Looper.getMainLooper())
  private val density: Float = context.resources.displayMetrics.density
  private val markerIconFactory = MarkerIconFactory(context, density) { markers }
  private val markerVersions = HashMap<String, Long>()
  private val clusterByKey = HashMap<String, ClusterElement.Cluster>()
  private val polylines = LinkedHashMap<String, Polyline>()
  private val polygons = LinkedHashMap<String, Polygon>()
  private val circles = LinkedHashMap<String, Circle>()
  private val markerEnterAnimators = HashMap<String, Animator>()
  private var clusteringEnabled = false
  private var onMarkerPress: ((String) -> Unit)? = null
  private var onClusterPress: ((List<String>, Coordinate) -> Unit)? = null
  private var allMarkerDescriptors: Array<MarkerDescriptor> = emptyArray()
  private var markersFingerprint: Int = 0
  private var spatialIndex: MarkerSpatialIndex? = null
  private var refreshGeneration: Int = 0
  private var viewWidthPx: Int = 0
  private var viewHeightPx: Int = 0
  private var idleRefreshRunnable: Runnable? = null
  private var liveRefreshRunnable: Runnable? = null
  private var lastLiveRefreshMs: Long = 0L
  private var computeExecutor = Executors.newSingleThreadExecutor()
  private val iconFactory = ClusterIconFactory(density)

  var markerEnteringAnimation: OverlayEnteringAnimationDescriptor? = null
  var clusterEnteringAnimation: OverlayEnteringAnimationDescriptor? = null

  fun setGoogleMap(map: GoogleMap?) {
    googleMap = map
    if (map == null) {
      clear()
    }
  }

  /** Updates the cached map viewport size used to size the clustering grid. */
  fun setViewportSize(widthPx: Int, heightPx: Int) {
    if (viewWidthPx == widthPx && viewHeightPx == heightPx) {
      return
    }

    viewWidthPx = widthPx
    viewHeightPx = heightPx
    if (widthPx > 0 && heightPx > 0 && usesViewportPipeline()) {
      refreshViewportMarkers()
    }
  }

  fun setClusteringEnabled(enabled: Boolean) {
    if (clusteringEnabled == enabled) {
      return
    }

    clusteringEnabled = enabled
    reapplyMarkers()
  }

  fun setMarkerPressHandlers(
    onMarkerPress: ((String) -> Unit)?,
    onClusterPress: ((List<String>, Coordinate) -> Unit)?,
  ) {
    this.onMarkerPress = onMarkerPress
    this.onClusterPress = onClusterPress
  }

  fun clear() {
    markerEnterAnimators.values.toSet().forEach { it.cancel() }
    cancelIdleRefresh()
    cancelLiveRefresh()
    markerEnterAnimators.clear()
    markers.values.forEach { it.remove() }
    polylines.values.forEach { it.remove() }
    polygons.values.forEach { it.remove() }
    circles.values.forEach { it.remove() }
    markers.clear()
    markerVersions.clear()
    clusterByKey.clear()
    polylines.clear()
    polygons.clear()
    circles.clear()
    allMarkerDescriptors = emptyArray()
    markersFingerprint = 0
    spatialIndex = null
    refreshGeneration += 1
    computeExecutor.shutdown()
    computeExecutor = Executors.newSingleThreadExecutor()
  }

  fun setMarkers(descriptors: Array<MarkerDescriptor>?) {
    val next = descriptors ?: emptyArray()
    val fingerprint = next.markersFingerprint()
    if (fingerprint == markersFingerprint) {
      return
    }

    markersFingerprint = fingerprint
    allMarkerDescriptors = next
    spatialIndex = null
    reapplyMarkers()
  }

  /**
   * Whether markers are driven by the background viewport pipeline (clustering
   * or large LOD) rather than the synchronous small-dataset path.
   */
  private fun usesViewportPipeline(): Boolean {
    return clusteringEnabled || allMarkerDescriptors.size > ASYNC_THRESHOLD
  }

  private fun reapplyMarkers() {
    googleMap ?: return
    if (usesViewportPipeline()) {
      rebuildIndexAndRefresh()
    } else {
      applyMarkersSync(allMarkerDescriptors)
    }
  }

  fun refreshViewportMarkers(
    animateEntering: Boolean = true,
    updateRetained: Boolean = true,
    maxAnimatedMarkers: Int = MAX_ANIMATED_MARKERS_PER_DIFF,
  ) {
    val map = googleMap ?: return
    val index = spatialIndex ?: return
    if (!usesViewportPipeline()) {
      return
    }
    if (viewWidthPx <= 0 || viewHeightPx <= 0) {
      return
    }

    val bounds = map.projection.visibleRegion.latLngBounds
    val latitudeSpan = bounds.northeast.latitude - bounds.southwest.latitude
    val clustering = clusteringEnabled
    val widthPx = viewWidthPx
    val heightPx = viewHeightPx
    val displayedVersions = HashMap(markerVersions)
    refreshGeneration += 1
    val generation = refreshGeneration

    computeExecutor.execute {
      val candidates = index.candidates(bounds)
      val elements: List<ClusterElement> = if (clustering) {
        MarkerClusterEngine.clusters(candidates, bounds, widthPx, heightPx, density)
      } else {
        MarkerViewportFilter.displaySubset(candidates, bounds, latitudeSpan)
          .map { ClusterElement.Single(it) }
      }

      val nextKeys = HashSet<String>(elements.size)
      val added = ArrayList<ClusterElement>()
      val retained = ArrayList<ClusterElement>()
      for (element in elements) {
        val key = element.diffKey
        if (!nextKeys.add(key)) {
          continue
        }
        val version = element.renderVersion
        if (displayedVersions[key] != null) {
          if (updateRetained && displayedVersions[key] != version) {
            retained.add(element)
          }
        } else {
          added.add(element)
        }
      }
      val removed = displayedVersions.keys - nextKeys

      mainHandler.post {
        if (generation != refreshGeneration) {
          return@post
        }
        applyDiff(removed, added, retained, animateEntering, maxAnimatedMarkers)
      }
    }
  }

  private fun rebuildIndexAndRefresh() {
    val descriptors = allMarkerDescriptors
    refreshGeneration += 1
    val generation = refreshGeneration

    computeExecutor.execute {
      val index = MarkerSpatialIndex(descriptors)
      mainHandler.post {
        if (generation != refreshGeneration) {
          return@post
        }
        spatialIndex = index
        refreshViewportMarkers()
      }
    }
  }

  private fun applyDiff(
    removedKeys: Set<String>,
    added: List<ClusterElement>,
    retained: List<ClusterElement>,
    animateEntering: Boolean = true,
    maxAnimatedMarkers: Int = MAX_ANIMATED_MARKERS_PER_DIFF,
  ) {
    val map = googleMap ?: return

    for (key in removedKeys) {
      cancelEnteringAnimation(key)
      markers.remove(key)?.remove()
      markerVersions.remove(key)
      clusterByKey.remove(key)
    }

    var remainingAnimationBudget = maxAnimatedMarkers.coerceAtLeast(0)
    val addedMarkers = ArrayList<AddedMarker>(minOf(added.size, remainingAnimationBudget))
    for (element in added) {
      val key = element.diffKey
      when (element) {
        is ClusterElement.Single -> {
          val animation = enteringAnimation(element)
          val shouldAnimate = animateEntering &&
            remainingAnimationBudget > 0 &&
            OverlayEnteringAnimationResolver.shouldRun(animation)
          val options = element.descriptor.toMarkerOptions()
          if (shouldAnimate) {
            options.alpha(0f)
          }
          map.addMarker(options)?.also { marker ->
            marker.tag = element.descriptor.id
            markers[key] = marker
            markerIconFactory.applyVisualProps(element.descriptor, marker, key)
            markerVersions[key] = element.renderVersion
            if (shouldAnimate) {
              addedMarkers.add(AddedMarker(key, marker, animation))
              remainingAnimationBudget -= 1
            }
          }
        }
        is ClusterElement.Cluster -> {
          val animation = enteringAnimation(element)
          val shouldAnimate = animateEntering &&
            remainingAnimationBudget > 0 &&
            OverlayEnteringAnimationResolver.shouldRun(animation)
          val options = MarkerOptions()
            .position(element.position)
            .icon(iconFactory.icon(element.count))
            .anchor(0.5f, 0.5f)
          if (shouldAnimate) {
            options.alpha(0f)
          }
          map.addMarker(options)?.also { marker ->
            marker.tag = key
            markers[key] = marker
            markerVersions[key] = element.renderVersion
            clusterByKey[key] = element
            if (shouldAnimate) {
              addedMarkers.add(AddedMarker(key, marker, animation))
              remainingAnimationBudget -= 1
            }
          }
        }
      }
    }

    for (element in retained) {
      val key = element.diffKey
      val marker = markers[key] ?: continue
      cancelEnteringAnimation(key)
      marker.alpha = 1f
      when (element) {
        is ClusterElement.Single -> {
          marker.tag = element.descriptor.id
          marker.position = LatLng(
            element.descriptor.coordinate.latitude,
            element.descriptor.coordinate.longitude,
          )
          marker.title = element.descriptor.title
          marker.snippet = element.descriptor.subtitle
          marker.isDraggable = element.descriptor.draggable == true
          markerIconFactory.applyVisualProps(element.descriptor, marker, key)
          clusterByKey.remove(key)
        }
        is ClusterElement.Cluster -> {
          marker.position = element.position
          marker.setIcon(iconFactory.icon(element.count))
          clusterByKey[key] = element
        }
      }
      markerVersions[key] = element.renderVersion
    }

    animateEntering(addedMarkers)
  }

  /** Applies entering animations to newly added markers via a single shared animator. */
  private fun animateEntering(added: List<AddedMarker>) {
    if (added.isEmpty()) {
      return
    }

    val animated = added.mapNotNull { addedMarker ->
      if (!OverlayEnteringAnimationResolver.shouldRun(addedMarker.animation)) {
        return@mapNotNull null
      }
      cancelEnteringAnimation(addedMarker.key)
      addedMarker.marker.alpha = 0f
      addedMarker
    }

    if (animated.isEmpty()) {
      return
    }

    val startDelayMs = animated.minOf { it.animation.delayMs }
    val totalDurationMs = animated.maxOf {
      it.animation.delayMs + it.animation.durationMs
    } - startDelayMs

    val animator = ValueAnimator.ofFloat(0f, 1f)
    animator.duration = totalDurationMs
    animator.startDelay = startDelayMs
    animator.apply {
      addUpdateListener { animator ->
        val elapsed = (animator.animatedFraction * duration).toLong()
        animated.forEach { animatedMarker ->
          val localElapsed = elapsed - (animatedMarker.animation.delayMs - startDelay)
          val progress = (localElapsed.toFloat() / animatedMarker.animation.durationMs.toFloat())
            .coerceIn(0f, 1f)
          animatedMarker.marker.alpha = progress
        }
      }
      addListener(object : AnimatorListenerAdapter() {
        override fun onAnimationEnd(animation: Animator) {
          revealAnimatedMarkers(animated)
          clearCompletedAnimator(animation, animated)
        }

        override fun onAnimationCancel(animation: Animator) {
          revealAnimatedMarkers(animated)
          clearCompletedAnimator(animation, animated)
        }
      })
    }
    animated.forEach { markerEnterAnimators[it.key] = animator }
    animator.start()
  }

  private fun revealAnimatedMarkers(animated: List<AddedMarker>) {
    animated.forEach { animatedMarker ->
      animatedMarker.marker.alpha = 1f
    }
  }

  private fun cancelEnteringAnimation(key: String) {
    markerEnterAnimators.remove(key)?.cancel()
  }

  private fun clearCompletedAnimator(animator: Animator, animated: List<AddedMarker>) {
    animated.forEach { animatedMarker ->
      if (markerEnterAnimators[animatedMarker.key] === animator) {
        markerEnterAnimators.remove(animatedMarker.key)
      }
    }
  }

  private fun enteringAnimation(element: ClusterElement): ResolvedOverlayEnteringAnimation {
    return when (element) {
      is ClusterElement.Single -> OverlayEnteringAnimationResolver.resolve(
        element.descriptor.enteringAnimation,
        markerEnteringAnimation,
      )
      is ClusterElement.Cluster -> OverlayEnteringAnimationResolver.resolve(clusterEnteringAnimation)
    }
  }

  private fun applyMarkersSync(descriptors: Array<MarkerDescriptor>) {
    val map = googleMap ?: return
    refreshGeneration += 1
    cancelIdleRefresh()
    cancelLiveRefresh()
    markerVersions.clear()
    clusterByKey.clear()
    reconcile(
      current = markers,
      next = descriptors.associate { ("s:" + it.id) to it },
      remove = { marker ->
        (marker.tag as? String)?.let { cancelEnteringAnimation(it) }
        marker.remove()
      },
      add = { descriptor ->
        val element = ClusterElement.Single(descriptor)
        val key = "s:" + descriptor.id
        val animation = enteringAnimation(element)
        val options = descriptor.toMarkerOptions()
        if (OverlayEnteringAnimationResolver.shouldRun(animation)) {
          options.alpha(0f)
        }
        map.addMarker(options)?.also { marker ->
          marker.tag = descriptor.id
          markers[key] = marker
          markerIconFactory.applyVisualProps(descriptor, marker, key)
          markerVersions[key] = element.renderVersion
          animateEntering(listOf(AddedMarker(key, marker, animation)))
        }
      },
      update = { marker, descriptor ->
        val element = ClusterElement.Single(descriptor)
        val key = "s:" + descriptor.id
        (marker.tag as? String)?.let { cancelEnteringAnimation(it) }
        marker.alpha = 1f
        marker.tag = descriptor.id
        marker.position = LatLng(
          descriptor.coordinate.latitude,
          descriptor.coordinate.longitude,
        )
        marker.title = descriptor.title
        marker.snippet = descriptor.subtitle
        marker.isDraggable = descriptor.draggable == true
        markerIconFactory.applyVisualProps(descriptor, marker, key)
        markerVersions[key] = element.renderVersion
        marker
      },
    )
  }

  fun onCameraIdle() {
    if (usesViewportPipeline()) {
      scheduleIdleRefresh()
    }
  }

  /** Runs a lightweight live pass while deferring exact marker updates to idle. */
  fun onCameraMove() {
    cancelIdleRefresh()
    scheduleLiveRefresh()
  }

  private fun scheduleIdleRefresh() {
    cancelLiveRefresh()
    cancelIdleRefresh()
    val runnable = Runnable {
      idleRefreshRunnable = null
      if (usesViewportPipeline()) {
        refreshViewportMarkers()
      }
    }
    idleRefreshRunnable = runnable
    mainHandler.postDelayed(runnable, IDLE_REFRESH_DEBOUNCE_MS)
  }

  private fun scheduleLiveRefresh() {
    if (!usesViewportPipeline() || liveRefreshRunnable != null) {
      return
    }

    val now = SystemClock.uptimeMillis()
    val elapsed = now - lastLiveRefreshMs
    if (lastLiveRefreshMs == 0L || elapsed >= LIVE_REFRESH_THROTTLE_MS) {
      runLiveRefresh()
      return
    }

    val runnable = Runnable {
      liveRefreshRunnable = null
      runLiveRefresh()
    }
    liveRefreshRunnable = runnable
    mainHandler.postDelayed(runnable, LIVE_REFRESH_THROTTLE_MS - elapsed)
  }

  private fun runLiveRefresh() {
    lastLiveRefreshMs = SystemClock.uptimeMillis()
    if (usesViewportPipeline()) {
      refreshViewportMarkers(
        animateEntering = true,
        updateRetained = true,
        maxAnimatedMarkers = MAX_LIVE_ANIMATED_MARKERS_PER_DIFF,
      )
    }
  }

  private fun cancelIdleRefresh() {
    idleRefreshRunnable?.let(mainHandler::removeCallbacks)
    idleRefreshRunnable = null
  }

  private fun cancelLiveRefresh() {
    liveRefreshRunnable?.let(mainHandler::removeCallbacks)
    liveRefreshRunnable = null
    lastLiveRefreshMs = 0L
  }

  fun onMarkerClick(marker: Marker): Boolean {
    val key = marker.tag as? String ?: return false
    val cluster = clusterByKey[key]
    if (cluster != null) {
      onClusterPress?.invoke(
        cluster.memberIds,
        Coordinate(
          latitude = cluster.position.latitude,
          longitude = cluster.position.longitude,
        ),
      )
      googleMap?.animateCamera(
        CameraUpdateFactory.newLatLngBounds(cluster.bounds, (72 * density).toInt()),
      )
      return true
    }

    onMarkerPress?.invoke(key)
    return false
  }

  fun updatePolylines(descriptors: Array<PolylineDescriptor>?) {
    val map = googleMap ?: return
    reconcile(
      current = polylines,
      next = descriptors?.associateBy { it.id } ?: emptyMap(),
      remove = { it.remove() },
      add = { descriptor ->
        map.addPolyline(descriptor.toPolylineOptions()).also { polyline ->
          polyline.tag = descriptor.id
        }
      },
      update = { polyline, descriptor ->
        polyline.remove()
        map.addPolyline(descriptor.toPolylineOptions()).also { replacement ->
          replacement.tag = descriptor.id
        }
      },
    )
  }

  fun updatePolygons(descriptors: Array<PolygonDescriptor>?) {
    val map = googleMap ?: return
    reconcile(
      current = polygons,
      next = descriptors?.associateBy { it.id } ?: emptyMap(),
      remove = { it.remove() },
      add = { descriptor ->
        map.addPolygon(descriptor.toPolygonOptions()).also { polygon ->
          polygon.tag = descriptor.id
        }
      },
      update = { polygon, descriptor ->
        polygon.remove()
        map.addPolygon(descriptor.toPolygonOptions()).also { replacement ->
          replacement.tag = descriptor.id
        }
      },
    )
  }

  fun updateCircles(descriptors: Array<CircleDescriptor>?) {
    val map = googleMap ?: return
    reconcile(
      current = circles,
      next = descriptors?.associateBy { it.id } ?: emptyMap(),
      remove = { it.remove() },
      add = { descriptor ->
        map.addCircle(descriptor.toCircleOptions()).also { circle ->
          circle.tag = descriptor.id
        }
      },
      update = { circle, descriptor ->
        circle.remove()
        map.addCircle(descriptor.toCircleOptions()).also { replacement ->
          replacement.tag = descriptor.id
        }
      },
    )
  }

  private fun <T, Descriptor> reconcile(
    current: MutableMap<String, T>,
    next: Map<String, Descriptor>,
    remove: (T) -> Unit,
    add: (Descriptor) -> T?,
    update: (T, Descriptor) -> T,
  ) {
    val nextIds = next.keys
    val existingIds = current.keys

    for (removedId in existingIds - nextIds) {
      current.remove(removedId)?.let(remove)
    }

    for ((id, descriptor) in next) {
      val existing = current[id]
      if (existing == null) {
        add(descriptor)?.let { created ->
          current[id] = created
        }
      } else {
        current[id] = update(existing, descriptor)
      }
    }
  }

  private companion object {
    /** Non-clustered datasets at or below this size reconcile synchronously. */
    const val ASYNC_THRESHOLD = 500

    /** Main-thread marker animations are capped so bulk refreshes do not block gestures. */
    const val MAX_ANIMATED_MARKERS_PER_DIFF = 96

    /** Live refresh keeps entrance motion visible without animating every marker during gestures. */
    const val MAX_LIVE_ANIMATED_MARKERS_PER_DIFF = 24

    /** Coalesces rapid Google Maps idle callbacks produced by repeated short pans. */
    const val IDLE_REFRESH_DEBOUNCE_MS = 120L

    /** Minimum delay between lightweight viewport updates while the camera moves. */
    const val LIVE_REFRESH_THROTTLE_MS = 180L
  }

  private data class AddedMarker(
    val key: String,
    val marker: Marker,
    val animation: ResolvedOverlayEnteringAnimation,
  )
}

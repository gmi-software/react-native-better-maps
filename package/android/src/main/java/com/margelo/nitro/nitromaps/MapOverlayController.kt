package com.margelo.nitro.nitromaps

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.WindowManager
import com.facebook.react.uimanager.ThemedReactContext
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.model.Circle
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import com.google.android.gms.maps.model.Marker
import com.google.android.gms.maps.model.MarkerOptions
import com.google.android.gms.maps.model.Polygon
import com.google.android.gms.maps.model.Polyline
import java.util.concurrent.Executors

/** Reconciles overlay descriptors with Google Maps overlay objects. */
class MapOverlayController(
  private var googleMap: GoogleMap?,
  private val context: ThemedReactContext,
) : MarkerStoreListener {
  private val markers = HashMap<MarkerRenderKey, Marker>()
  private val mainHandler = Handler(Looper.getMainLooper())
  private val density: Float = context.resources.displayMetrics.density
  private val markerIconFactory = MarkerIconFactory(context, density) { markers }
  private val markerVersions = HashMap<MarkerRenderKey, Long>()
  private val clustersById = HashMap<String, ClusterElement.Cluster>()
  private val polylines = LinkedHashMap<String, Polyline>()
  private val polygons = LinkedHashMap<String, Polygon>()
  private val circles = LinkedHashMap<String, Circle>()
  private val polylineVersions = HashMap<String, Long>()
  private val polygonVersions = HashMap<String, Long>()
  private val circleVersions = HashMap<String, Long>()
  private val markerEnterAnimators = HashMap<MarkerRenderKey, Animator>()
  private var clusteringEnabled = false
  private var onMarkerPress: ((String) -> Unit)? = null
  private var onClusterPress: ((NativeClusterPressEvent) -> Unit)? = null
  private var store: MarkerStore? = null
  /** Invalidates in-flight refresh results (viewport diffs). */
  private var refreshGeneration: Int = 0
  /** Bumped whenever the dataset or the clustering mode changes; keyed into the octave cache. */
  private var datasetGeneration: Long = 0L
  private var clusterCache = ClusterOctaveCache()
  private val applyQueue = MarkerApplyQueue()
  private val applyScheduler = MarkerApplyScheduler(
    applyQueue,
    object : MarkerApplyQueue.Sink {
      override fun remove(keys: List<MarkerRenderKey>) = applyRemovals(keys)

      override fun add(elements: List<ClusterElement>, pending: PendingMarkerApply) =
        applyAdds(elements, pending)

      override fun update(element: ClusterElement) = applyRetained(element)
    },
    expectedFrameNanos = { expectedFrameNanos },
  )
  private val expectedFrameNanos: Long by lazy {
    val rate = runCatching {
      @Suppress("DEPRECATION")
      (context.getSystemService(android.content.Context.WINDOW_SERVICE) as? WindowManager)
        ?.defaultDisplay?.refreshRate
    }.getOrNull()?.takeIf { it > 0f } ?: 60f
    (1_000_000_000.0 / rate).toLong()
  }
  private val refreshInbox = RefreshInbox()
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
    invalidateClusterCache()
    reapplyMarkers()
  }

  fun setMarkerPressHandlers(
    onMarkerPress: ((String) -> Unit)?,
    onClusterPress: ((NativeClusterPressEvent) -> Unit)?,
  ) {
    this.onMarkerPress = onMarkerPress
    this.onClusterPress = onClusterPress
  }

  /**
   * Renders markers from [next] and follows its changes until another store
   * (or null) is attached.
   */
  fun attachStore(next: MarkerStore?) {
    if (store === next) {
      return
    }
    store?.removeListener(this)
    store = next
    next?.addListener(this)
    refreshGeneration += 1
    refreshInbox.discardPending()
    invalidateClusterCache()
    reapplyMarkers()
  }

  override fun onMarkerStoreChanged(store: MarkerStore) {
    if (this.store === store) {
      invalidateClusterCache()
      reapplyMarkers()
    }
  }

  /**
   * The compute executor may still be inside a refresh that holds the old
   * cache, so a fresh object replaces it instead of clearing it in place.
   */
  private fun invalidateClusterCache() {
    datasetGeneration += 1
    clusterCache = ClusterOctaveCache()
  }

  /** Ids of the markers inside a displayed cluster; empty once it is gone. */
  fun clusterMembers(id: String): Array<String> {
    val cluster = clustersById[id] ?: return emptyArray()
    return store?.ids(cluster.memberHandles) ?: emptyArray()
  }

  /** The marker id behind a Google Maps marker, or null for cluster badges. */
  fun markerId(marker: Marker): String? = (marker.tag as? MarkerRenderKey.Single)?.id

  fun clear() {
    applyScheduler.cancel()
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
    clustersById.clear()
    polylines.clear()
    polygons.clear()
    circles.clear()
    polylineVersions.clear()
    polygonVersions.clear()
    circleVersions.clear()
    refreshGeneration += 1
    refreshInbox.discardPending()
    invalidateClusterCache()
    computeExecutor.shutdown()
    computeExecutor = Executors.newSingleThreadExecutor()
  }

  /**
   * Whether markers are driven by the background viewport pipeline (clustering
   * or large LOD) rather than the synchronous small-dataset path.
   */
  private fun usesViewportPipeline(): Boolean {
    return clusteringEnabled || (store?.markerCount ?: 0) > ASYNC_THRESHOLD
  }

  /**
   * Recomputes what is shown for the current dataset: synchronously for small
   * unclustered datasets, through the viewport pipeline otherwise.
   */
  fun reapplyMarkers() {
    googleMap ?: return
    if (usesViewportPipeline()) {
      refreshViewportMarkers()
    } else {
      applyMarkersSync()
    }
  }

  fun refreshViewportMarkers(
    animateEntering: Boolean = true,
    maxAnimatedMarkers: Int = MAX_ANIMATED_MARKERS_PER_DIFF,
  ) {
    val map = googleMap ?: return
    val store = store ?: return
    if (!usesViewportPipeline()) {
      return
    }
    if (viewWidthPx <= 0 || viewHeightPx <= 0) {
      return
    }

    val bounds = map.projection.visibleRegion.latLngBounds
    refreshGeneration += 1
    val request = ViewportRefreshRequest(
      generation = refreshGeneration,
      store = store,
      cache = clusterCache,
      datasetGeneration = datasetGeneration,
      bounds = bounds,
      latitudeSpan = bounds.northeast.latitude - bounds.southwest.latitude,
      clustering = clusteringEnabled,
      widthPx = viewWidthPx,
      heightPx = viewHeightPx,
      animateEntering = animateEntering,
      maxAnimatedMarkers = maxAnimatedMarkers,
    )
    if (!refreshInbox.post(request)) {
      // A compute task is already queued and will pick this request up.
      return
    }

    computeExecutor.execute {
      val pending = refreshInbox.take() ?: return@execute
      val target = computeViewportTarget(pending)

      mainHandler.post {
        if (pending.generation != refreshGeneration) {
          return@post
        }
        // Diffed here, against what is on the map now: the scheduler may have
        // applied adds from the previous diff while the target was computed,
        // and a diff against an older snapshot would add those markers twice.
        applyDiff(computeMarkerRenderDiff(target, markerVersions), pending.animateEntering, pending.maxAnimatedMarkers)
      }
    }
  }

  /** What the viewport should show: the index query, the cluster or LOD pass, and the materialized elements. */
  private fun computeViewportTarget(
    request: ViewportRefreshRequest,
  ): List<ClusterElement> = traceSection("NitroMaps.computeViewportDiff") {
    // Only the index query holds the store lock. The geometry runs on the
    // arrays as they were under it: a batch applied meanwhile replaces the
    // store's arrays instead of writing into these, and the notification that
    // follows every batch schedules the refresh that picks the new ones up.
    // Holding the lock through the cluster pass would stall the main thread,
    // which reads the store on every camera move.
    val snapshot = request.store.read { access ->
      ViewportSnapshot(access.index.candidates(request.bounds), access.latitudes, access.longitudes, access.flags)
    }
    val candidates = snapshot.candidates
    val elements: List<MarkerClusterEngine.Element> = if (request.clustering) {
      MarkerClusterEngine.clusters(
        candidates,
        snapshot.latitudes,
        snapshot.longitudes,
        snapshot.flags,
        request.bounds,
        request.widthPx,
        request.heightPx,
        density,
        cache = request.cache,
        generation = request.datasetGeneration,
      )
    } else {
      MarkerViewportFilter
        .displaySubset(candidates, snapshot.latitudes, snapshot.longitudes, request.bounds, request.latitudeSpan)
        .map { MarkerClusterEngine.Element.Single(it) }
    }

    request.store.read { access -> materialize(elements, access) }
  }

  /** What one viewport refresh takes from the store under its lock. */
  private class ViewportSnapshot(
    val candidates: IntArray,
    val latitudes: DoubleArray,
    val longitudes: DoubleArray,
    val flags: ByteArray,
  )

  /**
   * Turns handles into render elements with their descriptors and versions.
   * A handle removed between the query and this call is dropped.
   */
  private fun materialize(
    elements: List<MarkerClusterEngine.Element>,
    access: MarkerStoreAccess,
  ): List<ClusterElement> {
    val result = ArrayList<ClusterElement>(elements.size)
    for (element in elements) {
      when (element) {
        is MarkerClusterEngine.Element.Single -> {
          if (!access.isAlive(element.handle)) continue
          val descriptor = access.descriptors[element.handle] ?: continue
          result.add(ClusterElement.Single(element.handle, descriptor, access.versions[element.handle]))
        }
        is MarkerClusterEngine.Element.Cluster -> {
          result.add(
            ClusterElement.Cluster(
              id = element.id,
              position = element.position,
              count = element.count,
              memberHandles = element.memberHandles,
              bounds = element.bounds,
            ),
          )
        }
      }
    }
    return result
  }

  /**
   * Hands a diff to the frame scheduler: removals now, adds spread over frames
   * nearest to the camera first, retained updates in the remaining budget.
   */
  private fun applyDiff(
    diff: MarkerRenderDiff,
    animateEntering: Boolean = true,
    maxAnimatedMarkers: Int = MAX_ANIMATED_MARKERS_PER_DIFF,
  ) {
    val map = googleMap ?: return
    applyScheduler.schedule(
      PendingMarkerApply(
        diff,
        center = map.cameraPosition?.target,
        animateEntering = animateEntering,
        animationBudget = maxAnimatedMarkers.coerceAtLeast(0),
      ),
    )
  }

  private fun applyRemovals(keys: List<MarkerRenderKey>) {
    for (key in keys) {
      cancelEnteringAnimation(key)
      markers.remove(key)?.remove()
      markerVersions.remove(key)
      if (key is MarkerRenderKey.Cluster) {
        clustersById.remove(key.id)
      }
    }
  }

  private fun applyAdds(elements: List<ClusterElement>, pending: PendingMarkerApply) {
    val map = googleMap ?: return
    val animateEntering = pending.animateEntering
    var remainingAnimationBudget = pending.animationBudget
    val addedMarkers = ArrayList<AddedMarker>(minOf(elements.size, remainingAnimationBudget))
    for (element in elements) {
      val key = element.key
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
            marker.tag = key
            markers[key] = marker
            markerIconFactory.applyVisualProps(element.descriptor, marker, key)
            markerVersions[key] = element.renderVersion
            if (shouldAnimate) {
              val targetAlpha = element.descriptor.opacity?.toFloat() ?: 1f
              addedMarkers.add(AddedMarker(key, marker, animation, targetAlpha))
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
            clustersById[element.id] = element
            if (shouldAnimate) {
              addedMarkers.add(AddedMarker(key, marker, animation, targetAlpha = 1f))
              remainingAnimationBudget -= 1
            }
          }
        }
      }
    }
    pending.animationBudget = remainingAnimationBudget
    animateEntering(addedMarkers)
  }

  private fun applyRetained(element: ClusterElement) {
    val key = element.key
    val marker = markers[key] ?: return
    cancelEnteringAnimation(key)
    when (element) {
      is ClusterElement.Single -> {
        marker.position = LatLng(
          element.descriptor.coordinate.latitude,
          element.descriptor.coordinate.longitude,
        )
        marker.title = element.descriptor.title
        marker.snippet = element.descriptor.subtitle
        marker.isDraggable = element.descriptor.draggable == true
        markerIconFactory.applyVisualProps(element.descriptor, marker, key)
      }
      is ClusterElement.Cluster -> {
        marker.alpha = 1f
        marker.position = element.position
        marker.setIcon(iconFactory.icon(element.count))
        clustersById[element.id] = element
      }
    }
    markerVersions[key] = element.renderVersion
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
          animatedMarker.marker.alpha = progress * animatedMarker.targetAlpha
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
      animatedMarker.marker.alpha = animatedMarker.targetAlpha
    }
  }

  private fun cancelEnteringAnimation(key: MarkerRenderKey) {
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

  /** Small unclustered datasets: one full diff on the UI thread, no viewport query. */
  private fun applyMarkersSync() {
    googleMap ?: return
    refreshGeneration += 1
    refreshInbox.discardPending()
    cancelIdleRefresh()
    cancelLiveRefresh()
    val target = store?.read { access ->
      materialize(access.aliveHandles().map { MarkerClusterEngine.Element.Single(it) }, access)
    } ?: emptyList()
    applyDiff(computeMarkerRenderDiff(target, markerVersions))
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

  /** Routes a Google Maps marker tap to the marker or cluster callback. */
  fun onMarkerClick(marker: Marker): Boolean {
    return when (val key = marker.tag as? MarkerRenderKey) {
      is MarkerRenderKey.Cluster -> {
        val cluster = clustersById[key.id] ?: return false
        onClusterPress?.invoke(
          NativeClusterPressEvent(
            clusterId = cluster.id,
            count = cluster.count.toDouble(),
            coordinate = Coordinate(
              latitude = cluster.position.latitude,
              longitude = cluster.position.longitude,
            ),
          ),
        )
        googleMap?.animateCamera(
          CameraUpdateFactory.newLatLngBounds(cluster.bounds, (72 * density).toInt()),
        )
        true
      }
      is MarkerRenderKey.Single -> {
        onMarkerPress?.invoke(key.id)
        false
      }
      null -> false
    }
  }

  fun updatePolylines(descriptors: Array<PolylineDescriptor>?) {
    val map = googleMap ?: return
    reconcileShapes(
      current = polylines,
      versions = polylineVersions,
      next = descriptors?.associateBy { it.id } ?: emptyMap(),
      version = { it.renderVersion() },
      remove = { it.remove() },
      add = { descriptor ->
        map.addPolyline(descriptor.toPolylineOptions()).also { polyline ->
          polyline.tag = descriptor.id
        }
      },
      update = { polyline, descriptor -> descriptor.applyTo(polyline) },
    )
  }

  fun updatePolygons(descriptors: Array<PolygonDescriptor>?) {
    val map = googleMap ?: return
    reconcileShapes(
      current = polygons,
      versions = polygonVersions,
      next = descriptors?.associateBy { it.id } ?: emptyMap(),
      version = { it.renderVersion() },
      remove = { it.remove() },
      add = { descriptor ->
        map.addPolygon(descriptor.toPolygonOptions()).also { polygon ->
          polygon.tag = descriptor.id
        }
      },
      update = { polygon, descriptor -> descriptor.applyTo(polygon) },
    )
  }

  fun updateCircles(descriptors: Array<CircleDescriptor>?) {
    val map = googleMap ?: return
    reconcileShapes(
      current = circles,
      versions = circleVersions,
      next = descriptors?.associateBy { it.id } ?: emptyMap(),
      version = { it.renderVersion() },
      remove = { it.remove() },
      add = { descriptor ->
        map.addCircle(descriptor.toCircleOptions()).also { circle ->
          circle.tag = descriptor.id
        }
      },
      update = { circle, descriptor -> descriptor.applyTo(circle) },
    )
  }

  /**
   * Keeps a render version per id: an unchanged descriptor is skipped and a
   * changed one is updated in place instead of being removed and re-added.
   */
  private fun <T, Descriptor> reconcileShapes(
    current: MutableMap<String, T>,
    versions: MutableMap<String, Long>,
    next: Map<String, Descriptor>,
    version: (Descriptor) -> Long,
    remove: (T) -> Unit,
    add: (Descriptor) -> T?,
    update: (T, Descriptor) -> Unit,
  ) {
    for (removedId in current.keys - next.keys) {
      current.remove(removedId)?.let(remove)
      versions.remove(removedId)
    }

    for ((id, descriptor) in next) {
      val nextVersion = version(descriptor)
      val existing = current[id]
      if (existing == null) {
        add(descriptor)?.let { created ->
          current[id] = created
          versions[id] = nextVersion
        }
      } else if (versions[id] != nextVersion) {
        update(existing, descriptor)
        versions[id] = nextVersion
      }
    }
  }

  /**
   * One viewport query, cluster or filter pass, and diff, computed off the UI
   * thread against the store.
   */
  private data class ViewportRefreshRequest(
    val generation: Int,
    val store: MarkerStore,
    val cache: ClusterOctaveCache,
    val datasetGeneration: Long,
    val bounds: LatLngBounds,
    val latitudeSpan: Double,
    val clustering: Boolean,
    val widthPx: Int,
    val heightPx: Int,
    val animateEntering: Boolean,
    val maxAnimatedMarkers: Int,
  )

  /**
   * Coalesces refresh requests between the UI thread (producer) and the
   * compute executor (consumer). At most one compute task is queued at a time;
   * a request posted while one is queued replaces the pending request instead
   * of adding another task, so a long gesture cannot build a backlog of stale
   * work.
   */
  private class RefreshInbox {
    private val lock = Any()
    private var pending: ViewportRefreshRequest? = null
    private var isComputeQueued = false

    /** Returns true when the caller must enqueue a compute task. */
    fun post(request: ViewportRefreshRequest): Boolean {
      return synchronized(lock) {
        pending = request
        if (isComputeQueued) {
          false
        } else {
          isComputeQueued = true
          true
        }
      }
    }

    /** Hands the latest request to the compute task and frees the slot. */
    fun take(): ViewportRefreshRequest? {
      return synchronized(lock) {
        isComputeQueued = false
        val request = pending
        pending = null
        request
      }
    }

    fun discardPending() {
      synchronized(lock) {
        pending = null
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
    val key: MarkerRenderKey,
    val marker: Marker,
    val animation: ResolvedOverlayEnteringAnimation,
    val targetAlpha: Float,
  )
}

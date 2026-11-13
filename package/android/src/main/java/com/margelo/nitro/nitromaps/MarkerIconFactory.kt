package com.margelo.nitro.nitromaps

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.util.LruCache
import com.google.android.gms.maps.model.BitmapDescriptor
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import com.google.android.gms.maps.model.Marker
import java.net.URI
import java.util.WeakHashMap
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/** Builds and caches marker icons from bundled assets or remote URLs. */
internal class MarkerIconFactory(
  private val context: Context,
  private val density: Float,
  private val markerRegistry: () -> Map<String, Marker>,
) {
  private val cache = object : LruCache<String, CachedIcon>(iconCacheBytes()) {
    override fun sizeOf(key: String, value: CachedIcon): Int = value.byteCount
  }
  private val mainHandler = Handler(Looper.getMainLooper())
  private val appliedIconKeys = WeakHashMap<Marker, String>()
  // Size of the image icon each marker shows, kept with the marker so cache eviction cannot lose it.
  private val appliedImageSizes = WeakHashMap<Marker, Pair<Float, Float>>()
  private val pendingIconLoads = WeakHashMap<Marker, PendingIconLoad>()
  private val iconLoadGeneration = WeakHashMap<Marker, Int>()

  private data class PendingIconLoad(
    val iconKey: String,
    var onIconApplied: () -> Unit,
  )

  private class CachedIcon(
    val descriptor: BitmapDescriptor,
    val byteCount: Int,
    val sizePx: Pair<Float, Float>,
  )

  fun applyVisualProps(
    descriptor: MarkerDescriptor,
    marker: Marker,
    key: String,
  ) {
    applyAnchor(descriptor, marker)
    marker.rotation = descriptor.rotation?.toFloat() ?: 0f
    marker.isFlat = descriptor.flat == true
    marker.alpha = descriptor.opacity?.toFloat() ?: 1f
    marker.zIndex = descriptor.zIndex?.toFloat() ?: 0f

    applyIcon(
      marker = marker,
      image = descriptor.image,
      markerColor = descriptor.markerColor,
      isMarkerActive = { isMarkerCurrent(key, marker) },
      onIconApplied = { applyAnchor(descriptor, marker) },
    )
  }

  private fun applyAnchor(
    descriptor: MarkerDescriptor,
    marker: Marker,
  ) {
    val size =
      when {
        // While a replacement loads the old image stays on the map, so the anchor is sized for it.
        descriptor.image != null && showsImage(marker) -> appliedImageSizes[marker] ?: (0f to 0f)
        descriptor.image != null -> explicitDisplaySizePx(descriptor.image) ?: (0f to 0f)
        else -> defaultMarkerDisplaySizePx()
      }
    val (anchorX, anchorY) = descriptor.effectiveGoogleMapsAnchor(size.first, size.second, density)
    marker.setAnchor(anchorX, anchorY)
  }

  private fun isMarkerCurrent(
    key: String,
    marker: Marker,
  ): Boolean = markerRegistry()[key] === marker

  private fun applyIcon(
    marker: Marker,
    image: MarkerImage?,
    markerColor: String?,
    isMarkerActive: () -> Boolean,
    onIconApplied: () -> Unit,
  ) {
    if (image == null) {
      val iconKey = markerColor?.let { "$DEFAULT_ICON_KEY:$it" } ?: DEFAULT_ICON_KEY
      if (isIconApplied(marker, iconKey)) {
        return
      }
      val icon =
        if (markerColor == null) {
          BitmapDescriptorFactory.defaultMarker()
        } else {
          val hsv = FloatArray(3)
          Color.colorToHSV(markerColor.toColorInt(Color.RED), hsv)
          BitmapDescriptorFactory.defaultMarker(hsv[0])
        }
      marker.setIcon(icon)
      setApplied(marker, iconKey)
      onIconApplied()
      return
    }

    val iconKey = cacheKey(image)
    if (isIconApplied(marker, iconKey)) {
      // Back to the shown image: a load still running for another one must not replace it.
      invalidatePendingLoad(marker)
      return
    }

    pendingIconLoads[marker]?.let { pending ->
      if (pending.iconKey == iconKey) {
        pending.onIconApplied = onIconApplied
        return
      }
    }

    cache.get(iconKey)?.let { cached ->
      marker.setIcon(cached.descriptor)
      setApplied(marker, iconKey)
      appliedImageSizes[marker] = cached.sizePx
      onIconApplied()
      return
    }

    // A marker that already shows an image keeps it until the new one is ready, like a cache hit.
    if (!showsImage(marker)) {
      showPlaceholder(marker)
    }
    val generation = beginPendingLoad(marker, iconKey, onIconApplied)
    loadIconAsync(image) { loaded ->
      if (iconLoadGeneration[marker] != generation) {
        return@loadIconAsync
      }

      val callback = pendingIconLoads.remove(marker)?.onIconApplied
      if (!isMarkerActive()) {
        return@loadIconAsync
      }

      if (loaded == null) {
        // The load logged why. The placeholder key makes the next apply retry the load.
        showPlaceholder(marker)
        return@loadIconAsync
      }

      marker.setIcon(loaded.descriptor)
      setApplied(marker, iconKey)
      appliedImageSizes[marker] = loaded.sizePx
      callback?.invoke()
    }
  }

  private fun showsImage(marker: Marker): Boolean {
    val key = appliedIconKeys[marker] ?: return false
    return key != PLACEHOLDER_ICON_KEY && !key.startsWith(DEFAULT_ICON_KEY)
  }

  private fun showPlaceholder(marker: Marker) {
    marker.setIcon(placeholderMarkerIcon)
    appliedIconKeys[marker] = PLACEHOLDER_ICON_KEY
  }

  private fun explicitDisplaySizePx(image: MarkerImage): Pair<Float, Float>? {
    val widthDp = image.width ?: return null
    val heightDp = image.height ?: return null
    return (widthDp * density).toFloat() to (heightDp * density).toFloat()
  }

  private fun defaultMarkerDisplaySizePx(): Pair<Float, Float> = (DEFAULT_MARKER_WIDTH_DP * density) to (DEFAULT_MARKER_HEIGHT_DP * density)

  private fun cacheKey(image: MarkerImage): String {
    // `origin` is part of the key so a bundled image cannot warm the cache for a
    // user-supplied one with the same URI, which would hand it a policy-free entry.
    return "${image.uri}|${image.width ?: ""}|${image.height ?: ""}|${image.scale ?: ""}|${image.origin ?: ""}"
  }

  private fun loadLocalIcon(
    image: MarkerImage,
    key: String,
  ): CachedIcon? {
    val bitmap = loadLocalBitmap(image)
    if (bitmap == null) {
      logLoadFailure(image, key, "not found or not decodable")
      return null
    }
    return cacheBitmap(key, bitmap)
  }

  private fun loadIconAsync(
    image: MarkerImage,
    onLoaded: (CachedIcon?) -> Unit,
  ) {
    val key = cacheKey(image)
    cache.get(key)?.let { cached ->
      deliverOnMainThread { onLoaded(cached) }
      return
    }

    if (RemoteMarkerUriPolicy.isRemoteUri(image.uri)) {
      RemoteMarkerUriPolicy.rejectReason(image, resolveHostAddress = false)?.let { reason ->
        logRejectedRemoteMarkerUri(image.uri, reason)
        deliverOnMainThread { onLoaded(null) }
        return
      }
    }

    loadExecutor.execute {
      val icon =
        if (RemoteMarkerUriPolicy.isRemoteUri(image.uri)) {
          loadRemoteIcon(image, key)
        } else {
          loadLocalIcon(image, key)
        }
      deliverOnMainThread { onLoaded(icon) }
    }
  }

  private fun isIconApplied(
    marker: Marker,
    key: String,
  ): Boolean = appliedIconKeys[marker] == key

  private fun setApplied(
    marker: Marker,
    key: String,
  ) {
    appliedIconKeys[marker] = key
    invalidatePendingLoad(marker)
  }

  private fun invalidatePendingLoad(marker: Marker) {
    iconLoadGeneration[marker] = (iconLoadGeneration[marker] ?: 0) + 1
    pendingIconLoads.remove(marker)
  }

  private fun beginPendingLoad(
    marker: Marker,
    iconKey: String,
    onIconApplied: () -> Unit,
  ): Int {
    invalidatePendingLoad(marker)
    val generation = iconLoadGeneration[marker]!!
    pendingIconLoads[marker] = PendingIconLoad(iconKey, onIconApplied)
    return generation
  }

  private fun deliverOnMainThread(block: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) {
      block()
    } else {
      mainHandler.post(block)
    }
  }

  private fun loadRemoteIcon(
    image: MarkerImage,
    key: String,
  ): CachedIcon? {
    return try {
      val bytes = remoteImageFetcher.fetch(image, ::logRejectedRemoteMarkerUri) ?: return null
      val bitmap = decodeByteArray(bytes, image)
      if (bitmap == null) {
        logLoadFailure(image, key, "not decodable")
        return null
      }
      cacheBitmap(key, bitmap)
    } catch (error: Exception) {
      // Not the exception itself: its message can carry the full URL.
      logLoadFailure(image, key, "request failed: ${error.javaClass.simpleName}")
      null
    }
  }

  private fun loadLocalBitmap(image: MarkerImage): Bitmap? {
    val uri = image.uri

    if (uri.startsWith("file://")) {
      val path = uri.removePrefix("file://")
      return decodeFile(path, image)
    }

    if (uri.startsWith("/")) {
      return decodeFile(uri, image)
    }

    if (RemoteMarkerUriPolicy.isRemoteUri(uri)) {
      return null
    }

    val resourceName = uri.substringAfterLast('/').substringBeforeLast('.')
    val resourceId = context.resources.getIdentifier(resourceName, "drawable", context.packageName)
    if (resourceId != 0) {
      return decodeResource(resourceId, image)
    }

    return try {
      context.assets.open(uri).use { stream -> decodeByteArray(stream.readBytes(), image) }
    } catch (_: Exception) {
      null
    }
  }

  private fun decodeFile(
    path: String,
    image: MarkerImage,
  ): Bitmap? = decodeSized(image) { options -> BitmapFactory.decodeFile(path, options) }

  private fun decodeResource(
    resourceId: Int,
    image: MarkerImage,
  ): Bitmap? = decodeSized(image) { options -> BitmapFactory.decodeResource(context.resources, resourceId, options) }

  private fun decodeByteArray(
    bytes: ByteArray,
    image: MarkerImage,
  ): Bitmap? {
    if (bytes.isEmpty()) {
      return null
    }
    return decodeSized(image) { options -> BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options) }
  }

  /**
   * Decodes through [decode] at the size [image] is drawn at. The size comes from the source's
   * bounds, not the decoded bitmap, which `inSampleSize` may have shrunk.
   */
  private inline fun decodeSized(
    image: MarkerImage,
    decode: (BitmapFactory.Options) -> Bitmap?,
  ): Bitmap? {
    val bounds =
      BitmapFactory.Options().apply {
        inJustDecodeBounds = true
        inScaled = false
      }
    decode(bounds)
    val sourceWidth = bounds.outWidth
    val sourceHeight = bounds.outHeight
    if (sourceWidth <= 0 || sourceHeight <= 0) {
      return null
    }
    val target =
      image
        .displaySizePx(sourceWidth, sourceHeight, density)
        ?.boundedTo(MAX_DECODE_DIMENSION, MAX_DECODE_PIXELS)
    val options =
      BitmapFactory.Options().apply {
        inSampleSize =
          computeInSampleSize(
            sourceWidth = sourceWidth,
            sourceHeight = sourceHeight,
            reqWidth = target?.first,
            reqHeight = target?.second,
          )
        inScaled = false
      }
    val decoded = decode(options) ?: return null
    return resizeBitmap(decoded, target)
  }

  private fun computeInSampleSize(
    sourceWidth: Int,
    sourceHeight: Int,
    reqWidth: Int?,
    reqHeight: Int?,
  ): Int {
    var sampleSize = 1

    if (reqWidth != null && reqHeight != null) {
      var halfWidth = sourceWidth / 2
      var halfHeight = sourceHeight / 2
      while (halfWidth / sampleSize >= reqWidth && halfHeight / sampleSize >= reqHeight) {
        sampleSize *= 2
      }
    }

    while (decodedPixelCount(sourceWidth, sourceHeight, sampleSize) > MAX_DECODE_PIXELS) {
      sampleSize *= 2
    }

    while (maxOf(sourceWidth / sampleSize, sourceHeight / sampleSize) > MAX_DECODE_DIMENSION) {
      sampleSize *= 2
    }

    return sampleSize
  }

  private fun decodedPixelCount(
    sourceWidth: Int,
    sourceHeight: Int,
    sampleSize: Int,
  ): Long {
    val width = sourceWidth / sampleSize
    val height = sourceHeight / sampleSize
    return width.toLong() * height
  }

  private fun cacheBitmap(
    key: String,
    bitmap: Bitmap,
  ): CachedIcon {
    val icon =
      CachedIcon(
        descriptor = BitmapDescriptorFactory.fromBitmap(bitmap),
        byteCount = bitmap.allocationByteCount.coerceAtLeast(1),
        sizePx = bitmap.width.toFloat() to bitmap.height.toFloat(),
      )
    cache.put(key, icon)
    return icon
  }

  private fun logRejectedRemoteMarkerUri(
    uri: String,
    reason: String,
  ) {
    Log.w(NITRO_MAPS_LOG_TAG, "Rejected remote marker image URI ($reason): ${loggableUri(uri)}")
  }

  /** Once per image: a failed load is not cached, so every re-render retries it. */
  private fun logLoadFailure(
    image: MarkerImage,
    key: String,
    reason: String,
  ) {
    // Bounded: URIs that differ per request would otherwise grow it forever.
    if (loggedFailureKeys.size >= MAX_LOGGED_FAILURE_KEYS) {
      loggedFailureKeys.clear()
    }
    if (loggedFailureKeys.add(key)) {
      Log.w(NITRO_MAPS_LOG_TAG, "Failed to load marker image ($reason): ${loggableUri(image.uri)}")
    }
  }

  private fun resizeBitmap(
    source: Bitmap,
    target: Pair<Int, Int>?,
  ): Bitmap {
    val (targetWidth, targetHeight) = target ?: return source

    if (source.width == targetWidth && source.height == targetHeight) {
      return source
    }

    return Bitmap.createScaledBitmap(source, targetWidth, targetHeight, true)
  }

  private companion object {
    const val DEFAULT_ICON_KEY = "__default__"
    const val PLACEHOLDER_ICON_KEY = "__placeholder__"
    private const val DEFAULT_MARKER_WIDTH_DP = 40f
    private const val DEFAULT_MARKER_HEIGHT_DP = 52f
    private const val MAX_DECODE_DIMENSION = 2048
    private const val MAX_LOGGED_FAILURE_KEYS = 256
    private const val MAX_DECODE_PIXELS = 2048L * 2048L
    private const val MIN_ICON_CACHE_BYTES = 1024 * 1024
    private const val MAX_ICON_CACHE_BYTES = 32 * 1024 * 1024

    /** Icon cache budget in decoded bytes: a slice of the heap, capped well below it. */
    private fun iconCacheBytes(): Int {
      val budget = Runtime.getRuntime().maxMemory() / 16
      return budget
        .coerceIn(MIN_ICON_CACHE_BYTES.toLong(), MAX_ICON_CACHE_BYTES.toLong())
        .toInt()
    }

    private val loadExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private val loggedFailureKeys: MutableSet<String> = ConcurrentHashMap.newKeySet()

    /** Without the query string and credentials, which can carry a signed token or a password. */
    private fun loggableUri(uri: String): String =
      try {
        val parsed = URI(uri)
        URI(parsed.scheme, null, parsed.host, parsed.port, parsed.path, null, null).toString()
      } catch (_: Exception) {
        "<unparseable URI>"
      }

    // Shared by every map, and first built on the load executor: an HTTP client loads the system
    // trust store when it is created.
    private val remoteImageFetcher by lazy { RemoteMarkerImageFetcher() }
  }
}

/**
 * Shown while a marker's first image loads, or after it failed: a marker without an icon is the
 * default pin. Built on first use, once the Maps SDK is initialized.
 */
internal val placeholderMarkerIcon: BitmapDescriptor by lazy {
  BitmapDescriptorFactory.fromBitmap(Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888))
}

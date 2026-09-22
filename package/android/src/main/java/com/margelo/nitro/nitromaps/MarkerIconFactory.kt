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
import java.net.URL
import java.util.WeakHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/** Builds and caches marker icons from bundled assets or remote URLs. */
internal class MarkerIconFactory(
  private val context: Context,
  private val density: Float,
  private val markerRegistry: () -> Map<String, Marker>,
) {
  private val cache = object : LruCache<String, BitmapDescriptor>(64) {}
  private val sizeCache = object : LruCache<String, Pair<Float, Float>>(64) {}
  private val mainHandler = Handler(Looper.getMainLooper())
  private val appliedIconKeys = WeakHashMap<Marker, String>()
  private val pendingIconLoads = WeakHashMap<Marker, PendingIconLoad>()
  private val iconLoadGeneration = WeakHashMap<Marker, Int>()

  private data class PendingIconLoad(
    val iconKey: String,
    var onIconApplied: () -> Unit,
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
      if (descriptor.image != null) {
        displaySizePx(descriptor.image) ?: (0f to 0f)
      } else {
        defaultMarkerDisplaySizePx()
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
      return
    }

    pendingIconLoads[marker]?.let { pending ->
      if (pending.iconKey == iconKey) {
        pending.onIconApplied = onIconApplied
        return
      }
    }

    cache.get(iconKey)?.let { cached ->
      marker.setIcon(cached)
      setApplied(marker, iconKey)
      onIconApplied()
      return
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
        return@loadIconAsync
      }

      marker.setIcon(loaded)
      setApplied(marker, iconKey)
      callback?.invoke()
    }
  }

  private fun displaySizePx(image: MarkerImage): Pair<Float, Float>? {
    val key = cacheKey(image)
    sizeCache.get(key)?.let { return it }

    val widthDp = image.width
    val heightDp = image.height
    if (widthDp != null && heightDp != null) {
      val size = (widthDp * density).toFloat() to (heightDp * density).toFloat()
      sizeCache.put(key, size)
      return size
    }

    return null
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
  ): BitmapDescriptor? {
    val bitmap = loadLocalBitmap(image) ?: return null
    return cacheBitmap(key, bitmap)
  }

  private fun loadIconAsync(
    image: MarkerImage,
    onLoaded: (BitmapDescriptor?) -> Unit,
  ) {
    val key = cacheKey(image)
    cache.get(key)?.let {
      deliverOnMainThread { onLoaded(it) }
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
      val descriptor =
        if (RemoteMarkerUriPolicy.isRemoteUri(image.uri)) {
          loadRemoteIcon(image, key)
        } else {
          loadLocalIcon(image, key)
        }
      deliverOnMainThread { onLoaded(descriptor) }
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
  ): BitmapDescriptor? {
    RemoteMarkerUriPolicy.rejectReason(image, resolveHostAddress = true)?.let { reason ->
      logRejectedRemoteMarkerUri(image.uri, reason)
      return null
    }

    return try {
      val connection = URL(image.uri).openConnection()
      connection.connectTimeout = 10_000
      connection.readTimeout = 10_000
      connection.getInputStream().use { stream ->
        val bitmap = decodeByteArray(stream.readBytes(), image) ?: return null
        cacheBitmap(key, resizeBitmap(bitmap, image))
      }
    } catch (error: Exception) {
      Log.w(NITRO_MAPS_LOG_TAG, "Failed to load marker image: ${image.uri}", error)
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
      context.assets.open(uri).use { stream ->
        decodeByteArray(stream.readBytes(), image)?.let { resizeBitmap(it, image) }
      }
    } catch (_: Exception) {
      null
    }
  }

  private fun decodeFile(
    path: String,
    image: MarkerImage,
  ): Bitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(path, bounds)
    val options = buildDecodeOptions(bounds.outWidth, bounds.outHeight, image) ?: return null
    val decoded = BitmapFactory.decodeFile(path, options) ?: return null
    return resizeBitmap(decoded, image)
  }

  private fun decodeResource(
    resourceId: Int,
    image: MarkerImage,
  ): Bitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeResource(context.resources, resourceId, bounds)
    val options = buildDecodeOptions(bounds.outWidth, bounds.outHeight, image) ?: return null
    val decoded = BitmapFactory.decodeResource(context.resources, resourceId, options) ?: return null
    return resizeBitmap(decoded, image)
  }

  private fun decodeByteArray(
    bytes: ByteArray,
    image: MarkerImage,
  ): Bitmap? {
    if (bytes.isEmpty()) {
      return null
    }
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    val options = buildDecodeOptions(bounds.outWidth, bounds.outHeight, image) ?: return null
    return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
  }

  private fun targetDecodeSizePx(image: MarkerImage): Pair<Int, Int>? {
    val widthDp = image.width ?: return null
    val heightDp = image.height ?: return null
    return (widthDp * density).toInt().coerceAtLeast(1) to (heightDp * density).toInt().coerceAtLeast(1)
  }

  private fun buildDecodeOptions(
    sourceWidth: Int,
    sourceHeight: Int,
    image: MarkerImage,
  ): BitmapFactory.Options? {
    if (sourceWidth <= 0 || sourceHeight <= 0) {
      return null
    }
    val target = targetDecodeSizePx(image)
    val sampleSize =
      computeInSampleSize(
        sourceWidth = sourceWidth,
        sourceHeight = sourceHeight,
        reqWidth = target?.first,
        reqHeight = target?.second,
      )
    return BitmapFactory.Options().apply {
      inSampleSize = sampleSize
      inScaled = false
    }
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
  ): BitmapDescriptor {
    val descriptor = BitmapDescriptorFactory.fromBitmap(bitmap)
    cache.put(key, descriptor)
    sizeCache.put(key, bitmap.width.toFloat() to bitmap.height.toFloat())
    return descriptor
  }

  private fun logRejectedRemoteMarkerUri(
    uri: String,
    reason: String,
  ) {
    Log.w(NITRO_MAPS_LOG_TAG, "Rejected remote marker image URI ($reason): $uri")
  }

  private fun resizeBitmap(
    source: Bitmap,
    image: MarkerImage,
  ): Bitmap {
    val width = image.width ?: return source
    val height = image.height ?: return source
    val targetWidth = (width * density).toInt().coerceAtLeast(1)
    val targetHeight = (height * density).toInt().coerceAtLeast(1)

    if (source.width == targetWidth && source.height == targetHeight) {
      return source
    }

    return Bitmap.createScaledBitmap(source, targetWidth, targetHeight, true)
  }

  private companion object {
    const val DEFAULT_ICON_KEY = "__default__"
    private const val DEFAULT_MARKER_WIDTH_DP = 40f
    private const val DEFAULT_MARKER_HEIGHT_DP = 52f
    private const val MAX_DECODE_DIMENSION = 2048
    private const val MAX_DECODE_PIXELS = 2048L * 2048L

    private val loadExecutor: ExecutorService = Executors.newSingleThreadExecutor()
  }
}

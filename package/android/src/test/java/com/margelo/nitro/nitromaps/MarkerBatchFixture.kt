package com.margelo.nitro.nitromaps

import java.nio.ByteBuffer
import java.nio.ByteOrder

/** Builds packed batches the way `markerBatch.ts` does, for decoder and store tests. */
internal class MarkerBatchBuilder {
  private class Upsert(
    val handle: Int,
    val id: String,
    val latitude: Double,
    val longitude: Double,
    val title: String?,
    val subtitle: String?,
    val imageUri: String?,
    val imageWidth: Float,
    val imageHeight: Float,
    val imageScale: Float,
    val anchor: Pair<Float, Float>?,
    val centerOffset: Pair<Float, Float>?,
    val rotation: Float,
    val opacity: Float,
    val draggable: Boolean,
    val clusterable: Boolean,
    val flat: Boolean,
    val animationKind: Int,
    val animationDuration: Float,
    val animationDelay: Float,
    val animationReduceMotion: Int,
    val markerColor: String?,
    val zIndex: Float,
  )

  private val upserts = ArrayList<Upsert>()
  private val removes = ArrayList<Int>()
  private val positions = ArrayList<Triple<Int, Double, Double>>()
  private val strings = ArrayList<String>()
  private val stringIndices = HashMap<String, Int>()

  fun upsert(
    handle: Int,
    id: String,
    latitude: Double,
    longitude: Double,
    title: String? = null,
    subtitle: String? = null,
    imageUri: String? = null,
    imageWidth: Float = Float.NaN,
    imageHeight: Float = Float.NaN,
    imageScale: Float = Float.NaN,
    anchor: Pair<Float, Float>? = null,
    centerOffset: Pair<Float, Float>? = null,
    rotation: Float = Float.NaN,
    opacity: Float = Float.NaN,
    draggable: Boolean = false,
    clusterable: Boolean = true,
    flat: Boolean = false,
    animationKind: Int = 0,
    animationDuration: Float = Float.NaN,
    animationDelay: Float = Float.NaN,
    animationReduceMotion: Int = 0,
    markerColor: String? = null,
    zIndex: Float = Float.NaN,
  ): MarkerBatchBuilder {
    upserts.add(
      Upsert(
        handle, id, latitude, longitude, title, subtitle, imageUri, imageWidth, imageHeight, imageScale,
        anchor, centerOffset, rotation, opacity, draggable, clusterable, flat,
        animationKind, animationDuration, animationDelay, animationReduceMotion,
        markerColor, zIndex,
      ),
    )
    return this
  }

  fun remove(handle: Int): MarkerBatchBuilder {
    removes.add(handle)
    return this
  }

  fun position(handle: Int, latitude: Double, longitude: Double): MarkerBatchBuilder {
    positions.add(Triple(handle, latitude, longitude))
    return this
  }

  fun strings(): Array<String> = strings.toTypedArray()

  fun bytes(): ByteArray {
    val total = MarkerBatchLayout.HEADER_BYTES +
      upserts.size * MarkerBatchLayout.UPSERT_BYTES +
      removes.size * MarkerBatchLayout.REMOVE_BYTES +
      positions.size * MarkerBatchLayout.POSITION_BYTES
    val buffer = ByteBuffer.allocate(total).order(ByteOrder.LITTLE_ENDIAN)
    buffer.putInt(0, MarkerBatchLayout.MAGIC)
    buffer.putInt(4, upserts.size)
    buffer.putInt(8, removes.size)
    buffer.putInt(12, positions.size)

    var offset = MarkerBatchLayout.HEADER_BYTES
    for (upsert in upserts) {
      writeUpsert(buffer, offset, upsert)
      offset += MarkerBatchLayout.UPSERT_BYTES
    }
    for (handle in removes) {
      buffer.putInt(offset, handle)
      offset += MarkerBatchLayout.REMOVE_BYTES
    }
    for ((handle, latitude, longitude) in positions) {
      buffer.putInt(offset, handle)
      buffer.putInt(offset + 4, 0)
      buffer.putDouble(offset + 8, latitude)
      buffer.putDouble(offset + 16, longitude)
      offset += MarkerBatchLayout.POSITION_BYTES
    }
    return buffer.array()
  }

  private fun writeUpsert(buffer: ByteBuffer, base: Int, upsert: Upsert) {
    var flags = 0
    if (upsert.anchor != null) flags = flags or MarkerBatchLayout.HAS_ANCHOR
    if (upsert.centerOffset != null) flags = flags or MarkerBatchLayout.HAS_CENTER_OFFSET
    if (upsert.draggable) flags = flags or MarkerBatchLayout.DRAGGABLE
    if (upsert.clusterable) flags = flags or MarkerBatchLayout.CLUSTERABLE
    if (upsert.flat) flags = flags or MarkerBatchLayout.FLAT

    val field = MarkerBatchLayout.Upsert
    buffer.putInt(base + field.HANDLE, upsert.handle)
    buffer.putInt(base + field.FLAGS, flags)
    buffer.putInt(base + field.ID, intern(upsert.id))
    buffer.putInt(base + field.TITLE, internOptional(upsert.title))
    buffer.putInt(base + field.SUBTITLE, internOptional(upsert.subtitle))
    buffer.putInt(base + field.IMAGE_URI, internOptional(upsert.imageUri))
    buffer.putDouble(base + field.LATITUDE, upsert.latitude)
    buffer.putDouble(base + field.LONGITUDE, upsert.longitude)
    buffer.putFloat(base + field.IMAGE_WIDTH, upsert.imageWidth)
    buffer.putFloat(base + field.IMAGE_HEIGHT, upsert.imageHeight)
    buffer.putFloat(base + field.IMAGE_SCALE, upsert.imageScale)
    buffer.putFloat(base + field.ANCHOR_X, upsert.anchor?.first ?: 0f)
    buffer.putFloat(base + field.ANCHOR_Y, upsert.anchor?.second ?: 0f)
    buffer.putFloat(base + field.CENTER_OFFSET_X, upsert.centerOffset?.first ?: 0f)
    buffer.putFloat(base + field.CENTER_OFFSET_Y, upsert.centerOffset?.second ?: 0f)
    buffer.putFloat(base + field.ROTATION, upsert.rotation)
    buffer.putFloat(base + field.OPACITY, upsert.opacity)
    buffer.putFloat(base + field.ANIMATION_DURATION, upsert.animationDuration)
    buffer.putFloat(base + field.ANIMATION_DELAY, upsert.animationDelay)
    buffer.put(base + field.ANIMATION_KIND, upsert.animationKind.toByte())
    buffer.put(base + field.ANIMATION_REDUCE_MOTION, upsert.animationReduceMotion.toByte())
    buffer.putInt(base + field.MARKER_COLOR, internOptional(upsert.markerColor))
    buffer.putFloat(base + field.Z_INDEX, upsert.zIndex)
  }

  private fun intern(value: String): Int {
    return stringIndices.getOrPut(value) {
      strings.add(value)
      strings.size - 1
    }
  }

  private fun internOptional(value: String?): Int =
    if (value == null) MarkerBatchLayout.NO_STRING else intern(value)
}

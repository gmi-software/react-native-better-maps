package com.margelo.nitro.nitromaps

import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Layout of the packed batches `MarkerCollection` sends from JS. The format is
 * documented in `src/markers/markerBatch.ts`; keep both sides in sync.
 */
internal object MarkerBatchLayout {
  const val MAGIC = 0x4E4D4B31
  const val HEADER_BYTES = 16
  const val UPSERT_BYTES = 96
  const val REMOVE_BYTES = 4
  const val POSITION_BYTES = 24
  const val NO_STRING = -1

  const val HAS_ANCHOR = 1 shl 0
  const val HAS_CENTER_OFFSET = 1 shl 1
  const val DRAGGABLE = 1 shl 16
  const val CLUSTERABLE = 1 shl 17
  const val FLAT = 1 shl 18

  object Upsert {
    const val HANDLE = 0
    const val FLAGS = 4
    const val ID = 8
    const val TITLE = 12
    const val SUBTITLE = 16
    const val IMAGE_URI = 20
    const val LATITUDE = 24
    const val LONGITUDE = 32
    const val IMAGE_WIDTH = 40
    const val IMAGE_HEIGHT = 44
    const val IMAGE_SCALE = 48
    const val ANCHOR_X = 52
    const val ANCHOR_Y = 56
    const val CENTER_OFFSET_X = 60
    const val CENTER_OFFSET_Y = 64
    const val ROTATION = 68
    const val OPACITY = 72
    const val ANIMATION_DURATION = 76
    const val ANIMATION_DELAY = 80
    const val ANIMATION_KIND = 84
    const val ANIMATION_REDUCE_MOTION = 85
  }
}

internal class MarkerBatchHeader(
  val upsertCount: Int,
  val removeCount: Int,
  val positionCount: Int,
) {
  /** In `Long`: the counts are untrusted and their products overflow `Int`. */
  val totalBytes: Long
    get() = MarkerBatchLayout.HEADER_BYTES.toLong() +
      upsertCount.toLong() * MarkerBatchLayout.UPSERT_BYTES +
      removeCount.toLong() * MarkerBatchLayout.REMOVE_BYTES +
      positionCount.toLong() * MarkerBatchLayout.POSITION_BYTES
}

class MalformedMarkerBatchException(message: String) : IllegalArgumentException(message)

internal object MarkerBatchDecoder {
  /** Wraps a copy of a batch for decoding. */
  fun wrap(bytes: ByteArray): ByteBuffer = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)

  /**
   * Validates the magic and the total length. Cheap enough to run on the JS
   * thread before the bytes are copied off it.
   */
  fun readHeader(buffer: ByteBuffer): MarkerBatchHeader {
    if (buffer.limit() < MarkerBatchLayout.HEADER_BYTES) {
      throw MalformedMarkerBatchException("Marker batch is shorter than its header")
    }
    if (buffer.getInt(0) != MarkerBatchLayout.MAGIC) {
      throw MalformedMarkerBatchException("Not a marker batch")
    }

    val header = MarkerBatchHeader(
      upsertCount = buffer.getInt(4),
      removeCount = buffer.getInt(8),
      positionCount = buffer.getInt(12),
    )
    if (header.upsertCount < 0 || header.removeCount < 0 || header.positionCount < 0 ||
      header.totalBytes != buffer.limit().toLong()
    ) {
      throw MalformedMarkerBatchException(
        "Marker batch is ${buffer.limit()} bytes, expected ${header.totalBytes}",
      )
    }
    return header
  }

  /**
   * Walks every record: removals first, then upserts, then positions, so a
   * handle freed in this batch can be reused by an upsert in the same batch.
   */
  fun decode(
    buffer: ByteBuffer,
    strings: Array<String>,
    onRemove: (Int) -> Unit,
    onUpsert: (Int, MarkerDescriptor) -> Unit,
    onPosition: (Int, Double, Double) -> Unit,
  ) {
    val header = readHeader(buffer)
    val upsertsStart = MarkerBatchLayout.HEADER_BYTES
    val removesStart = upsertsStart + header.upsertCount * MarkerBatchLayout.UPSERT_BYTES
    val positionsStart = removesStart + header.removeCount * MarkerBatchLayout.REMOVE_BYTES

    for (index in 0 until header.removeCount) {
      onRemove(buffer.getInt(removesStart + index * MarkerBatchLayout.REMOVE_BYTES))
    }

    for (index in 0 until header.upsertCount) {
      val base = upsertsStart + index * MarkerBatchLayout.UPSERT_BYTES
      val descriptor = descriptorAt(base, buffer, strings) ?: continue
      onUpsert(buffer.getInt(base + MarkerBatchLayout.Upsert.HANDLE), descriptor)
    }

    for (index in 0 until header.positionCount) {
      val base = positionsStart + index * MarkerBatchLayout.POSITION_BYTES
      onPosition(buffer.getInt(base), buffer.getDouble(base + 8), buffer.getDouble(base + 16))
    }
  }

  private fun descriptorAt(base: Int, buffer: ByteBuffer, strings: Array<String>): MarkerDescriptor? {
    val id = stringAt(strings, buffer.getInt(base + MarkerBatchLayout.Upsert.ID)) ?: return null
    val flags = buffer.getInt(base + MarkerBatchLayout.Upsert.FLAGS)

    val imageUri = stringAt(strings, buffer.getInt(base + MarkerBatchLayout.Upsert.IMAGE_URI))
    val image = imageUri?.let {
      MarkerImage(
        uri = it,
        width = buffer.optionalFloat(base + MarkerBatchLayout.Upsert.IMAGE_WIDTH),
        height = buffer.optionalFloat(base + MarkerBatchLayout.Upsert.IMAGE_HEIGHT),
        scale = buffer.optionalFloat(base + MarkerBatchLayout.Upsert.IMAGE_SCALE),
      )
    }

    val anchor = if (flags and MarkerBatchLayout.HAS_ANCHOR != 0) {
      MarkerAnchor(
        x = buffer.getFloat(base + MarkerBatchLayout.Upsert.ANCHOR_X).toDouble(),
        y = buffer.getFloat(base + MarkerBatchLayout.Upsert.ANCHOR_Y).toDouble(),
      )
    } else {
      null
    }

    val centerOffset = if (flags and MarkerBatchLayout.HAS_CENTER_OFFSET != 0) {
      MarkerPoint(
        x = buffer.getFloat(base + MarkerBatchLayout.Upsert.CENTER_OFFSET_X).toDouble(),
        y = buffer.getFloat(base + MarkerBatchLayout.Upsert.CENTER_OFFSET_Y).toDouble(),
      )
    } else {
      null
    }

    val enteringAnimation = animationKind(buffer.get(base + MarkerBatchLayout.Upsert.ANIMATION_KIND))?.let { kind ->
      OverlayEnteringAnimationDescriptor(
        kind = kind,
        duration = buffer.optionalFloat(base + MarkerBatchLayout.Upsert.ANIMATION_DURATION),
        delay = buffer.optionalFloat(base + MarkerBatchLayout.Upsert.ANIMATION_DELAY),
        reduceMotion = reduceMotion(buffer.get(base + MarkerBatchLayout.Upsert.ANIMATION_REDUCE_MOTION)),
      )
    }

    return MarkerDescriptor(
      id = id,
      coordinate = Coordinate(
        latitude = buffer.getDouble(base + MarkerBatchLayout.Upsert.LATITUDE),
        longitude = buffer.getDouble(base + MarkerBatchLayout.Upsert.LONGITUDE),
      ),
      title = stringAt(strings, buffer.getInt(base + MarkerBatchLayout.Upsert.TITLE)),
      subtitle = stringAt(strings, buffer.getInt(base + MarkerBatchLayout.Upsert.SUBTITLE)),
      draggable = if (flags and MarkerBatchLayout.DRAGGABLE != 0) true else null,
      clusterable = if (flags and MarkerBatchLayout.CLUSTERABLE != 0) null else false,
      image = image,
      anchor = anchor,
      centerOffset = centerOffset,
      rotation = buffer.optionalFloat(base + MarkerBatchLayout.Upsert.ROTATION),
      flat = if (flags and MarkerBatchLayout.FLAT != 0) true else null,
      opacity = buffer.optionalFloat(base + MarkerBatchLayout.Upsert.OPACITY),
      enteringAnimation = enteringAnimation,
    )
  }

  private fun stringAt(strings: Array<String>, index: Int): String? {
    return if (index < 0 || index >= strings.size) null else strings[index]
  }

  private fun animationKind(code: Byte): OverlayEnteringAnimationKind? = when (code.toInt()) {
    1 -> OverlayEnteringAnimationKind.NONE
    2 -> OverlayEnteringAnimationKind.SYSTEM
    3 -> OverlayEnteringAnimationKind.FADE
    4 -> OverlayEnteringAnimationKind.FADE_SCALE
    else -> null
  }

  private fun reduceMotion(code: Byte): OverlayEnteringAnimationReduceMotion? = when (code.toInt()) {
    1 -> OverlayEnteringAnimationReduceMotion.SYSTEM
    2 -> OverlayEnteringAnimationReduceMotion.NEVER
    else -> null
  }

  /** `NaN` marks an absent optional float. */
  private fun ByteBuffer.optionalFloat(offset: Int): Double? {
    val value = getFloat(offset)
    return if (value.isNaN()) null else value.toDouble()
  }
}

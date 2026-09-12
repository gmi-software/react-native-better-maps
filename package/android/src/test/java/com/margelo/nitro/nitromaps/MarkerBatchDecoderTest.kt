package com.margelo.nitro.nitromaps

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class MarkerBatchDecoderTest {
  @Test
  fun `decodes the marker colour and z-index`() {
    val builder = MarkerBatchBuilder()
      .upsert(handle = 1, id = "tinted", latitude = 1.0, longitude = 2.0, markerColor = "#FF9500", zIndex = 3f)
      .upsert(handle = 2, id = "plain", latitude = 1.0, longitude = 2.0)
    val decoded = ArrayList<MarkerDescriptor>()
    MarkerBatchDecoder.decode(
      MarkerBatchDecoder.wrap(builder.bytes()),
      builder.strings(),
      onRemove = {},
      onUpsert = { _, descriptor -> decoded.add(descriptor) },
      onPosition = { _, _, _ -> },
    )

    assertEquals("#FF9500", decoded[0].markerColor)
    assertEquals(3.0, decoded[0].zIndex)
    assertNull(decoded[1].markerColor)
    assertNull(decoded[1].zIndex)
  }

  @Test
  fun `a header whose byte count overflows Int is rejected`() {
    // 44739243 * 96 wraps to 32 in Int arithmetic, which would make a 48-byte
    // batch pass the length check with 44.7 million declared upserts.
    val bytes = ByteArray(48)
    java.nio.ByteBuffer.wrap(bytes).order(java.nio.ByteOrder.LITTLE_ENDIAN)
      .putInt(0, MarkerBatchLayout.MAGIC)
      .putInt(4, 44_739_243)
      .putInt(8, 0)
      .putInt(12, 0)

    assertThrows(MalformedMarkerBatchException::class.java) {
      MarkerBatchDecoder.readHeader(MarkerBatchDecoder.wrap(bytes))
    }
  }

  private fun decodeAll(builder: MarkerBatchBuilder): List<String> {
    val events = ArrayList<String>()
    MarkerBatchDecoder.decode(
      MarkerBatchDecoder.wrap(builder.bytes()),
      builder.strings(),
      onRemove = { events.add("remove $it") },
      onUpsert = { handle, descriptor -> events.add("upsert $handle ${descriptor.id}") },
      onPosition = { handle, lat, lon -> events.add("position $handle $lat $lon") },
    )
    return events
  }

  @Test
  fun `decodes every field of a full record`() {
    val builder = MarkerBatchBuilder().upsert(
      handle = 7,
      id = "full",
      latitude = 52.2297,
      longitude = 21.0122,
      title = "Warsaw",
      subtitle = "Capital",
      imageUri = "https://example.com/pin.png",
      imageWidth = 32f,
      imageHeight = 40f,
      imageScale = 2f,
      anchor = 0.5f to 1f,
      centerOffset = 4f to -8f,
      rotation = 45f,
      opacity = 0.75f,
      draggable = true,
      clusterable = false,
      flat = true,
      animationKind = 4,
      animationDuration = 180f,
      animationDelay = 20f,
      animationReduceMotion = 2,
    )

    var decoded: MarkerDescriptor? = null
    MarkerBatchDecoder.decode(
      MarkerBatchDecoder.wrap(builder.bytes()),
      builder.strings(),
      onRemove = {},
      onUpsert = { _, descriptor -> decoded = descriptor },
      onPosition = { _, _, _ -> },
    )

    val descriptor = requireNotNull(decoded)
    assertEquals("full", descriptor.id)
    assertEquals(52.2297, descriptor.coordinate.latitude, 0.0)
    assertEquals(21.0122, descriptor.coordinate.longitude, 0.0)
    assertEquals("Warsaw", descriptor.title)
    assertEquals("Capital", descriptor.subtitle)
    assertEquals(true, descriptor.draggable)
    assertEquals(false, descriptor.clusterable)
    assertEquals(MarkerImage("https://example.com/pin.png", 32.0, 40.0, 2.0), descriptor.image)
    assertEquals(MarkerAnchor(0.5, 1.0), descriptor.anchor)
    assertEquals(MarkerPoint(4.0, -8.0), descriptor.centerOffset)
    assertEquals(45.0, requireNotNull(descriptor.rotation), 0.0)
    assertEquals(true, descriptor.flat)
    assertEquals(0.75, requireNotNull(descriptor.opacity), 1e-6)
    assertEquals(
      OverlayEnteringAnimationDescriptor(
        OverlayEnteringAnimationKind.FADE_SCALE,
        180.0,
        20.0,
        OverlayEnteringAnimationReduceMotion.NEVER,
      ),
      descriptor.enteringAnimation,
    )
  }

  @Test
  fun `keeps absent optionals absent`() {
    val builder = MarkerBatchBuilder().upsert(handle = 0, id = "minimal", latitude = 1.0, longitude = 2.0)

    var decoded: MarkerDescriptor? = null
    MarkerBatchDecoder.decode(
      MarkerBatchDecoder.wrap(builder.bytes()),
      builder.strings(),
      onRemove = {},
      onUpsert = { _, descriptor -> decoded = descriptor },
      onPosition = { _, _, _ -> },
    )

    val descriptor = requireNotNull(decoded)
    assertNull(descriptor.title)
    assertNull(descriptor.subtitle)
    assertNull(descriptor.image)
    assertNull(descriptor.anchor)
    assertNull(descriptor.centerOffset)
    assertNull(descriptor.rotation)
    assertNull(descriptor.opacity)
    assertNull(descriptor.enteringAnimation)
    assertNull(descriptor.draggable)
    assertNull(descriptor.clusterable)
    assertNull(descriptor.flat)
  }

  @Test
  fun `applies removals before upserts and positions last`() {
    val builder = MarkerBatchBuilder()
      .upsert(handle = 3, id = "c", latitude = 0.0, longitude = 0.0)
      .position(handle = 5, latitude = 1.5, longitude = 2.5)
      .remove(3)
      .upsert(handle = 4, id = "d", latitude = 0.0, longitude = 0.0)

    assertEquals(
      listOf("remove 3", "upsert 3 c", "upsert 4 d", "position 5 1.5 2.5"),
      decodeAll(builder),
    )
  }

  @Test
  fun `skips records whose id is out of the string table`() {
    val builder = MarkerBatchBuilder().upsert(handle = 0, id = "only", latitude = 0.0, longitude = 0.0)
    val events = ArrayList<String>()
    MarkerBatchDecoder.decode(
      MarkerBatchDecoder.wrap(builder.bytes()),
      emptyArray(),
      onRemove = {},
      onUpsert = { handle, _ -> events.add("upsert $handle") },
      onPosition = { _, _, _ -> },
    )
    assertTrue(events.isEmpty())
  }

  @Test
  fun `rejects a wrong magic and a wrong length`() {
    val bytes = MarkerBatchBuilder().upsert(handle = 0, id = "a", latitude = 0.0, longitude = 0.0).bytes()
    bytes[0] = 0
    assertThrows(MalformedMarkerBatchException::class.java) {
      MarkerBatchDecoder.readHeader(MarkerBatchDecoder.wrap(bytes))
    }

    val truncated = MarkerBatchBuilder().upsert(handle = 0, id = "a", latitude = 0.0, longitude = 0.0)
      .bytes().copyOf(MarkerBatchLayout.HEADER_BYTES + 10)
    assertThrows(MalformedMarkerBatchException::class.java) {
      MarkerBatchDecoder.readHeader(MarkerBatchDecoder.wrap(truncated))
    }
  }
}

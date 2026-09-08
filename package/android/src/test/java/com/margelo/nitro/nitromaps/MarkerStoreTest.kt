package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MarkerStoreTest {
  private fun MarkerStore.apply(builder: MarkerBatchBuilder) = applyNow(builder.bytes(), builder.strings())

  private val warsaw = LatLngBounds(LatLng(52.1, 20.9), LatLng(52.4, 21.2))

  @Test
  fun `upserts populate the arrays and the index`() {
    val store = MarkerStore()
    store.apply(
      MarkerBatchBuilder()
        .upsert(handle = 0, id = "a", latitude = 52.23, longitude = 21.01, title = "A")
        .upsert(handle = 1, id = "b", latitude = 50.06, longitude = 19.94),
    )

    assertEquals(2, store.markerCount)
    store.read { access ->
      assertEquals(2, access.count)
      assertEquals("A", access.descriptors[0]?.title)
      assertEquals(52.23, access.latitudes[0], 0.0)
      assertEquals(19.94, access.longitudes[1], 0.0)
      assertTrue(access.isAlive(0))
      assertTrue(access.isClusterable(1))
      assertArrayEquals(intArrayOf(0), access.index.candidates(warsaw))
      assertArrayEquals(intArrayOf(0, 1), access.aliveHandles())
    }
    assertArrayEquals(arrayOf("b", "a"), store.ids(intArrayOf(1, 0, 9)))
  }

  @Test
  fun `positions move markers in the index and bump their version`() {
    val store = MarkerStore()
    store.apply(MarkerBatchBuilder().upsert(handle = 0, id = "a", latitude = 50.06, longitude = 19.94))
    val versionBefore = store.read { it.versions[0] }

    store.apply(MarkerBatchBuilder().position(handle = 0, latitude = 52.23, longitude = 21.01))

    store.read { access ->
      assertEquals(Coordinate(52.23, 21.01), access.descriptors[0]?.coordinate)
      assertEquals(52.23, access.latitudes[0], 0.0)
      assertNotEquals(versionBefore, access.versions[0])
      assertArrayEquals(intArrayOf(0), access.index.candidates(warsaw))
    }
  }

  @Test
  fun `removals free the handle and a reuse in the same batch survives`() {
    val store = MarkerStore()
    store.apply(
      MarkerBatchBuilder()
        .upsert(handle = 0, id = "a", latitude = 52.23, longitude = 21.01)
        .upsert(handle = 1, id = "b", latitude = 52.24, longitude = 21.02),
    )
    store.apply(
      MarkerBatchBuilder()
        .upsert(handle = 0, id = "c", latitude = 52.25, longitude = 21.03)
        .remove(0),
    )

    assertEquals(2, store.markerCount)
    store.read { access ->
      assertEquals("c", access.descriptors[0]?.id)
      assertEquals("b", access.descriptors[1]?.id)
    }

    store.apply(MarkerBatchBuilder().remove(1).remove(42))
    assertEquals(1, store.markerCount)
    store.read { access ->
      assertNull(access.descriptors[1])
      assertArrayEquals(intArrayOf(0), access.aliveHandles())
      assertArrayEquals(intArrayOf(0), access.index.candidates(warsaw))
    }
  }

  @Test
  fun `positions for unknown handles are ignored`() {
    val store = MarkerStore()
    store.apply(MarkerBatchBuilder().position(handle = 3, latitude = 1.0, longitude = 2.0))
    assertEquals(0, store.markerCount)
  }

  @Test
  fun `clusterable flag follows the descriptor`() {
    val store = MarkerStore()
    store.apply(
      MarkerBatchBuilder()
        .upsert(handle = 0, id = "a", latitude = 0.0, longitude = 0.0, clusterable = false)
        .upsert(handle = 1, id = "b", latitude = 0.0, longitude = 0.0),
    )
    store.read { access ->
      assertTrue(!access.isClusterable(0))
      assertTrue(access.isClusterable(1))
    }
  }

  @Test
  fun `handles far apart grow the arrays sparsely`() {
    val store = MarkerStore()
    store.apply(MarkerBatchBuilder().upsert(handle = 1000, id = "far", latitude = 1.0, longitude = 1.0))
    assertEquals(1, store.markerCount)
    store.read { access ->
      assertTrue(access.flags.size > 1000)
      assertArrayEquals(intArrayOf(1000), access.aliveHandles())
    }
  }
}

package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MarkerApplyQueueTest {
  private class RecordingSink : MarkerApplyQueue.Sink {
    val events = ArrayList<String>()

    override fun remove(keys: List<MarkerRenderKey>) {
      events.add("remove " + keys.joinToString(",") { (it as MarkerRenderKey.Single).id })
    }

    override fun add(elements: List<ClusterElement>, pending: PendingMarkerApply) {
      events.add("add " + elements.joinToString(",") { it.key.idForTest() })
      pending.animationBudget -= elements.size
    }

    override fun update(element: ClusterElement) {
      events.add("update " + element.key.idForTest())
    }
  }

  private fun single(id: String, handle: Int, latitude: Double, longitude: Double = 21.0) =
    ClusterElement.Single(
      handle,
      MarkerDescriptor(id, Coordinate(latitude, longitude), null, null, null, null, null, null, null, null, null, null, null),
      1L,
    )

  private fun diff(
    removed: List<MarkerRenderKey> = emptyList(),
    added: List<ClusterElement> = emptyList(),
    retained: List<ClusterElement> = emptyList(),
  ) = MarkerRenderDiff(removed.toSet(), added, retained)

  @Test
  fun `removals go first and adds nearest the centre`() {
    val clock = FakeClock()
    val queue = MarkerApplyQueue(clock::now)
    val sink = RecordingSink()
    val far = single("far", 1, 53.0)
    val near = single("near", 2, 52.01)
    val mid = single("mid", 3, 52.5)
    queue.replace(
      PendingMarkerApply(
        diff(
          removed = listOf(MarkerRenderKey.Single(9, "gone")),
          added = listOf(far, near, mid),
          retained = listOf(single("kept", 4, 52.0)),
        ),
        center = LatLng(52.0, 21.0),
        animateEntering = true,
        animationBudget = 10,
      ),
    )

    queue.step(budgetNanos = 1_000_000, sink)

    assertEquals(listOf("remove gone", "add near,mid,far", "update kept"), sink.events)
    assertFalse(queue.hasWork)
  }

  @Test
  fun `adds are spread over frames by the per-frame count`() {
    val queue = MarkerApplyQueue(FakeClock()::now)
    val sink = RecordingSink()
    val added = (0 until 70).map { single("m$it", it, 52.0 + it * 0.001) }
    queue.replace(PendingMarkerApply(diff(added = added), null, true, 100))

    queue.step(1_000_000, sink)
    assertEquals(MarkerApplyQueue.INITIAL_ADDS_PER_FRAME, sink.events.single().split(" ")[1].split(",").size)
    assertTrue(queue.hasWork)
    queue.step(1_000_000, sink)
    queue.step(1_000_000, sink)
    assertEquals(3, sink.events.size)
    assertEquals(6, sink.events[2].split(" ")[1].split(",").size)
    assertFalse(queue.hasWork)
  }

  @Test
  fun `retained updates stop when the budget is spent`() {
    val clock = FakeClock(stepNanos = 600_000)
    val queue = MarkerApplyQueue(clock::now)
    val sink = RecordingSink()
    val retained = (0 until 10).map { single("r$it", it, 52.0) }
    queue.replace(PendingMarkerApply(diff(retained = retained), null, true, 0))

    queue.step(budgetNanos = 2_000_000, sink)

    // The clock advances 0.6 ms per read, one read at the start and one per
    // budget check: three updates go out before a check sees 2 ms spent.
    assertEquals(3, sink.events.size)
    assertTrue(queue.hasWork)
  }

  @Test
  fun `a new diff replaces what was pending`() {
    val queue = MarkerApplyQueue(FakeClock()::now)
    val sink = RecordingSink()
    val first = (0 until 50).map { single("a$it", it, 52.0) }
    queue.replace(PendingMarkerApply(diff(added = first), null, true, 0))
    queue.step(1_000_000, sink)

    queue.replace(PendingMarkerApply(diff(added = listOf(single("b", 99, 52.0))), null, true, 0))
    queue.step(1_000_000, sink)

    assertEquals("add b", sink.events.last())
    assertFalse(queue.hasWork)
  }

  @Test
  fun `the per-frame count adapts to frame intervals`() {
    val queue = MarkerApplyQueue(FakeClock()::now)
    val expected = 16_666_667L

    queue.observeFrame(intervalNanos = expected * 3, expectedNanos = expected)
    assertEquals(MarkerApplyQueue.INITIAL_ADDS_PER_FRAME / 2, queue.addsPerFrame)

    repeat(20) { queue.observeFrame(intervalNanos = expected * 2, expectedNanos = expected) }
    assertEquals(MarkerApplyQueue.MIN_ADDS_PER_FRAME, queue.addsPerFrame)
  }

  @Test
  fun `the per-frame count grows without limit until a frame drops`() {
    val queue = MarkerApplyQueue(FakeClock()::now)
    val expected = 16_666_667L

    repeat(20) { queue.observeFrame(intervalNanos = expected, expectedNanos = expected) }

    assertEquals(MarkerApplyQueue.MAX_ADDS_PER_FRAME, queue.addsPerFrame)
    assertEquals(null, queue.ceiling)
  }

  @Test
  fun `after a dropped frame growth stays below the count that dropped it`() {
    val queue = MarkerApplyQueue(FakeClock()::now)
    val expected = 16_666_667L
    repeat(3) { queue.observeFrame(intervalNanos = expected, expectedNanos = expected) }
    val beforeDrop = queue.addsPerFrame

    queue.observeFrame(intervalNanos = expected * 2, expectedNanos = expected)
    assertEquals(beforeDrop, queue.ceiling)
    assertEquals(beforeDrop / 2, queue.addsPerFrame)

    repeat(10) { queue.observeFrame(intervalNanos = expected, expectedNanos = expected) }
    // Ten good frames let the ceiling creep by ten; growth stays at three quarters of it.
    assertEquals((beforeDrop + 10) * 3 / 4, queue.addsPerFrame)
    assertTrue(queue.addsPerFrame < beforeDrop)
  }

  @Test
  fun `the animation budget carries across frames`() {
    val queue = MarkerApplyQueue(FakeClock()::now)
    val sink = RecordingSink()
    val added = (0 until 40).map { single("m$it", it, 52.0) }
    val pending = PendingMarkerApply(diff(added = added), null, true, animationBudget = 40)
    queue.replace(pending)

    queue.step(1_000_000, sink)
    assertEquals(8, pending.animationBudget)
    queue.step(1_000_000, sink)
    assertEquals(0, pending.animationBudget)
  }

  @Test
  fun `clusters sort by their badge position`() {
    val bounds = LatLngBounds(LatLng(51.0, 20.0), LatLng(53.0, 22.0))
    val farCluster = ClusterElement.Cluster("1:1", LatLng(53.0, 22.0), 5, intArrayOf(1), bounds)
    val nearCluster = ClusterElement.Cluster("2:2", LatLng(52.0, 21.0), 5, intArrayOf(2), bounds)
    val sorted = PendingMarkerApply.sortedByDistance(listOf(farCluster, nearCluster), LatLng(52.0, 21.0))

    assertEquals(listOf("2:2", "1:1"), sorted.map { (it as ClusterElement.Cluster).id })
  }

  private class FakeClock(private val stepNanos: Long = 0L) {
    private var nowNanos = 0L

    fun now(): Long {
      nowNanos += stepNanos
      return nowNanos
    }
  }
}

private fun MarkerRenderKey.idForTest(): String = when (this) {
  is MarkerRenderKey.Single -> id
  is MarkerRenderKey.Cluster -> id
}

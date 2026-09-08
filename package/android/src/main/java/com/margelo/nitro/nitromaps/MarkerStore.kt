package com.margelo.nitro.nitromaps

import android.os.Handler
import android.os.Looper
import java.lang.ref.WeakReference
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

internal interface MarkerStoreListener {
  /** Delivered on the main thread after a batch has been applied. */
  fun onMarkerStoreChanged(store: MarkerStore)
}

/**
 * Read access to the store's arrays. The coordinate and flag arrays are a
 * consistent snapshot that stays valid after [MarkerStore.read] returns: a
 * batch never writes into them, it replaces them with copies. Handles from the
 * index are valid indices into them. Descriptors, versions and the index are
 * only valid inside [MarkerStore.read].
 */
internal class MarkerStoreAccess(
  val latitudes: DoubleArray,
  val longitudes: DoubleArray,
  val flags: ByteArray,
  val descriptors: Array<MarkerDescriptor?>,
  val versions: LongArray,
  val index: MarkerSpatialIndex,
  val count: Int,
) {
  fun isAlive(handle: Int): Boolean =
    handle >= 0 && handle < flags.size && flags[handle].toInt() and MarkerStore.FLAG_ALIVE != 0

  fun isClusterable(handle: Int): Boolean =
    flags[handle].toInt() and MarkerStore.FLAG_CLUSTERABLE != 0

  fun aliveHandles(): IntArray {
    val handles = IntList(count.coerceAtLeast(1))
    for (handle in flags.indices) {
      if (flags[handle].toInt() and MarkerStore.FLAG_ALIVE != 0) {
        handles.add(handle)
      }
    }
    return handles.toIntArray()
  }
}

/**
 * The one native copy of a marker dataset, addressed by the integer handles JS
 * assigns.
 *
 * Batches are decoded on a shared background thread in the order they arrive;
 * readers (the map pipelines, on their compute threads or the UI thread) hold
 * the lock for the duration of a query. Coordinates and flags are kept as flat
 * arrays for the viewport and cluster loops; the full descriptor is only
 * touched for the elements that end up on screen.
 */
class MarkerStore {
  private val lock = Any()
  private val listeners = CopyOnWriteArrayList<WeakReference<MarkerStoreListener>>()
  private val mainHandler by lazy { Handler(Looper.getMainLooper()) }
  private val index = MarkerSpatialIndex()
  private var latitudes = DoubleArray(0)
  private var longitudes = DoubleArray(0)
  private var flags = ByteArray(0)
  private var descriptors = arrayOfNulls<MarkerDescriptor>(0)
  private var versions = LongArray(0)
  @Volatile private var count = 0
  private var nextVersion = 1L
  /** At most one listener notification is posted at a time. */
  private val notificationPending = AtomicBoolean(false)

  /** Lock-free: the map controllers read it on the main thread while a query runs. */
  val markerCount: Int
    get() = count

  /** Rough resident size, reported to the JS garbage collector. */
  val estimatedBytes: Long
    get() = synchronized(lock) {
      flags.size.toLong() * (8 + 8 + 8 + 1) + count.toLong() * 400
    }

  // Listeners (main thread)

  internal fun addListener(listener: MarkerStoreListener) {
    listeners.add(WeakReference(listener))
  }

  internal fun removeListener(listener: MarkerStoreListener) {
    listeners.removeAll { it.get() === listener || it.get() == null }
  }

  // Writes

  /** Applies an owned copy of a batch on the store thread, after every batch enqueued before it. */
  fun enqueue(bytes: ByteArray, strings: Array<String>) {
    executor.execute {
      apply(bytes, strings)
      notifyListeners()
    }
  }

  fun enqueueClear() {
    executor.execute {
      synchronized(lock) { removeAllLocked() }
      notifyListeners()
    }
  }

  // Reads

  internal fun <T> read(block: (MarkerStoreAccess) -> T): T = synchronized(lock) {
    block(MarkerStoreAccess(latitudes, longitudes, flags, descriptors, versions, index, count))
  }

  internal fun ids(handles: IntArray): Array<String> = read { access ->
    val ids = ArrayList<String>(handles.size)
    for (handle in handles) {
      if (handle >= 0 && handle < access.descriptors.size) {
        access.descriptors[handle]?.let { ids.add(it.id) }
      }
    }
    ids.toTypedArray()
  }

  // Batch application

  /** Synchronous variant of [enqueue] for tests. */
  internal fun applyNow(bytes: ByteArray, strings: Array<String>) = apply(bytes, strings)

  private fun apply(bytes: ByteArray, strings: Array<String>) = traceSection("NitroMaps.applyMarkerBatch") {
    synchronized(lock) {
      // Copy on write, once per batch: readers keep the arrays they took under
      // the lock and run their geometry on a consistent state while this batch
      // mutates the copies. Three arrays of 17 bytes per handle, only when the
      // dataset changes.
      latitudes = latitudes.copyOf()
      longitudes = longitudes.copyOf()
      flags = flags.copyOf()
      try {
        MarkerBatchDecoder.decode(
          MarkerBatchDecoder.wrap(bytes),
          strings,
          onRemove = { handle -> removeLocked(handle) },
          onUpsert = { handle, descriptor -> upsertLocked(handle, descriptor) },
          onPosition = { handle, latitude, longitude -> moveLocked(handle, latitude, longitude) },
        )
      } catch (error: RuntimeException) {
        // The header was validated on the JS thread and the bytes are our own
        // copy; anything that still fails here is a corrupt batch, which is
        // dropped rather than taking the store thread with it.
        return@synchronized
      }
      index.rebuildIfNeeded(latitudes, longitudes, flags)
    }
  }

  private fun upsertLocked(handle: Int, descriptor: MarkerDescriptor) {
    // JS hands out handles densely, so a valid batch never asks for more than
    // a bounded step past the current arrays; a corrupt one is dropped here
    // instead of growing five arrays to whatever it says.
    if (handle < 0 || handle >= MAX_HANDLE || handle > flags.size + MAX_HANDLE_STEP) {
      return
    }
    ensureCapacityLocked(handle)

    val latitude = descriptor.coordinate.latitude
    val longitude = descriptor.coordinate.longitude
    if (flags[handle].toInt() and FLAG_ALIVE != 0) {
      index.move(handle, latitude, longitude)
    } else {
      index.insert(handle, latitude, longitude)
      count += 1
    }

    latitudes[handle] = latitude
    longitudes[handle] = longitude
    flags[handle] = (FLAG_ALIVE or (if (descriptor.clusterable == false) 0 else FLAG_CLUSTERABLE)).toByte()
    descriptors[handle] = descriptor
    versions[handle] = nextVersion
    nextVersion += 1
  }

  private fun removeLocked(handle: Int) {
    if (handle < 0 || handle >= flags.size || flags[handle].toInt() and FLAG_ALIVE == 0) {
      return
    }
    index.remove(handle)
    flags[handle] = 0
    descriptors[handle] = null
    count -= 1
  }

  private fun moveLocked(handle: Int, latitude: Double, longitude: Double) {
    if (handle < 0 || handle >= flags.size || flags[handle].toInt() and FLAG_ALIVE == 0) {
      return
    }
    index.move(handle, latitude, longitude)
    latitudes[handle] = latitude
    longitudes[handle] = longitude
    descriptors[handle] = descriptors[handle]?.copy(coordinate = Coordinate(latitude, longitude))
    versions[handle] = nextVersion
    nextVersion += 1
  }

  private fun removeAllLocked() {
    latitudes = DoubleArray(0)
    longitudes = DoubleArray(0)
    flags = ByteArray(0)
    descriptors = arrayOfNulls(0)
    versions = LongArray(0)
    index.removeAll()
    count = 0
  }

  private fun ensureCapacityLocked(handle: Int) {
    if (handle < flags.size) {
      return
    }
    val target = maxOf(handle + 1, flags.size * 2, 64)
    latitudes = latitudes.copyOf(target)
    longitudes = longitudes.copyOf(target)
    flags = flags.copyOf(target)
    descriptors = descriptors.copyOf(target)
    versions = versions.copyOf(target)
  }

  /**
   * Delivers one notification per burst of batches: a stream of position
   * updates does not queue one full diff per batch on the main thread.
   */
  private fun notifyListeners() {
    if (listeners.isEmpty() || !notificationPending.compareAndSet(false, true)) {
      return
    }
    mainHandler.post {
      notificationPending.set(false)
      for (reference in listeners) {
        reference.get()?.onMarkerStoreChanged(this)
      }
    }
  }

  companion object {
    const val FLAG_ALIVE: Int = 1 shl 0
    const val FLAG_CLUSTERABLE: Int = 1 shl 1

    /**
     * Handles at or above this are refused. Five dense arrays of this length
     * are about 140 MB, the most a corrupt batch can make the store allocate.
     */
    private const val MAX_HANDLE = 1 shl 22

    /** How far past the current arrays one upsert may reach. */
    private const val MAX_HANDLE_STEP = 1 shl 16

    /** One thread applies every collection's batches, in order per collection. */
    private val executor: ExecutorService = Executors.newSingleThreadExecutor { runnable ->
      Thread(runnable, "NitroMaps.markerStore").apply { isDaemon = true }
    }
  }
}

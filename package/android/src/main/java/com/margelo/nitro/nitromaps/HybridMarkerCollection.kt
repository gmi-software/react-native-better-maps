package com.margelo.nitro.nitromaps

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.ArrayBuffer

/**
 * Nitro `MarkerCollection`: the JS-facing handle of a [MarkerStore].
 *
 * [applyBatch] runs on the JS thread. The buffer it receives is only valid for
 * the duration of the call, so the bytes are validated and copied here and
 * decoded later on the store thread; the JS thread never pays for the decode.
 */
@Keep
@DoNotStrip
class HybridMarkerCollection : HybridMarkerCollectionSpec() {
  val store = MarkerStore()

  override val size: Double
    get() = store.markerCount.toDouble()

  override val memorySize: Long
    get() = store.estimatedBytes

  override fun applyBatch(batch: ArrayBuffer, strings: Array<String>) {
    val view = batch.getBuffer(false)
    val bytes = ByteArray(view.remaining())
    view.get(bytes)
    MarkerBatchDecoder.readHeader(MarkerBatchDecoder.wrap(bytes))
    store.enqueue(bytes, strings)
  }

  override fun clear() {
    store.enqueueClear()
  }
}

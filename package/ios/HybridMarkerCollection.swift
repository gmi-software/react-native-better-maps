import Foundation
import NitroModules

/// Nitro `MarkerCollection`: the JS-facing handle of a `MarkerStore`.
///
/// `applyBatch` runs on the JS thread. The buffer it receives is only valid
/// for the duration of the call, so the bytes are validated and copied here
/// and decoded later on the store's own queue; the JS thread never pays for
/// the decode.
final class HybridMarkerCollection: HybridMarkerCollectionSpec {
  let store = MarkerStore()

  var size: Double {
    Double(store.markerCount)
  }

  var memorySize: Int {
    store.estimatedBytes
  }

  func applyBatch(batch: ArrayBuffer, strings: [String]) throws {
    let raw = UnsafeRawBufferPointer(start: batch.data, count: batch.size)
    do {
      _ = try MarkerBatchDecoder.readHeader(raw)
    } catch let error as MalformedMarkerBatchError {
      throw RuntimeError.error(withMessage: error.description)
    }
    store.enqueue(batch: [UInt8](raw), strings: strings)
  }

  func clear() throws {
    store.enqueueClear()
  }
}

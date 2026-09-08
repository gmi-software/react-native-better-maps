import Foundation

protocol MarkerStoreListener: AnyObject {
  /// Delivered on the main thread after a batch has been applied.
  func markerStoreDidChange(_ store: MarkerStore)
}

/// Read access to the store's arrays. Only valid inside `MarkerStore.read`; the
/// arrays are copy-on-write, so holding them longer is safe but costs the next
/// batch a copy.
struct MarkerStoreAccess {
  let latitudes: [Double]
  let longitudes: [Double]
  let flags: [UInt8]
  let descriptors: [MarkerDescriptor?]
  let versions: [Int]
  let index: MarkerSpatialIndex
  let count: Int

  func isAlive(_ handle: Int) -> Bool {
    handle >= 0 && handle < flags.count && flags[handle] & MarkerStore.Flag.alive != 0
  }

  func aliveHandles() -> [Int32] {
    var handles: [Int32] = []
    handles.reserveCapacity(count)
    for handle in 0..<flags.count where flags[handle] & MarkerStore.Flag.alive != 0 {
      handles.append(Int32(handle))
    }
    return handles
  }
}

/// The one native copy of a marker dataset, addressed by the integer handles
/// JS assigns.
///
/// Batches are decoded on a private serial queue in the order they arrive;
/// readers (the map pipelines, on their compute queues or the main thread)
/// take the lock for the duration of a query. Coordinates and flags are kept
/// as flat arrays for the viewport and cluster loops; the full descriptor is
/// materialized only for the elements that end up on screen.
final class MarkerStore {
  enum Flag {
    static let alive: UInt8 = 1 << 0
    static let clusterable: UInt8 = 1 << 1
  }

  /// Handles at or above this are refused. Five dense arrays of this length
  /// are about 140 MB, the most a corrupt batch can make the store allocate.
  private static let maximumHandle = 1 << 22
  /// How far past the current arrays one upsert may reach.
  private static let maximumHandleStep = 1 << 16

  private let lock = NSLock()
  private let queue = DispatchQueue(label: "com.nitromaps.markerStore", qos: .userInitiated)
  private let listeners = NSHashTable<AnyObject>.weakObjects()
  private let index = MarkerSpatialIndex()
  private var latitudes: [Double] = []
  private var longitudes: [Double] = []
  private var flags: [UInt8] = []
  private var descriptors: [MarkerDescriptor?] = []
  private var versions: [Int] = []
  /// At most one listener notification is queued on the main thread at a time.
  private var isNotificationPending = false
  private var count = 0
  private var nextVersion = 1

  var markerCount: Int {
    lock.lock()
    defer { lock.unlock() }
    return count
  }

  /// Rough resident size, reported to the JS garbage collector.
  var estimatedBytes: Int {
    lock.lock()
    defer { lock.unlock() }
    return flags.count * (MemoryLayout<Double>.size * 2 + MemoryLayout<Int>.size + 1)
      + count * 400
  }

  // MARK: - Listeners (main thread)

  func addListener(_ listener: MarkerStoreListener) {
    listeners.add(listener)
  }

  func removeListener(_ listener: MarkerStoreListener) {
    listeners.remove(listener)
  }

  // MARK: - Writes

  /// Applies an owned copy of a batch on the store queue, after every batch
  /// enqueued before it.
  func enqueue(batch bytes: [UInt8], strings: [String]) {
    queue.async { [self] in
      apply(bytes: bytes, strings: strings)
      notifyListeners()
    }
  }

  func enqueueClear() {
    queue.async { [self] in
      lock.lock()
      removeAllLocked()
      lock.unlock()
      notifyListeners()
    }
  }

  // MARK: - Reads

  func read<T>(_ body: (MarkerStoreAccess) -> T) -> T {
    lock.lock()
    defer { lock.unlock() }
    return body(MarkerStoreAccess(
      latitudes: latitudes,
      longitudes: longitudes,
      flags: flags,
      descriptors: descriptors,
      versions: versions,
      index: index,
      count: count
    ))
  }

  func ids(for handles: [Int32]) -> [String] {
    read { access in
      handles.compactMap { handle in
        let index = Int(handle)
        guard index < access.descriptors.count else {
          return nil
        }
        return access.descriptors[index]?.id
      }
    }
  }

  // MARK: - Batch application

  private func apply(bytes: [UInt8], strings: [String]) {
    let signpost = MapTrace.begin("applyMarkerBatch")
    defer { MapTrace.end("applyMarkerBatch", signpost) }

    lock.lock()
    defer { lock.unlock() }
    do {
      try bytes.withUnsafeBytes { raw in
        try MarkerBatchDecoder.decode(
          raw,
          strings: strings,
          onRemove: { handle in self.removeLocked(handle) },
          onUpsert: { handle, descriptor in self.upsertLocked(handle, descriptor) },
          onPosition: { handle, latitude, longitude in
            self.moveLocked(handle, latitude: latitude, longitude: longitude)
          }
        )
      }
    } catch {
      // The header was validated on the JS thread; a failure here means the
      // bytes changed underneath us, which the copy rules out.
      return
    }
    index.rebuildIfNeeded(latitudes: latitudes, longitudes: longitudes, flags: flags)
  }

  private func upsertLocked(_ handle: Int, _ descriptor: MarkerDescriptor) {
    // JS hands out handles densely, so a valid batch never asks for more than
    // a bounded step past the current arrays; a corrupt one is dropped here
    // instead of growing five arrays to whatever it says.
    guard handle >= 0, handle < Self.maximumHandle, handle <= flags.count + Self.maximumHandleStep else {
      return
    }
    ensureCapacityLocked(handle)

    let latitude = descriptor.coordinate.latitude
    let longitude = descriptor.coordinate.longitude
    if flags[handle] & Flag.alive != 0 {
      index.move(handle, latitude: latitude, longitude: longitude)
    } else {
      index.insert(handle, latitude: latitude, longitude: longitude)
      count += 1
    }

    latitudes[handle] = latitude
    longitudes[handle] = longitude
    flags[handle] = Flag.alive | (descriptor.clusterable == false ? 0 : Flag.clusterable)
    descriptors[handle] = descriptor
    versions[handle] = nextVersion
    nextVersion &+= 1
  }

  private func removeLocked(_ handle: Int) {
    guard handle >= 0, handle < flags.count, flags[handle] & Flag.alive != 0 else {
      return
    }
    index.remove(handle)
    flags[handle] = 0
    descriptors[handle] = nil
    count -= 1
  }

  private func moveLocked(_ handle: Int, latitude: Double, longitude: Double) {
    guard handle >= 0, handle < flags.count, flags[handle] & Flag.alive != 0 else {
      return
    }
    index.move(handle, latitude: latitude, longitude: longitude)
    latitudes[handle] = latitude
    longitudes[handle] = longitude
    descriptors[handle]?.coordinate = Coordinate(latitude: latitude, longitude: longitude)
    versions[handle] = nextVersion
    nextVersion &+= 1
  }

  private func removeAllLocked() {
    latitudes.removeAll()
    longitudes.removeAll()
    flags.removeAll()
    descriptors.removeAll()
    versions.removeAll()
    index.removeAll()
    count = 0
  }

  private func ensureCapacityLocked(_ handle: Int) {
    guard handle >= flags.count else {
      return
    }
    let target = max(handle + 1, flags.count * 2, 64)
    let extra = target - flags.count
    latitudes.append(contentsOf: repeatElement(0, count: extra))
    longitudes.append(contentsOf: repeatElement(0, count: extra))
    flags.append(contentsOf: repeatElement(0, count: extra))
    descriptors.append(contentsOf: repeatElement(nil, count: extra))
    versions.append(contentsOf: repeatElement(0, count: extra))
  }

  /// Delivers one notification per burst of batches: a stream of position
  /// updates does not queue one full diff per batch on the main thread.
  private func notifyListeners() {
    lock.lock()
    let alreadyPending = isNotificationPending
    isNotificationPending = true
    lock.unlock()
    guard !alreadyPending else {
      return
    }
    DispatchQueue.main.async { [weak self] in
      guard let self else {
        return
      }
      self.lock.lock()
      self.isNotificationPending = false
      self.lock.unlock()
      let listeners = self.listeners.allObjects
      guard !listeners.isEmpty else {
        return
      }
      for case let listener as MarkerStoreListener in listeners {
        listener.markerStoreDidChange(self)
      }
    }
  }
}

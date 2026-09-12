import Foundation

/// Layout of the packed batches `MarkerCollection` sends from JS. The format is
/// documented in `src/markers/markerBatch.ts`; keep both sides in sync.
enum MarkerBatchLayout {
  static let magic: UInt32 = 0x4E4D_4B31
  static let headerBytes = 16
  static let upsertBytes = 96
  static let removeBytes = 4
  static let positionBytes = 24
  static let noString: Int32 = -1

  static let hasAnchor: UInt32 = 1 << 0
  static let hasCenterOffset: UInt32 = 1 << 1
  static let draggable: UInt32 = 1 << 16
  static let clusterable: UInt32 = 1 << 17
  static let flat: UInt32 = 1 << 18

  enum Upsert {
    static let handle = 0
    static let flags = 4
    static let id = 8
    static let title = 12
    static let subtitle = 16
    static let imageUri = 20
    static let latitude = 24
    static let longitude = 32
    static let imageWidth = 40
    static let imageHeight = 44
    static let imageScale = 48
    static let anchorX = 52
    static let anchorY = 56
    static let centerOffsetX = 60
    static let centerOffsetY = 64
    static let rotation = 68
    static let opacity = 72
    static let animationDuration = 76
    static let animationDelay = 80
    static let animationKind = 84
    static let animationReduceMotion = 85
    static let markerColor = 88
    static let zIndex = 92
  }
}

struct MarkerBatchHeader {
  let upsertCount: Int
  let removeCount: Int
  let positionCount: Int

  var totalBytes: Int {
    MarkerBatchLayout.headerBytes
      + upsertCount * MarkerBatchLayout.upsertBytes
      + removeCount * MarkerBatchLayout.removeBytes
      + positionCount * MarkerBatchLayout.positionBytes
  }
}

struct MalformedMarkerBatchError: Error, CustomStringConvertible {
  let description: String
}

enum MarkerBatchDecoder {
  /// Validates the magic and the total length. Cheap enough to run on the JS
  /// thread before the bytes are copied off it.
  static func readHeader(_ bytes: UnsafeRawBufferPointer) throws -> MarkerBatchHeader {
    guard bytes.count >= MarkerBatchLayout.headerBytes else {
      throw MalformedMarkerBatchError(description: "Marker batch is shorter than its header")
    }
    guard bytes.uint32(at: 0) == MarkerBatchLayout.magic else {
      throw MalformedMarkerBatchError(description: "Not a marker batch")
    }

    let header = MarkerBatchHeader(
      upsertCount: Int(bytes.uint32(at: 4)),
      removeCount: Int(bytes.uint32(at: 8)),
      positionCount: Int(bytes.uint32(at: 12))
    )
    guard header.totalBytes == bytes.count else {
      throw MalformedMarkerBatchError(
        description: "Marker batch is \(bytes.count) bytes, expected \(header.totalBytes)"
      )
    }
    return header
  }

  /// Walks every record: removals first, then upserts, then positions, so a
  /// handle freed in this batch can be reused by an upsert in the same batch.
  static func decode(
    _ bytes: UnsafeRawBufferPointer,
    strings: [String],
    onRemove: (Int) -> Void,
    onUpsert: (Int, MarkerDescriptor) -> Void,
    onPosition: (Int, Double, Double) -> Void
  ) throws {
    let header = try readHeader(bytes)
    let upsertsStart = MarkerBatchLayout.headerBytes
    let removesStart = upsertsStart + header.upsertCount * MarkerBatchLayout.upsertBytes
    let positionsStart = removesStart + header.removeCount * MarkerBatchLayout.removeBytes

    for index in 0..<header.removeCount {
      let offset = removesStart + index * MarkerBatchLayout.removeBytes
      onRemove(Int(bytes.uint32(at: offset)))
    }

    for index in 0..<header.upsertCount {
      let base = upsertsStart + index * MarkerBatchLayout.upsertBytes
      guard let descriptor = descriptor(at: base, in: bytes, strings: strings) else {
        continue
      }
      onUpsert(Int(bytes.uint32(at: base + MarkerBatchLayout.Upsert.handle)), descriptor)
    }

    for index in 0..<header.positionCount {
      let base = positionsStart + index * MarkerBatchLayout.positionBytes
      onPosition(
        Int(bytes.uint32(at: base)),
        bytes.double(at: base + 8),
        bytes.double(at: base + 16)
      )
    }
  }

  private static func descriptor(
    at base: Int,
    in bytes: UnsafeRawBufferPointer,
    strings: [String]
  ) -> MarkerDescriptor? {
    typealias Field = MarkerBatchLayout.Upsert
    guard let id = string(strings, bytes.int32(at: base + Field.id)) else {
      return nil
    }

    let flags = bytes.uint32(at: base + Field.flags)
    var image: MarkerImage?
    if let uri = string(strings, bytes.int32(at: base + Field.imageUri)) {
      image = MarkerImage(
        uri: uri,
        width: bytes.optionalFloat(at: base + Field.imageWidth),
        height: bytes.optionalFloat(at: base + Field.imageHeight),
        scale: bytes.optionalFloat(at: base + Field.imageScale)
      )
    }

    var anchor: MarkerAnchor?
    if flags & MarkerBatchLayout.hasAnchor != 0 {
      anchor = MarkerAnchor(
        x: Double(bytes.float(at: base + Field.anchorX)),
        y: Double(bytes.float(at: base + Field.anchorY))
      )
    }

    var centerOffset: MarkerPoint?
    if flags & MarkerBatchLayout.hasCenterOffset != 0 {
      centerOffset = MarkerPoint(
        x: Double(bytes.float(at: base + Field.centerOffsetX)),
        y: Double(bytes.float(at: base + Field.centerOffsetY))
      )
    }

    var enteringAnimation: OverlayEnteringAnimationDescriptor?
    if let kind = animationKind(bytes.uint8(at: base + Field.animationKind)) {
      enteringAnimation = OverlayEnteringAnimationDescriptor(
        kind: kind,
        duration: bytes.optionalFloat(at: base + Field.animationDuration),
        delay: bytes.optionalFloat(at: base + Field.animationDelay),
        reduceMotion: reduceMotion(bytes.uint8(at: base + Field.animationReduceMotion))
      )
    }

    return MarkerDescriptor(
      id: id,
      coordinate: Coordinate(
        latitude: bytes.double(at: base + Field.latitude),
        longitude: bytes.double(at: base + Field.longitude)
      ),
      title: string(strings, bytes.int32(at: base + Field.title)),
      subtitle: string(strings, bytes.int32(at: base + Field.subtitle)),
      draggable: flags & MarkerBatchLayout.draggable != 0 ? true : nil,
      clusterable: flags & MarkerBatchLayout.clusterable != 0 ? nil : false,
      image: image,
      markerColor: string(strings, bytes.int32(at: base + Field.markerColor)),
      anchor: anchor,
      centerOffset: centerOffset,
      rotation: bytes.optionalFloat(at: base + Field.rotation),
      flat: flags & MarkerBatchLayout.flat != 0 ? true : nil,
      opacity: bytes.optionalFloat(at: base + Field.opacity),
      zIndex: bytes.optionalFloat(at: base + Field.zIndex),
      enteringAnimation: enteringAnimation
    )
  }

  private static func string(_ strings: [String], _ index: Int32) -> String? {
    guard index >= 0, Int(index) < strings.count else {
      return nil
    }
    return strings[Int(index)]
  }

  private static func animationKind(_ code: UInt8) -> OverlayEnteringAnimationKind? {
    switch code {
    case 1: return OverlayEnteringAnimationKind.none
    case 2: return OverlayEnteringAnimationKind.system
    case 3: return OverlayEnteringAnimationKind.fade
    case 4: return OverlayEnteringAnimationKind.fadeScale
    default: return nil
    }
  }

  private static func reduceMotion(_ code: UInt8) -> OverlayEnteringAnimationReduceMotion? {
    switch code {
    case 1: return .system
    case 2: return .never
    default: return nil
    }
  }
}

private extension UnsafeRawBufferPointer {
  func uint8(at offset: Int) -> UInt8 {
    self[offset]
  }

  func uint32(at offset: Int) -> UInt32 {
    UInt32(littleEndian: loadUnaligned(fromByteOffset: offset, as: UInt32.self))
  }

  func int32(at offset: Int) -> Int32 {
    Int32(bitPattern: uint32(at: offset))
  }

  func float(at offset: Int) -> Float {
    Float(bitPattern: uint32(at: offset))
  }

  func double(at offset: Int) -> Double {
    Double(bitPattern: UInt64(littleEndian: loadUnaligned(fromByteOffset: offset, as: UInt64.self)))
  }

  /// `NaN` marks an absent optional float.
  func optionalFloat(at offset: Int) -> Double? {
    let value = float(at: offset)
    return value.isNaN ? nil : Double(value)
  }
}

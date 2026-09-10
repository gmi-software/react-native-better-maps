import Foundation
import os.signpost

// Timing probes around the overlay pipeline, used by the performance lab
// (see performance/README.md).
//
// The recording variant compiles only when the pod is built with
// `-DNITROMAPS_PERF_PROBES`, which the podspec adds when
// `Podfile.properties.json` contains `"betterMaps.perfProbes": "true"`.
// Without the flag every call site is an inlined no-op, so release builds
// carry no probe code and no signposts.
//
// Each span is also emitted as an `os_signpost` interval (subsystem
// `com.nitromaps`, category `Pipeline`) so it shows up in Instruments'
// Points of Interest track.

#if NITROMAPS_PERF_PROBES
enum PerfProbe {
  struct Token {
    let name: StaticString
    let startNs: UInt64
    let signpostID: OSSignpostID
  }

  struct Span {
    let name: String
    let startNs: UInt64
    let durationNs: UInt64
    let count: Int
    let thread: String
  }

  /// Spans kept per drain. Scenarios drain after every phase; anything beyond
  /// this is counted as dropped rather than growing without bound.
  private static let capacity = 50_000
  private static let lock = NSLock()
  private static var spans: [Span] = []
  private static var droppedSpans = 0
  private static var recording = true
  private static let log = OSLog(subsystem: "com.nitromaps", category: "Pipeline")

  static var isRecording: Bool {
    get {
      lock.lock()
      defer { lock.unlock() }
      return recording
    }
    set {
      lock.lock()
      recording = newValue
      lock.unlock()
    }
  }

  /// Same clock as `CADisplayLink.timestamp` and `DispatchTime`, so spans can
  /// be aligned with frame timestamps and with JS `performance.now()` through
  /// the lab's clock-offset probe.
  @inline(__always)
  static func now() -> UInt64 {
    DispatchTime.now().uptimeNanoseconds
  }

  static func begin(_ name: StaticString) -> Token {
    let signpostID = OSSignpostID(log: log)
    os_signpost(.begin, log: log, name: name, signpostID: signpostID)
    return Token(name: name, startNs: now(), signpostID: signpostID)
  }

  static func end(_ token: Token, count: @autoclosure () -> Int = 0) {
    let endNs = now()
    os_signpost(.end, log: log, name: token.name, signpostID: token.signpostID)
    record(
      name: token.name,
      startNs: token.startNs,
      durationNs: endNs &- token.startNs,
      count: count()
    )
  }

  @inline(__always)
  static func measure<T>(
    _ name: StaticString,
    count: @autoclosure () -> Int = 0,
    _ body: () throws -> T
  ) rethrows -> T {
    let token = begin(name)
    defer { end(token, count: count()) }
    return try body()
  }

  static func drain() -> (spans: [Span], dropped: Int) {
    lock.lock()
    defer { lock.unlock() }
    let drained = spans
    let dropped = droppedSpans
    spans = []
    droppedSpans = 0
    return (drained, dropped)
  }

  private static func record(name: StaticString, startNs: UInt64, durationNs: UInt64, count: Int) {
    let thread = Thread.isMainThread ? "main" : "background"
    lock.lock()
    defer { lock.unlock() }
    guard recording else {
      return
    }
    if spans.count >= capacity {
      droppedSpans += 1
      return
    }
    spans.append(
      Span(name: "\(name)", startNs: startNs, durationNs: durationNs, count: count, thread: thread)
    )
  }
}
#else
enum PerfProbe {
  struct Token {}

  @inline(__always)
  static func begin(_ name: StaticString) -> Token {
    Token()
  }

  @inline(__always)
  static func end(_ token: Token, count: @autoclosure () -> Int = 0) {}

  @inline(__always)
  static func measure<T>(
    _ name: StaticString,
    count: @autoclosure () -> Int = 0,
    _ body: () throws -> T
  ) rethrows -> T {
    try body()
  }
}
#endif

extension Optional where Wrapped == [PolylineDescriptor] {
  /// Total coordinates across all polylines; only evaluated by probe builds.
  var coordinateCount: Int {
    self?.reduce(0) { $0 + $1.coordinates.count } ?? 0
  }
}

extension Optional where Wrapped == [PolygonDescriptor] {
  /// Total coordinates across all polygons; only evaluated by probe builds.
  var coordinateCount: Int {
    self?.reduce(0) { $0 + $1.coordinates.count } ?? 0
  }
}

/// Objective-C visible entry point for the performance lab's native module.
///
/// The lab looks this class up by name (`NSClassFromString`) so it never has
/// to import the NitroMaps Swift module, which is compiled with C++ interop.
/// Every method is a plain selector with no arguments so it can be invoked
/// through `perform(_:)`. Present in every build; only reports data when the
/// probes were compiled in.
@objc(NitroMapsPerfProbeBridge)
public final class NitroMapsPerfProbeBridge: NSObject {
  @objc public static func probesAvailable() -> NSNumber {
    #if NITROMAPS_PERF_PROBES
    return NSNumber(value: true)
    #else
    return NSNumber(value: false)
    #endif
  }

  @objc public static func enableProbes() {
    #if NITROMAPS_PERF_PROBES
    PerfProbe.isRecording = true
    #endif
  }

  @objc public static func disableProbes() {
    #if NITROMAPS_PERF_PROBES
    PerfProbe.isRecording = false
    #endif
  }

  /// `DispatchTime.now().uptimeNanoseconds`, the clock the spans use.
  @objc public static func nowNanoseconds() -> NSNumber {
    NSNumber(value: DispatchTime.now().uptimeNanoseconds)
  }

  /// Drains every recorded span as JSON:
  /// `{"spans":[{"name","startNs","durationNs","count","thread"}],"dropped":n}`.
  @objc public static func drainJSON() -> String {
    #if NITROMAPS_PERF_PROBES
    let (spans, dropped) = PerfProbe.drain()
    let payload: [String: Any] = [
      "spans": spans.map { span -> [String: Any] in
        [
          "name": span.name,
          "startNs": span.startNs,
          "durationNs": span.durationNs,
          "count": span.count,
          "thread": span.thread,
        ]
      },
      "dropped": dropped,
    ]
    guard let data = try? JSONSerialization.data(withJSONObject: payload),
          let json = String(data: data, encoding: .utf8) else {
      return "{\"spans\":[],\"dropped\":0}"
    }
    return json
    #else
    return "{\"spans\":[],\"dropped\":0}"
    #endif
  }
}

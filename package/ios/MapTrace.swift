import os.signpost

/// Signpost intervals for the marker pipeline. Visible in Instruments under
/// Points of Interest (subsystem `com.nitromaps`, category `MarkerPipeline`);
/// a no-op when no tracer is attached.
enum MapTrace {
  private static let log = OSLog(subsystem: "com.nitromaps", category: "MarkerPipeline")

  static func begin(_ name: StaticString) -> OSSignpostID {
    let id = OSSignpostID(log: log)
    os_signpost(.begin, log: log, name: name, signpostID: id)
    return id
  }

  static func end(_ name: StaticString, _ id: OSSignpostID) {
    os_signpost(.end, log: log, name: name, signpostID: id)
  }
}

import QuartzCore
import UIKit
import os.signpost

/// Records main-thread frame intervals with a `CADisplayLink`.
///
/// Callback cadence detects main-thread delays. It does not measure presented
/// map/GPU frames; pair it with an Instruments presentation/hitch trace.
final class FrameRecorder {
  private var displayLink: CADisplayLink?
  private var lastTimestamp: CFTimeInterval = 0
  private var lastExpectedInterval: CFTimeInterval = 0
  private var startedAt: CFTimeInterval = 0
  private var intervalsMs: [Double] = []
  private var expectedMs: [Double] = []
  private let signpostLog = OSLog(subsystem: "software.gmi.markerbench", category: .pointsOfInterest)
  private var signpostID: OSSignpostID?

  func start(label: String) {
    intervalsMs.reserveCapacity(4096)
    expectedMs.reserveCapacity(4096)

    let link = CADisplayLink(target: self, selector: #selector(step(_:)))
    let maximum = Float(UIScreen.main.maximumFramesPerSecond)
    // Ask for the display's full rate so a 120 Hz device is measured at 120 Hz.
    // On iPhone this also needs `CADisableMinimumFrameDurationOnPhone` in
    // Info.plist, which the example app sets.
    link.preferredFrameRateRange = CAFrameRateRange(
      minimum: 30,
      maximum: maximum,
      preferred: maximum
    )
    link.add(to: .main, forMode: .common)
    displayLink = link
    startedAt = CACurrentMediaTime()
    lastTimestamp = 0
    let id = OSSignpostID(log: signpostLog)
    signpostID = id
    os_signpost(.begin, log: signpostLog, name: "MarkerBenchmark", signpostID: id, "%{public}@", label)
  }

  @objc private func step(_ link: CADisplayLink) {
    if lastTimestamp > 0 {
      intervalsMs.append((link.timestamp - lastTimestamp) * 1000)
      expectedMs.append(lastExpectedInterval * 1000)
    }
    lastTimestamp = link.timestamp
    lastExpectedInterval = link.targetTimestamp - link.timestamp
  }

  func stop() -> [String: Any] {
    displayLink?.invalidate()
    displayLink = nil
    if let id = signpostID {
      os_signpost(.end, log: signpostLog, name: "MarkerBenchmark", signpostID: id)
      signpostID = nil
    }
    return [
      "intervalsMs": intervalsMs,
      "expectedMs": expectedMs,
      "durationMs": (CACurrentMediaTime() - startedAt) * 1000,
      "refreshRateHz": Double(UIScreen.main.maximumFramesPerSecond),
    ]
  }

  static func emptyRecording() -> [String: Any] {
    [
      "intervalsMs": [Double](),
      "expectedMs": [Double](),
      "durationMs": 0.0,
      "refreshRateHz": Double(UIScreen.main.maximumFramesPerSecond),
    ]
  }

  /// `phys_footprint`: the number Xcode's memory gauge and jetsam use.
  static func memoryFootprintBytes() -> UInt64 {
    var info = task_vm_info_data_t()
    var count = mach_msg_type_number_t(
      MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<natural_t>.size
    )
    let result = withUnsafeMutablePointer(to: &info) { pointer in
      pointer.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
        task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
      }
    }
    return result == KERN_SUCCESS ? info.phys_footprint : 0
  }
}

import ExpoModulesCore
import Foundation
import UIKit
import os.log

/// Native measurement module for the performance lab (performance/README.md).
///
/// Frame recording starts and stops on the main thread because that is the
/// thread whose frame intervals are measured.
public final class PerfLabModule: Module {
  private static let log = OSLog(subsystem: "com.nitromaps.perflab", category: "results")
  private var recorder: FrameRecorder?

  public func definition() -> ModuleDefinition {
    Name("PerfLab")

    AsyncFunction("startFrames") { () -> Void in
      _ = self.recorder?.stop()
      let recorder = FrameRecorder()
      recorder.start()
      self.recorder = recorder
    }.runOnQueue(.main)

    AsyncFunction("stopFrames") { () -> [String: Any] in
      guard let recorder = self.recorder else {
        return FrameRecorder.emptyRecording()
      }
      self.recorder = nil
      return recorder.stop()
    }.runOnQueue(.main)

    AsyncFunction("memorySnapshot") { () -> [String: Any] in
      ProcessStats.memorySnapshot()
    }

    AsyncFunction("processStats") { () -> [String: Any] in
      ProcessStats.processStats()
    }.runOnQueue(.main)

    AsyncFunction("deviceInfo") { () -> [String: Any] in
      DeviceInfo.collect()
    }.runOnQueue(.main)

    Function("nowNs") { () -> Double in
      Double(DispatchTime.now().uptimeNanoseconds)
    }

    // `xcrun simctl launch <udid> <bundle> --perf-run=<url>` passes the run
    // request without the "Open in …?" prompt that `simctl openurl` shows.
    Function("launchRequest") { () -> String? in
      for argument in ProcessInfo.processInfo.arguments where argument.hasPrefix("--perf-run=") {
        return String(argument.dropFirst("--perf-run=".count))
      }
      return ProcessInfo.processInfo.environment["PERF_LAB_RUN"]
    }

    Function("probesAvailable") { () -> Bool in
      ProbeBridge.isAvailable
    }

    AsyncFunction("setProbesEnabled") { (enabled: Bool) -> Void in
      ProbeBridge.setEnabled(enabled)
    }

    AsyncFunction("drainProbes") { () -> String in
      ProbeBridge.drainJSON()
    }

    AsyncFunction("logLine") { (line: String) -> Void in
      os_log("%{public}@", log: Self.log, type: .default, line)
    }

    AsyncFunction("writeResultFile") { (name: String, content: String) -> String in
      let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      let directory = documents.appendingPathComponent("perf-lab", isDirectory: true)
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      let file = directory.appendingPathComponent(name)
      try content.write(to: file, atomically: true, encoding: .utf8)
      return file.path
    }
  }
}

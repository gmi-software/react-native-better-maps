import ExpoModulesCore
import UIKit

/// Exposes `FrameRecorder` to JS. Recording starts and stops on the main
/// thread because that is the thread whose frame intervals are measured.
public final class FrameStatsModule: Module {
  private var recorder: FrameRecorder?
  private var initialEnvironment: [String: Any] = [:]

  private func environment() -> [String: Any] {
    var mounted = 0
    var visible = 0
    func visit(_ view: UIView, hidden: Bool) {
      let hidden = hidden || view.isHidden || view.alpha == 0
      if NSStringFromClass(type(of: view)).hasSuffix(".NitroMarkerContentView") {
        mounted += 1
        if !hidden { visible += 1 }
      }
      for child in view.subviews { visit(child, hidden: hidden) }
    }
    for scene in UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }) {
      for window in scene.windows { visit(window, hidden: false) }
    }
    return [
      "os": UIDevice.current.systemVersion,
      "thermalState": ProcessInfo.processInfo.thermalState.rawValue,
      "lowPowerMode": ProcessInfo.processInfo.isLowPowerModeEnabled,
      "mountedMarkerViews": mounted,
      "visibleMarkerViews": visible,
      "applicationActive": UIApplication.shared.applicationState == .active,
    ]
  }

  public func definition() -> ModuleDefinition {
    Name("FrameStats")

    AsyncFunction("setKeepAwake") { (enabled: Bool) -> Void in
      UIApplication.shared.isIdleTimerDisabled = enabled
    }.runOnQueue(.main)

    AsyncFunction("start") { (label: String) -> Void in
      self.recorder?.stop()
      self.initialEnvironment = self.environment()
      let recorder = FrameRecorder()
      recorder.start(label: label)
      self.recorder = recorder
    }.runOnQueue(.main)

    AsyncFunction("stop") { () -> [String: Any] in
      guard let recorder = self.recorder else {
        return FrameRecorder.emptyRecording()
      }
      self.recorder = nil
      var result = recorder.stop()
      result["environmentBefore"] = self.initialEnvironment
      result["environmentAfter"] = self.environment()
      return result
    }.runOnQueue(.main)

    AsyncFunction("memoryFootprint") { () -> Double in
      Double(FrameRecorder.memoryFootprintBytes())
    }

    AsyncFunction("displayRefreshRate") { () -> Double in
      Double(UIScreen.main.maximumFramesPerSecond)
    }.runOnQueue(.main)

    AsyncFunction("logLine") { (line: String) throws -> Void in
      let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      let url = documents.appendingPathComponent("marker-view-benchmark.jsonl")
      if !FileManager.default.fileExists(atPath: url.path) {
        FileManager.default.createFile(atPath: url.path, contents: nil)
      }
      let file = try FileHandle(forWritingTo: url)
      defer { try? file.close() }
      try file.seekToEnd()
      try file.write(contentsOf: Data((line + "\n").utf8))
      NSLog("%@", line)
    }
  }
}

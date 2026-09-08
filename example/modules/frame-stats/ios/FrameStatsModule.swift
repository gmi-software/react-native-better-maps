import ExpoModulesCore
import UIKit

/// Exposes `FrameRecorder` to JS. Recording starts and stops on the main
/// thread because that is the thread whose frame intervals are measured.
public final class FrameStatsModule: Module {
  private var recorder: FrameRecorder?

  public func definition() -> ModuleDefinition {
    Name("FrameStats")

    AsyncFunction("start") { () -> Void in
      self.recorder?.stop()
      let recorder = FrameRecorder()
      recorder.start()
      self.recorder = recorder
    }.runOnQueue(.main)

    AsyncFunction("stop") { () -> [String: Any] in
      guard let recorder = self.recorder else {
        return FrameRecorder.emptyRecording()
      }
      self.recorder = nil
      return recorder.stop()
    }.runOnQueue(.main)

    AsyncFunction("memoryFootprint") { () -> Double in
      Double(FrameRecorder.memoryFootprintBytes())
    }

    AsyncFunction("displayRefreshRate") { () -> Double in
      Double(UIScreen.main.maximumFramesPerSecond)
    }.runOnQueue(.main)

    AsyncFunction("logLine") { (line: String) -> Void in
      NSLog("%@", line)
    }
  }
}

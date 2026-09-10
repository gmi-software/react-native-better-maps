package expo.modules.perflab

import android.os.Build
import android.util.Log
import android.view.Display
import com.facebook.react.bridge.ReactContext
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Native measurement module for the performance lab (performance/README.md).
 *
 * Frame recording starts and stops on the main thread because that is the
 * thread whose frame intervals are measured.
 */
class PerfLabModule : Module() {
  private var recorder: FrameRecorder? = null
  private var jsQueueProbe: JsQueueProbe? = null

  override fun definition() = ModuleDefinition {
    Name("PerfLab")

    AsyncFunction("startFrames") {
      recorder?.stop()
      recorder = FrameRecorder(appContext.currentActivity, ::currentDisplay).also { it.start() }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("stopFrames") {
      val active = recorder
      recorder = null
      active?.stop() ?: FrameRecorder.emptyRecording(currentDisplay())
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("memorySnapshot") {
      ProcessStats.memorySnapshot(requireContext())
    }

    AsyncFunction("processStats") {
      ProcessStats.processStats(requireContext())
    }

    AsyncFunction("deviceInfo") {
      ProcessStats.deviceInfo(requireContext(), appContext.currentActivity, currentDisplay())
    }.runOnQueue(Queues.MAIN)

    Function("nowNs") {
      System.nanoTime().toDouble()
    }

    AsyncFunction("startJsQueueProbe") { intervalMs: Double ->
      jsQueueProbe?.stop()
      val context = requireContext() as? ReactContext
        ?: throw IllegalStateException("JS queue probe needs a ReactContext")
      jsQueueProbe = JsQueueProbe(context, intervalMs.toLong().coerceAtLeast(1)).also { it.start() }
    }

    AsyncFunction("stopJsQueueProbe") {
      val active = jsQueueProbe
      jsQueueProbe = null
      active?.stop() ?: mapOf(
        "latenessMs" to DoubleArray(0),
        "samples" to 0,
        "intervalMs" to 0.0,
        "durationMs" to 0.0,
      )
    }

    // `adb shell am start -n <pkg>/.MainActivity --es perfRun <url>` is an
    // alternative to the VIEW intent that the CLI uses.
    Function("launchRequest") {
      appContext.currentActivity?.intent?.getStringExtra("perfRun")
    }

    Function("probesAvailable") {
      ProbeBridge.isAvailable()
    }

    AsyncFunction("setProbesEnabled") { enabled: Boolean ->
      ProbeBridge.setEnabled(enabled)
    }

    AsyncFunction("drainProbes") {
      ProbeBridge.drainJson()
    }

    AsyncFunction("logLine") { line: String ->
      Log.i(TAG, line)
    }

    AsyncFunction("writeResultFile") { name: String, content: String ->
      val context = requireContext()
      val base = context.getExternalFilesDir(null) ?: context.filesDir
      val directory = File(base, "perf-lab").also { it.mkdirs() }
      val file = File(directory, name)
      file.writeText(content)
      file.absolutePath
    }
  }

  private fun requireContext() =
    requireNotNull(appContext.reactContext) { "React context is not available" }

  private fun currentDisplay(): Display? {
    val activity = appContext.currentActivity ?: return null
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      activity.display
    } else {
      @Suppress("DEPRECATION")
      activity.windowManager.defaultDisplay
    }
  }

  private companion object {
    const val TAG = "NitroMapsPerfLab"
  }
}

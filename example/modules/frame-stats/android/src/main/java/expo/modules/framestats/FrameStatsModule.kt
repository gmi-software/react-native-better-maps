package expo.modules.framestats

import android.os.Build
import android.os.Debug
import android.util.Log
import android.view.Display
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Exposes [FrameRecorder] to JS. Recording starts and stops on the main thread
 * because that is the thread whose frame intervals are measured.
 */
class FrameStatsModule : Module() {
  private var recorder: FrameRecorder? = null

  override fun definition() = ModuleDefinition {
    Name("FrameStats")

    AsyncFunction("start") {
      recorder?.stop()
      recorder = FrameRecorder(::currentDisplay).also { it.start() }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("stop") {
      val active = recorder
      recorder = null
      active?.stop() ?: FrameRecorder.emptyRecording(currentDisplay())
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("memoryFootprint") {
      // Proportional set size in bytes: the closest Android equivalent of
      // iOS `phys_footprint`.
      Debug.getPss().toDouble() * 1024.0
    }

    AsyncFunction("displayRefreshRate") {
      (currentDisplay()?.refreshRate ?: 60f).toDouble()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("logLine") { line: String ->
      Log.i("NitroMapsBenchmark", line)
    }
  }

  private fun currentDisplay(): Display? {
    val activity = appContext.currentActivity ?: return null
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      activity.display
    } else {
      @Suppress("DEPRECATION")
      activity.windowManager.defaultDisplay
    }
  }
}

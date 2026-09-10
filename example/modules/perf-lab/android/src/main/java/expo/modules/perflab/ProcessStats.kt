package expo.modules.perflab

import android.app.Activity
import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ApplicationInfo
import android.os.BatteryManager
import android.os.Build
import android.os.Debug
import android.os.PowerManager
import android.os.Process
import android.view.Display
import java.io.File

internal object ProcessStats {
  /**
   * PSS is the closest Android equivalent of iOS `phys_footprint`. ART's
   * runtime stats give cumulative allocation and GC counters, so deltas
   * between two snapshots are the allocation churn of what ran in between.
   */
  fun memorySnapshot(context: Context): Map<String, Any> {
    val runtime = Runtime.getRuntime()
    val memoryInfo = Debug.MemoryInfo()
    Debug.getMemoryInfo(memoryInfo)
    val stats = HashMap<String, Any>()
    for ((key, value) in memoryInfo.memoryStats) {
      value.toDoubleOrNull()?.let { stats[key] = it }
    }

    return mapOf(
      "footprintBytes" to memoryInfo.totalPss * 1024.0,
      "residentBytes" to residentBytes(),
      "javaHeapUsedBytes" to (runtime.totalMemory() - runtime.freeMemory()).toDouble(),
      "nativeHeapAllocatedBytes" to Debug.getNativeHeapAllocatedSize().toDouble(),
      "nativeHeapSizeBytes" to Debug.getNativeHeapSize().toDouble(),
      "gcCount" to runtimeStat("art.gc.gc-count"),
      "gcTimeMs" to runtimeStat("art.gc.gc-time"),
      "bytesAllocated" to runtimeStat("art.gc.bytes-allocated"),
      "bytesFreed" to runtimeStat("art.gc.bytes-freed"),
      "blockingGcCount" to runtimeStat("art.gc.blocking-gc-count"),
      "blockingGcTimeMs" to runtimeStat("art.gc.blocking-gc-time"),
      "memoryStats" to stats,
      "context" to context.packageName,
    )
  }

  fun processStats(context: Context): Map<String, Any> {
    val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
    val batteryManager = context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
    val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    val status = batteryIntent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1

    return mapOf(
      "cpuTimeMs" to Process.getElapsedCpuTime().toDouble(),
      "wallTimeMs" to System.nanoTime() / 1_000_000.0,
      "threadCount" to threadCount(),
      "thermalState" to thermalStatusName(powerManager),
      "batteryLevel" to ((batteryManager?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -100) / 100.0),
      "batteryState" to batteryStatusName(status),
      "lowPowerMode" to (powerManager?.isPowerSaveMode ?: false),
    )
  }

  fun deviceInfo(context: Context, activity: Activity?, display: Display?): Map<String, Any> {
    val metrics = context.resources.displayMetrics
    val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
    val memoryInfo = ActivityManager.MemoryInfo().also { activityManager?.getMemoryInfo(it) }
    val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
    val isDebuggable = (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
    val supportedRates = display?.supportedModes
      ?.map { it.refreshRate.toDouble() }
      ?.distinct()
      ?.sorted()
      ?: emptyList()

    return mapOf(
      "platform" to "android",
      "model" to Build.MODEL,
      "manufacturer" to Build.MANUFACTURER,
      "deviceName" to (Build.DEVICE ?: ""),
      "osVersion" to Build.VERSION.RELEASE,
      "apiLevel" to Build.VERSION.SDK_INT,
      "refreshRateHz" to (display?.refreshRate ?: 60f).toDouble(),
      "supportedRefreshRatesHz" to supportedRates,
      "screenScale" to metrics.density.toDouble(),
      "screenWidthPx" to metrics.widthPixels.toDouble(),
      "screenHeightPx" to metrics.heightPixels.toDouble(),
      "isDebugBuild" to isDebuggable,
      "isSimulator" to isEmulator(),
      "cpuCores" to Runtime.getRuntime().availableProcessors(),
      "totalMemoryBytes" to memoryInfo.totalMem.toDouble(),
      "appVersion" to "${packageInfo.versionName} (${versionCode(packageInfo)})",
      "activity" to (activity?.javaClass?.simpleName ?: ""),
    )
  }

  private fun versionCode(packageInfo: android.content.pm.PackageInfo): Long =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      packageInfo.longVersionCode
    } else {
      @Suppress("DEPRECATION")
      packageInfo.versionCode.toLong()
    }

  private fun runtimeStat(name: String): Double =
    Debug.getRuntimeStat(name)?.toDoubleOrNull() ?: -1.0

  private fun residentBytes(): Double {
    return try {
      val fields = File("/proc/self/statm").readText().trim().split(' ')
      fields.getOrNull(1)?.toDoubleOrNull()?.let { pages -> pages * PAGE_SIZE } ?: -1.0
    } catch (_: Exception) {
      -1.0
    }
  }

  private fun threadCount(): Int {
    return try {
      File("/proc/self/status").readLines()
        .firstOrNull { it.startsWith("Threads:") }
        ?.substringAfter(':')
        ?.trim()
        ?.toIntOrNull()
        ?: -1
    } catch (_: Exception) {
      -1
    }
  }

  private fun thermalStatusName(powerManager: PowerManager?): String {
    if (powerManager == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      return "unknown"
    }
    return when (powerManager.currentThermalStatus) {
      PowerManager.THERMAL_STATUS_NONE -> "none"
      PowerManager.THERMAL_STATUS_LIGHT -> "light"
      PowerManager.THERMAL_STATUS_MODERATE -> "moderate"
      PowerManager.THERMAL_STATUS_SEVERE -> "severe"
      PowerManager.THERMAL_STATUS_CRITICAL -> "critical"
      PowerManager.THERMAL_STATUS_EMERGENCY -> "emergency"
      PowerManager.THERMAL_STATUS_SHUTDOWN -> "shutdown"
      else -> "unknown"
    }
  }

  private fun batteryStatusName(status: Int): String = when (status) {
    BatteryManager.BATTERY_STATUS_CHARGING -> "charging"
    BatteryManager.BATTERY_STATUS_DISCHARGING -> "unplugged"
    BatteryManager.BATTERY_STATUS_FULL -> "full"
    BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "notCharging"
    else -> "unknown"
  }

  private fun isEmulator(): Boolean {
    val fingerprint = Build.FINGERPRINT.lowercase()
    val hardware = Build.HARDWARE.lowercase()
    val product = Build.PRODUCT.lowercase()
    return fingerprint.contains("generic") ||
      fingerprint.contains("emulator") ||
      hardware.contains("goldfish") ||
      hardware.contains("ranchu") ||
      product.contains("sdk")
  }

  private val PAGE_SIZE: Double = try {
    (Class.forName("android.system.Os").getMethod("sysconf", Int::class.javaPrimitiveType)
      .invoke(null, 0x28 /* _SC_PAGESIZE */) as Long).toDouble()
  } catch (_: Exception) {
    4096.0
  }
}

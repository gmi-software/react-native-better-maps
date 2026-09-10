import Darwin
import Foundation
import UIKit

enum ProcessStats {
  /// `phys_footprint` is the number Xcode's memory gauge and jetsam use.
  /// `malloc_zone_statistics(nil, …)` sums every malloc zone, which is where
  /// Swift class instances, C++ vectors and Nitro structs live.
  static func memorySnapshot() -> [String: Any] {
    var info = task_vm_info_data_t()
    var count = mach_msg_type_number_t(
      MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<natural_t>.size
    )
    let result = withUnsafeMutablePointer(to: &info) { pointer in
      pointer.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
        task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
      }
    }
    var mallocStats = malloc_statistics_t()
    malloc_zone_statistics(nil, &mallocStats)

    return [
      "footprintBytes": result == KERN_SUCCESS ? Double(info.phys_footprint) : -1,
      "residentBytes": result == KERN_SUCCESS ? Double(info.resident_size) : -1,
      "mallocBlocksInUse": Double(mallocStats.blocks_in_use),
      "mallocBytesInUse": Double(mallocStats.size_in_use),
      "mallocMaxBytesInUse": Double(mallocStats.max_size_in_use),
    ]
  }

  /// Must run on the main thread (UIDevice battery monitoring).
  static func processStats() -> [String: Any] {
    var usage = rusage()
    getrusage(RUSAGE_SELF, &usage)
    let cpuMs = Double(usage.ru_utime.tv_sec + usage.ru_stime.tv_sec) * 1000
      + Double(usage.ru_utime.tv_usec + usage.ru_stime.tv_usec) / 1000

    let device = UIDevice.current
    device.isBatteryMonitoringEnabled = true

    return [
      "cpuTimeMs": cpuMs,
      "wallTimeMs": Double(DispatchTime.now().uptimeNanoseconds) / 1_000_000,
      "threadCount": threadCount(),
      "thermalState": thermalStateName(ProcessInfo.processInfo.thermalState),
      "batteryLevel": Double(device.batteryLevel),
      "batteryState": batteryStateName(device.batteryState),
      "lowPowerMode": ProcessInfo.processInfo.isLowPowerModeEnabled,
    ]
  }

  static func threadCount() -> Int {
    var threads: thread_act_array_t?
    var count: mach_msg_type_number_t = 0
    guard task_threads(mach_task_self_, &threads, &count) == KERN_SUCCESS, let threads else {
      return -1
    }
    let size = vm_size_t(count) * vm_size_t(MemoryLayout<thread_t>.size)
    vm_deallocate(mach_task_self_, vm_address_t(bitPattern: threads), size)
    return Int(count)
  }

  private static func thermalStateName(_ state: ProcessInfo.ThermalState) -> String {
    switch state {
    case .nominal: return "nominal"
    case .fair: return "fair"
    case .serious: return "serious"
    case .critical: return "critical"
    @unknown default: return "unknown"
    }
  }

  private static func batteryStateName(_ state: UIDevice.BatteryState) -> String {
    switch state {
    case .unknown: return "unknown"
    case .unplugged: return "unplugged"
    case .charging: return "charging"
    case .full: return "full"
    @unknown default: return "unknown"
    }
  }
}

enum DeviceInfo {
  /// Must run on the main thread (UIScreen / UIDevice).
  static func collect() -> [String: Any] {
    var systemInfo = utsname()
    uname(&systemInfo)
    let machine = withUnsafePointer(to: &systemInfo.machine) { pointer in
      pointer.withMemoryRebound(to: CChar.self, capacity: 1) { String(cString: $0) }
    }

    #if targetEnvironment(simulator)
    let isSimulator = true
    let model = ProcessInfo.processInfo.environment["SIMULATOR_MODEL_IDENTIFIER"] ?? machine
    #else
    let isSimulator = false
    let model = machine
    #endif

    #if DEBUG
    let isDebugBuild = true
    #else
    let isDebugBuild = false
    #endif

    let screen = UIScreen.main
    let info = Bundle.main.infoDictionary
    let version = info?["CFBundleShortVersionString"] as? String ?? "0"
    let build = info?["CFBundleVersion"] as? String ?? "0"

    return [
      "platform": "ios",
      "model": model,
      "manufacturer": "Apple",
      "deviceName": UIDevice.current.name,
      "osVersion": UIDevice.current.systemVersion,
      "refreshRateHz": Double(screen.maximumFramesPerSecond),
      "screenScale": Double(screen.scale),
      "screenWidthPx": Double(screen.nativeBounds.width),
      "screenHeightPx": Double(screen.nativeBounds.height),
      "isDebugBuild": isDebugBuild,
      "isSimulator": isSimulator,
      "cpuCores": ProcessInfo.processInfo.activeProcessorCount,
      "totalMemoryBytes": Double(ProcessInfo.processInfo.physicalMemory),
      "appVersion": "\(version) (\(build))",
    ]
  }
}

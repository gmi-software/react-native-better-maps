import Foundation

/// Talks to `NitroMapsPerfProbeBridge` inside react-native-better-maps by
/// selector, so this module never imports the library's Swift module (which
/// is compiled with C++ interop). Every selector is argument-free.
enum ProbeBridge {
  private static var bridgeClass: AnyObject? {
    NSClassFromString("NitroMapsPerfProbeBridge")
  }

  private static func callObject(_ name: String) -> AnyObject? {
    guard let bridge = bridgeClass else {
      return nil
    }
    let selector = NSSelectorFromString(name)
    guard bridge.responds(to: selector) else {
      return nil
    }
    return bridge.perform(selector)?.takeUnretainedValue()
  }

  private static func callVoid(_ name: String) {
    guard let bridge = bridgeClass else {
      return
    }
    let selector = NSSelectorFromString(name)
    guard bridge.responds(to: selector) else {
      return
    }
    _ = bridge.perform(selector)
  }

  static var isAvailable: Bool {
    (callObject("probesAvailable") as? NSNumber)?.boolValue ?? false
  }

  static func setEnabled(_ enabled: Bool) {
    callVoid(enabled ? "enableProbes" : "disableProbes")
  }

  static func drainJSON() -> String {
    (callObject("drainJSON") as? String) ?? "{\"spans\":[],\"dropped\":0}"
  }
}

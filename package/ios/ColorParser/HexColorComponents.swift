import Foundation

struct HexColorComponents: Equatable {
  let red: UInt8
  let green: UInt8
  let blue: UInt8
  let alpha: UInt8
}

extension String {
  func toHexColorComponents() -> HexColorComponents? {
    var hex = trimmingCharacters(in: .whitespacesAndNewlines).uppercased()

    if hex.hasPrefix("#") {
      hex.removeFirst()
    }

    switch hex.count {
    case 3, 4:
      hex = hex.map { "\($0)\($0)" }.joined()
    case 6, 8:
      break
    default:
      return nil
    }

    if hex.count == 6 {
      hex += "FF"
    }

    guard hex.allSatisfy(\.isHexDigit), let value = UInt32(hex, radix: 16) else {
      return nil
    }

    return HexColorComponents(
      red: UInt8((value & 0xFF00_0000) >> 24),
      green: UInt8((value & 0x00FF_0000) >> 16),
      blue: UInt8((value & 0x0000_FF00) >> 8),
      alpha: UInt8(value & 0x0000_00FF)
    )
  }
}

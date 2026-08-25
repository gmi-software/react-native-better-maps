import UIKit

extension String {
  /// Parses a hex color string into a `UIColor`.
  /// Supports `#RGB`, `#RGBA`, `#RRGGBB`, and `#RRGGBBAA`.
  func toUIColor(fallback: UIColor = .black) -> UIColor {
    guard let components = toHexColorComponents() else {
      return fallback
    }

    return UIColor(
      red: CGFloat(components.red) / 255,
      green: CGFloat(components.green) / 255,
      blue: CGFloat(components.blue) / 255,
      alpha: CGFloat(components.alpha) / 255
    )
  }
}

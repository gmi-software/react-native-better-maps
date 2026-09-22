import Testing

@testable import NitroMapsColorParser

@Test
func parsesSupportedHexFormatsWithTrailingAlpha() {
  #expect("#F00".toHexColorComponents() == rgba(255, 0, 0, 255))
  #expect("#F008".toHexColorComponents() == rgba(255, 0, 0, 136))
  #expect("#FF0000".toHexColorComponents() == rgba(255, 0, 0, 255))
  #expect("#FF000080".toHexColorComponents() == rgba(255, 0, 0, 128))
}

@Test
func acceptsWhitespaceAndAnOptionalHashPrefix() {
  #expect(" 34C759 ".toHexColorComponents() == rgba(52, 199, 89, 255))
}

@Test
func rejectsMalformedInput() {
  #expect("".toHexColorComponents() == nil)
  #expect("#12".toHexColorComponents() == nil)
  #expect("#GG0000".toHexColorComponents() == nil)
  #expect("red".toHexColorComponents() == nil)
}

private func rgba(
  _ red: UInt8,
  _ green: UInt8,
  _ blue: UInt8,
  _ alpha: UInt8
) -> HexColorComponents {
  HexColorComponents(red: red, green: green, blue: blue, alpha: alpha)
}

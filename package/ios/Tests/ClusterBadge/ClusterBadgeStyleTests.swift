import CoreGraphics
import Testing

@testable import NitroMapsClusterBadge
@testable import NitroMapsColorParser

// ClusterBadgeStyleTest.kt checks the same cases on Android.

@Test
func showsCountsBelowOneThousandInFull() {
  #expect(ClusterBadgeStyle.label(for: 2) == "2")
  #expect(ClusterBadgeStyle.label(for: 999) == "999")
}

@Test
func showsLargerCountsInThousandsToOneDecimal() {
  #expect(ClusterBadgeStyle.label(for: 1000) == "1.0k")
  #expect(ClusterBadgeStyle.label(for: 1049) == "1.0k")
  #expect(ClusterBadgeStyle.label(for: 1400) == "1.4k")
  #expect(ClusterBadgeStyle.label(for: 12_345) == "12.3k")
  #expect(ClusterBadgeStyle.label(for: 999_950) == "1000.0k")
}

@Test
func roundsHalfwayCountsUpLikeAndroid() {
  // 1.45 is stored as 1.4499…, which `%.1f` rounded down to 1.4 on iOS only.
  #expect(ClusterBadgeStyle.label(for: 1450) == "1.5k")
  #expect(ClusterBadgeStyle.label(for: 1150) == "1.2k")
  #expect(ClusterBadgeStyle.label(for: 12_350) == "12.4k")
}

@Test
func keepsTheFontSizeOfACountThatFits() {
  #expect(ClusterBadgeStyle.fittedLabelFontSize(labelWidth: 27, diameter: 56) == 13)
  // A 56 pt badge leaves 56 - 2 * (2 + 4) = 44 pt for the count.
  #expect(ClusterBadgeStyle.fittedLabelFontSize(labelWidth: 44, diameter: 56) == 13)
}

@Test
func shrinksACountTooWideForTheBadge() {
  let fontSize = ClusterBadgeStyle.fittedLabelFontSize(labelWidth: 52, diameter: 56)

  #expect(abs(fontSize - 11) < 0.0001)
}

@Test
func stopsShrinkingAtTheMinimumScale() {
  let fontSize = ClusterBadgeStyle.fittedLabelFontSize(labelWidth: 500, diameter: 56)

  #expect(abs(fontSize - 13 * 0.6) < 0.0001)
}

@Test
func leavesRoomForTheWholeShadow() {
  let reach = 2.5 * ClusterBadgeStyle.shadowRadius + ClusterBadgeStyle.shadowOffsetY

  #expect(ClusterBadgeStyle.shadowOutset >= reach)
}

@Test
func definesEveryColorAsValidHex() {
  let colors = [
    ClusterBadgeStyle.gradientTopColor,
    ClusterBadgeStyle.gradientBottomColor,
    ClusterBadgeStyle.borderColor,
    ClusterBadgeStyle.shadowColor,
    ClusterBadgeStyle.labelColor,
  ]

  for color in colors {
    #expect(color.toHexColorComponents() != nil, "\(color)")
  }
  #expect(ClusterBadgeStyle.shadowColor.toHexColorComponents()?.alpha == 0x47)
}

@Test
func fitsTheCountInsideAGivenInset() {
  // With no border, a 56 pt badge leaves 56 - 2 * 4 = 48 pt for the count.
  #expect(ClusterBadgeStyle.fittedLabelFontSize(labelWidth: 48, diameter: 56, inset: 0) == 13)
  #expect(ClusterBadgeStyle.fittedLabelFontSize(labelWidth: 48, diameter: 56) < 13)
}

@Test
func keepsTheDefaultBadgeWhenNoStyleIsSet() {
  let appearance = ClusterBadgeAppearance()

  #expect(appearance == .standard)
  #expect(appearance.fill == .gradient)
  #expect(appearance.borderColor == ClusterBadgeStyle.borderColor)
  #expect(appearance.borderWidth == ClusterBadgeStyle.borderWidth)
  #expect(appearance.labelColor == ClusterBadgeStyle.labelColor)
  #expect(appearance.backgroundImageKey == nil)
}

@Test
func replacesTheGradientWithAFlatBackgroundColor() {
  let appearance = ClusterBadgeAppearance(
    backgroundColor: "#E30613",
    textColor: "#000000",
    borderColor: "#00FF00",
    borderWidth: 3
  )

  #expect(appearance.fill == .solid("#E30613"))
  #expect(appearance.labelColor == "#000000")
  #expect(appearance.borderColor == "#00FF00")
  #expect(appearance.borderWidth == 3)
}

@Test
func keepsTheFieldsAStyleLeavesOut() {
  let appearance = ClusterBadgeAppearance(textColor: "#000000")

  #expect(appearance.fill == .gradient)
  #expect(appearance.borderColor == ClusterBadgeStyle.borderColor)
  #expect(appearance.borderWidth == ClusterBadgeStyle.borderWidth)
}

@Test
func clampsTheBorderWidth() {
  #expect(ClusterBadgeAppearance(borderWidth: -1).borderWidth == 0)
  #expect(ClusterBadgeAppearance(borderWidth: .nan).borderWidth == ClusterBadgeStyle.borderWidth)
  #expect(ClusterBadgeAppearance(borderWidth: .infinity).borderWidth == ClusterBadgeStyle.borderWidth)
}

@Test
func drawsTheDiscInTheFillColorWithoutABorder() {
  #expect(ClusterBadgeAppearance(borderColor: "#00FF00").discColor == "#00FF00")
  #expect(ClusterBadgeAppearance(backgroundColor: "#E30613", borderWidth: 0).discColor == "#E30613")
  #expect(ClusterBadgeAppearance(borderWidth: 0).discColor == ClusterBadgeStyle.gradientBottomColor)
}

@Test
func letsTheCountUseTheBorderOfAnImageBadge() {
  #expect(ClusterBadgeAppearance(borderWidth: 3).labelInset == 3)
  #expect(ClusterBadgeAppearance(borderWidth: 3, backgroundImageKey: "badge.png").labelInset == 0)
}

@Test
func fallsBackToTheColoredBadgeWithoutItsImage() {
  let appearance = ClusterBadgeAppearance(backgroundColor: "#E30613", backgroundImageKey: "badge.png")

  #expect(appearance.withoutBackgroundImage == ClusterBadgeAppearance(backgroundColor: "#E30613"))
}

@Test
func cachesEveryLookApart() {
  let looks = [
    ClusterBadgeAppearance(),
    ClusterBadgeAppearance(backgroundColor: "#E30613"),
    ClusterBadgeAppearance(textColor: "#000000"),
    ClusterBadgeAppearance(borderColor: "#000000"),
    ClusterBadgeAppearance(borderWidth: 0),
    ClusterBadgeAppearance(backgroundImageKey: "badge.png"),
  ]

  #expect(Set(looks.map(\.cacheKey)).count == looks.count)
  #expect(ClusterBadgeAppearance().cacheKey == ClusterBadgeAppearance.standard.cacheKey)
}

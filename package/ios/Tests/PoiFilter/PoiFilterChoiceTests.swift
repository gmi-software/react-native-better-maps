import Testing

@testable import NitroMapsPoiFilter

@Test
func keepsTheProviderDefaultWithoutAPropOrAStyleRule() {
  let choice: PoiFilterChoice<String>? = resolvePoiFilter(nil, styleHidesPois: false)
  #expect(choice == nil)
}

@Test
func hidesEveryPoiWhenOnlyTheStyleTurnsThemOff() {
  let choice: PoiFilterChoice<String>? = resolvePoiFilter(nil, styleHidesPois: true)
  #expect(choice == .excludingAll)
}

@Test
func letsAnExplicitPropBeatTheStyle() {
  #expect(resolvePoiFilter(PoiFilterRequest<String>.showAll, styleHidesPois: true) == .includingAll)
  #expect(
    resolvePoiFilter(PoiFilterRequest.allExcept(["restaurant"]), styleHidesPois: true)
      == .excluding(["restaurant"])
  )
}

@Test
func mapsAllAndNone() {
  #expect(resolvePoiFilter(PoiFilterRequest<String>.showAll, styleHidesPois: false) == .includingAll)
  #expect(resolvePoiFilter(PoiFilterRequest<String>.hideAll, styleHidesPois: false) == .excludingAll)
}

@Test
func keepsTheCategoriesInOrder() {
  #expect(
    resolvePoiFilter(PoiFilterRequest.only(["park", "museum"]), styleHidesPois: false)
      == .including(["park", "museum"])
  )
  #expect(
    resolvePoiFilter(PoiFilterRequest.allExcept(["restaurant", "store"]), styleHidesPois: false)
      == .excluding(["restaurant", "store"])
  )
}

@Test
func includingNoCategoryHidesEveryPoi() {
  // Also what an include list of iOS 18 categories becomes on iOS 16 and 17.
  #expect(
    resolvePoiFilter(PoiFilterRequest<String>.only([]), styleHidesPois: false)
      == .excludingAll
  )
}

@Test
func excludingNoCategoryShowsEveryPoi() {
  #expect(
    resolvePoiFilter(PoiFilterRequest<String>.allExcept([]), styleHidesPois: true)
      == .includingAll
  )
}

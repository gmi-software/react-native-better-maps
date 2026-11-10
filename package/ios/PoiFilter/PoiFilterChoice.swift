/// The points of interest a map is asked to show, with categories already
/// converted to the ones the running OS knows.
enum PoiFilterRequest<Category: Equatable>: Equatable {
  case showAll
  case hideAll
  case only([Category])
  case allExcept([Category])
}

/// The POI filter MapKit should get. An empty category list is folded into
/// `includingAll` / `excludingAll`, because it means the same thing.
enum PoiFilterChoice<Category: Equatable>: Equatable {
  case includingAll
  case excludingAll
  case including([Category])
  case excluding([Category])
}

/// Resolves the `pointsOfInterest` prop against the POI rules of a custom map
/// style. An explicit prop wins; without it, a style that turns POIs off hides
/// them all. Returns nil to keep MapKit's default, which shows every POI.
func resolvePoiFilter<Category>(
  _ request: PoiFilterRequest<Category>?,
  styleHidesPois: Bool
) -> PoiFilterChoice<Category>? {
  guard let request else {
    return styleHidesPois ? .excludingAll : nil
  }

  switch request {
  case .showAll:
    return .includingAll
  case .hideAll:
    return .excludingAll
  case .only(let categories):
    return categories.isEmpty ? .excludingAll : .including(categories)
  case .allExcept(let categories):
    return categories.isEmpty ? .includingAll : .excluding(categories)
  }
}

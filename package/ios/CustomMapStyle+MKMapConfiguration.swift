import MapKit

enum CustomMapStyleParser {
  /// Applies a curated subset of Google Maps JSON style rules via MapKit configuration.
  /// Full JSON parity is not available on iOS; POI/transit visibility and elevation are supported.
  /// `poiFilter` (the `pointsOfInterest` prop) beats the style's POI rules.
  @available(iOS 16.0, *)
  static func apply(
    json: String?,
    mapType: MapType,
    poiFilter: NativePoiFilter?,
    to mapView: MKMapView
  ) {
    guard let json, !json.isEmpty,
      let data = json.data(using: .utf8),
      let rules = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
    else {
      let configuration = mapType.toMKMapConfiguration()
      applyPoiFilter(poiFilter, styleHidesPois: false, to: configuration)
      mapView.preferredConfiguration = configuration
      return
    }

    let configuration = mapType.toMKMapConfiguration()
    var hidePois = false
    var hideTransit = false
    var useFlatElevation = false

    for rule in rules {
      guard let stylers = rule["stylers"] as? [[String: Any]] else {
        continue
      }

      let featureType = rule["featureType"] as? String ?? "all"
      let elementType = rule["elementType"] as? String ?? "all"

      for styler in stylers {
        if let visibility = styler["visibility"] as? String, visibility == "off" {
          switch featureType {
          case "poi", "poi.business", "poi.park", "poi.medical", "poi.school", "poi.sports_complex":
            hidePois = true
          case "transit", "transit.line", "transit.station":
            hideTransit = true
          default:
            break
          }
        }

        if elementType == "geometry", let lightness = styler["lightness"] as? Double, lightness < 0 {
          useFlatElevation = true
        }
      }
    }

    applyPoiFilter(poiFilter, styleHidesPois: hidePois, to: configuration)
    if let standard = configuration as? MKStandardMapConfiguration {
      if hideTransit {
        standard.showsTraffic = false
      }
      if useFlatElevation {
        standard.elevationStyle = .flat
      }
    }

    mapView.preferredConfiguration = configuration
  }

  /// Satellite imagery has no points of interest, so only the standard and
  /// hybrid configurations take a filter.
  @available(iOS 16.0, *)
  private static func applyPoiFilter(
    _ poiFilter: NativePoiFilter?,
    styleHidesPois: Bool,
    to configuration: MKMapConfiguration
  ) {
    guard
      let choice = resolvePoiFilter(poiFilter?.toRequest(), styleHidesPois: styleHidesPois)
    else {
      return
    }

    let filter = choice.toMKPointOfInterestFilter()
    if let standard = configuration as? MKStandardMapConfiguration {
      standard.pointOfInterestFilter = filter
    } else if let hybrid = configuration as? MKHybridMapConfiguration {
      hybrid.pointOfInterestFilter = filter
    }
  }
}

extension NativePoiFilter {
  fileprivate func toRequest() -> PoiFilterRequest<MKPointOfInterestCategory> {
    let categories = categories.compactMap(\.mkPointOfInterestCategory)
    switch mode {
    case .all:
      return .showAll
    case .none:
      return .hideAll
    case .include:
      return .only(categories)
    case .exclude:
      return .allExcept(categories)
    }
  }
}

extension PoiFilterChoice where Category == MKPointOfInterestCategory {
  fileprivate func toMKPointOfInterestFilter() -> MKPointOfInterestFilter {
    switch self {
    case .includingAll:
      return .includingAll
    case .excludingAll:
      return .excludingAll
    case .including(let categories):
      return MKPointOfInterestFilter(including: categories)
    case .excluding(let categories):
      return MKPointOfInterestFilter(excluding: categories)
    }
  }
}

extension MapType {
  @available(iOS 16.0, *)
  func toMKMapConfiguration() -> MKMapConfiguration {
    switch self {
    case .standard, .terrain:
      return MKStandardMapConfiguration(elevationStyle: .realistic)
    case .mutedstandard:
      return MKStandardMapConfiguration(elevationStyle: .realistic, emphasisStyle: .muted)
    case .satellite:
      return MKImageryMapConfiguration(elevationStyle: .realistic)
    case .hybrid:
      return MKHybridMapConfiguration(elevationStyle: .realistic)
    }
  }
}

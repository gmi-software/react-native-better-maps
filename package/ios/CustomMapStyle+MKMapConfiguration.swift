import MapKit

enum CustomMapStyleParser {
  /// Applies a curated subset of Google Maps JSON style rules via MapKit configuration.
  /// Full JSON parity is not available on iOS; POI/transit visibility and elevation are supported.
  @available(iOS 16.0, *)
  static func apply(json: String?, mapType: MapType, to mapView: MKMapView) {
    guard let json, !json.isEmpty,
      let data = json.data(using: .utf8),
      let rules = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
    else {
      mapView.preferredConfiguration = mapType.toMKMapConfiguration()
      return
    }

    var configuration = mapType.toMKMapConfiguration()
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

    if let standard = configuration as? MKStandardMapConfiguration {
      if hidePois {
        standard.pointOfInterestFilter = .excludingAll
      }
      if hideTransit {
        standard.showsTraffic = false
      }
      if useFlatElevation {
        standard.elevationStyle = .flat
      }
      configuration = standard
    }

    mapView.preferredConfiguration = configuration
  }
}

extension MapType {
  @available(iOS 16.0, *)
  func toMKMapConfiguration() -> MKMapConfiguration {
    switch self {
    case .standard, .terrain:
      return MKStandardMapConfiguration(elevationStyle: .realistic)
    case .satellite:
      return MKImageryMapConfiguration(elevationStyle: .realistic)
    case .hybrid:
      return MKHybridMapConfiguration(elevationStyle: .realistic)
    }
  }
}

#if canImport(GoogleMaps)
import GoogleMaps

extension MapType {
  /// `mutedStandard` is Apple-only and falls back to the normal map.
  func toGMSMapViewType() -> GMSMapViewType {
    switch self {
    case .standard, .mutedstandard:
      return .normal
    case .satellite:
      return .satellite
    case .hybrid:
      return .hybrid
    case .terrain:
      return .terrain
    }
  }
}
#endif

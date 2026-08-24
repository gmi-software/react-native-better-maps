#if canImport(GoogleMaps)
import GoogleMaps

extension MapType {
  func toGMSMapViewType() -> GMSMapViewType {
    switch self {
    case .standard:
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

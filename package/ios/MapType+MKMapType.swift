import MapKit

extension MapType {
  /// Converts the cross-platform map type to MapKit's native type.
  /// `terrain` has no MapKit equivalent and falls back to standard.
  func toMKMapType() -> MKMapType {
    switch self {
    case .standard, .terrain:
      return .standard
    case .mutedstandard:
      return .mutedStandard
    case .satellite:
      return .satellite
    case .hybrid:
      return .hybrid
    }
  }
}

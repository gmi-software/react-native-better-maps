import CoreLocation

enum MapApproximateEquality {
  static let coordinateEpsilon: Double = 1e-6
  static let spanEpsilon: Double = 1e-6
  static let zoomEpsilon: Float = 1e-4
  static let angleEpsilon: CLLocationDirection = 1e-3
  static let distanceEpsilon: Double = 0.1
}

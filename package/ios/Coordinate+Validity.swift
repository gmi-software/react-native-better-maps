import CoreLocation

extension Coordinate {
  var isValid: Bool {
    CLLocationCoordinate2DIsValid(toCLLocationCoordinate2D())
  }
}

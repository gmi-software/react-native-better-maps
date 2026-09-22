import CoreLocation

extension Region {
  var isValid: Bool {
    CLLocationCoordinate2DIsValid(
      CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    ) && RegionSpan.isDrawable(latitudeDelta: latitudeDelta, longitudeDelta: longitudeDelta)
  }
}

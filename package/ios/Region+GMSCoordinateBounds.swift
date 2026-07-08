#if canImport(GoogleMaps)
import GoogleMaps
import MapKit

extension Region {
  func toGMSCoordinateBounds() -> GMSCoordinateBounds {
    let southWest = CLLocationCoordinate2D(
      latitude: latitude - latitudeDelta / 2,
      longitude: longitude - longitudeDelta / 2
    )
    let northEast = CLLocationCoordinate2D(
      latitude: latitude + latitudeDelta / 2,
      longitude: longitude + longitudeDelta / 2
    )
    return GMSCoordinateBounds(coordinate: southWest, coordinate: northEast)
  }
}

extension GMSCoordinateBounds {
  func toRegion() -> Region {
    let latitudeDelta = northEast.latitude - southWest.latitude
    let rawLongitudeDelta = northEast.longitude - southWest.longitude
    let longitudeDelta = rawLongitudeDelta >= 0 ? rawLongitudeDelta : rawLongitudeDelta + 360

    return Region(
      latitude: southWest.latitude + latitudeDelta / 2,
      longitude: normalizedLongitude(southWest.longitude + longitudeDelta / 2),
      latitudeDelta: latitudeDelta,
      longitudeDelta: longitudeDelta
    )
  }

  private func normalizedLongitude(_ longitude: Double) -> Double {
    var value = longitude
    while value > 180 { value -= 360 }
    while value < -180 { value += 360 }
    return value
  }
}

extension MKCoordinateRegion {
  init(bounds: GMSCoordinateBounds) {
    self = bounds.toRegion().toMKCoordinateRegion()
  }
}
#endif

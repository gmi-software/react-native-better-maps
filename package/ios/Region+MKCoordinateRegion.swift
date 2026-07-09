import MapKit

extension Region {
  func toMKCoordinateRegion() -> MKCoordinateRegion {
    MKCoordinateRegion(
      center: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
      span: MKCoordinateSpan(latitudeDelta: latitudeDelta, longitudeDelta: longitudeDelta)
    )
  }
}

extension MKCoordinateRegion {
  func approximatelyEquals(
    _ other: MKCoordinateRegion,
    coordinateEpsilon: Double = MapApproximateEquality.coordinateEpsilon,
    spanEpsilon: Double = MapApproximateEquality.spanEpsilon
  ) -> Bool {
    abs(center.latitude - other.center.latitude) < coordinateEpsilon
      && abs(center.longitude - other.center.longitude) < coordinateEpsilon
      && abs(span.latitudeDelta - other.span.latitudeDelta) < spanEpsilon
      && abs(span.longitudeDelta - other.span.longitudeDelta) < spanEpsilon
  }

  func toRegion() -> Region {
    Region(
      latitude: center.latitude,
      longitude: center.longitude,
      latitudeDelta: span.latitudeDelta,
      longitudeDelta: span.longitudeDelta
    )
  }
}

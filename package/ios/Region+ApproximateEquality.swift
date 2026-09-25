extension Region {
  func approximatelyEquals(
    _ other: Region,
    coordinateEpsilon: Double = MapApproximateEquality.coordinateEpsilon,
    spanEpsilon: Double = MapApproximateEquality.spanEpsilon
  ) -> Bool {
    abs(latitude - other.latitude) < coordinateEpsilon
      && abs(longitude - other.longitude) < coordinateEpsilon
      && abs(latitudeDelta - other.latitudeDelta) < spanEpsilon
      && abs(longitudeDelta - other.longitudeDelta) < spanEpsilon
  }
}

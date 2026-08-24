#if canImport(GoogleMaps)
import GoogleMaps
import NitroModules

extension GMSMapView {
  func toNitroVisibleRegion() -> VisibleRegion {
    let visibleRegion = projection.visibleRegion()
    return VisibleRegion(
      nearLeft: visibleRegion.nearLeft.toCoordinate(),
      nearRight: visibleRegion.nearRight.toCoordinate(),
      farLeft: visibleRegion.farLeft.toCoordinate(),
      farRight: visibleRegion.farRight.toCoordinate()
    )
  }

  func currentNitroRegion() -> Region {
    GMSCoordinateBounds(region: projection.visibleRegion()).toRegion()
  }
}

extension CLLocationCoordinate2D {
  func toCoordinate() -> Coordinate {
    Coordinate(latitude: latitude, longitude: longitude)
  }
}
#endif

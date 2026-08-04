import CoreLocation
import GoogleMaps

extension Camera {
  func toGMSCameraPosition(current: GMSCameraPosition? = nil) -> GMSCameraPosition {
    GMSCameraPosition.camera(
      withLatitude: center.latitude,
      longitude: center.longitude,
      zoom: Float(zoom ?? Double(current?.zoom ?? 10)),
      bearing: CLLocationDirection(heading ?? current?.bearing ?? 0),
      viewingAngle: Double(pitch ?? current?.viewingAngle ?? 0)
    )
  }
}

extension GMSCameraPosition {
  func approximatelyEquals(
    _ other: GMSCameraPosition,
    coordinateEpsilon: Double = MapApproximateEquality.coordinateEpsilon,
    zoomEpsilon: Float = MapApproximateEquality.zoomEpsilon,
    angleEpsilon: CLLocationDirection = MapApproximateEquality.angleEpsilon
  ) -> Bool {
    abs(target.latitude - other.target.latitude) < coordinateEpsilon
      && abs(target.longitude - other.target.longitude) < coordinateEpsilon
      && abs(zoom - other.zoom) < zoomEpsilon
      && abs(bearing - other.bearing) < angleEpsilon
      && abs(viewingAngle - other.viewingAngle) < angleEpsilon
  }

  func toCamera() -> Camera {
    Camera(
      center: Coordinate(latitude: target.latitude, longitude: target.longitude),
      zoom: Double(zoom),
      heading: bearing,
      pitch: viewingAngle,
      altitude: nil
    )
  }
}

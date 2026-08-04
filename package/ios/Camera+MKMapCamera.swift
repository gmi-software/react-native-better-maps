import MapKit

extension Camera {
  func toMKMapCamera() -> MKMapCamera {
    let coordinate = CLLocationCoordinate2D(
      latitude: center.latitude,
      longitude: center.longitude
    )

    let resolvedAltitude: CLLocationDistance
    if let altitude {
      resolvedAltitude = altitude
    } else if let zoom {
      resolvedAltitude = MapCameraMath.altitude(fromZoom: zoom, atLatitude: center.latitude)
    } else {
      resolvedAltitude = 1000
    }

    return MKMapCamera(
      lookingAtCenter: coordinate,
      fromDistance: resolvedAltitude,
      pitch: pitch ?? 0,
      heading: heading ?? 0
    )
  }
}

extension MKMapCamera {
  func approximatelyEquals(
    _ other: MKMapCamera,
    coordinateEpsilon: Double = MapApproximateEquality.coordinateEpsilon,
    distanceEpsilon: Double = MapApproximateEquality.distanceEpsilon,
    angleEpsilon: CLLocationDirection = MapApproximateEquality.angleEpsilon
  ) -> Bool {
    abs(centerCoordinate.latitude - other.centerCoordinate.latitude) < coordinateEpsilon
      && abs(centerCoordinate.longitude - other.centerCoordinate.longitude) < coordinateEpsilon
      && abs(centerCoordinateDistance - other.centerCoordinateDistance) < distanceEpsilon
      && abs(heading - other.heading) < angleEpsilon
      && abs(pitch - other.pitch) < angleEpsilon
  }

  func toCamera() -> Camera {
    let centerCoordinate = Coordinate(
      latitude: centerCoordinate.latitude,
      longitude: centerCoordinate.longitude
    )

    return Camera(
      center: centerCoordinate,
      zoom: MapCameraMath.zoom(
        fromAltitude: centerCoordinateDistance,
        atLatitude: centerCoordinate.latitude
      ),
      heading: heading,
      pitch: pitch,
      altitude: centerCoordinateDistance
    )
  }
}

enum MapCameraMath {
  private static let metersPerPixelAtEquatorZoom0 = 156_543.03392

  static func altitude(fromZoom zoom: Double, atLatitude latitude: Double) -> Double {
    let scale = pow(2.0, zoom)
    let metersPerPixel = metersPerPixelAtEquatorZoom0 * cos(latitude * .pi / 180.0) / scale
    // Approximate visible height for a typical phone viewport (~512 px).
    return metersPerPixel * 512.0
  }

  static func zoom(fromAltitude altitude: Double, atLatitude latitude: Double) -> Double {
    guard altitude > 0 else {
      return 0
    }

    let metersPerPixel = altitude / 512.0
    let scale = metersPerPixelAtEquatorZoom0 * cos(latitude * .pi / 180.0) / metersPerPixel
    return log2(scale)
  }
}

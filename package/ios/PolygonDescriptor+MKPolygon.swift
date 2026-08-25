import MapKit

extension PolygonDescriptor {
  func toMKPolygon() -> MKPolygon {
    let coordinates = coordinates.toCLLocationCoordinates()
    let interiorPolygons = holes?.map { hole in
      let coordinates = hole.toCLLocationCoordinates()
      return MKPolygon(coordinates: coordinates, count: coordinates.count)
    }
    return MKPolygon(
      coordinates: coordinates,
      count: coordinates.count,
      interiorPolygons: interiorPolygons
    )
  }
}

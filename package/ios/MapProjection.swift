import CoreLocation
import NitroModules
import UIKit

/// The checks behind every adapter's `pointForCoordinate` and `coordinateForPoint`, so each
/// provider only supplies its SDK's conversion - and decides when to run it.
///
/// Points cross unchanged: both SDKs convert in the map view's own coordinate space - UIKit points
/// from its top-left corner - and the map view fills the React Native view, whose layout is in
/// the same points. The JS side rejects the same input before a call is queued; these checks are
/// for a `hybridRef` call, which reaches the adapters directly.
enum MapProjection {
  /// Rejects a coordinate outside the world instead of converting it: MapKit answers one with a
  /// `NaN` point, or with a point past the antimeridian.
  static func point(
    for coordinate: Coordinate,
    convert: (CLLocationCoordinate2D) -> CGPoint
  ) throws -> Point {
    guard coordinate.isValid else {
      throw RuntimeError.error(
        withMessage: "Coordinate rejected: latitude and longitude must be finite and within ±90 / ±180"
      )
    }

    let point = convert(coordinate.toCLLocationCoordinate2D())
    return Point(x: Double(point.x), y: Double(point.y))
  }

  /// Rejects a point that is not finite, which MapKit converts to a `NaN` coordinate, and a
  /// point the SDK answers with an invalid coordinate: there is no ground under it.
  static func coordinate(
    at point: Point,
    convert: (CGPoint) -> CLLocationCoordinate2D
  ) throws -> Coordinate {
    guard point.x.isFinite, point.y.isFinite else {
      throw RuntimeError.error(withMessage: "Point rejected: x and y must be finite")
    }

    let coordinate = convert(CGPoint(x: point.x, y: point.y))
    guard CLLocationCoordinate2DIsValid(coordinate) else {
      throw RuntimeError.error(
        withMessage:
          "No coordinate at that point: the map shows no ground there, such as above the horizon of a steeply tilted map"
      )
    }

    return Coordinate(latitude: coordinate.latitude, longitude: coordinate.longitude)
  }
}

import MapKit

/// Annotation representing a computed cluster of markers.
///
/// Clusters are produced by `MarkerClusterEngine` on a background queue, so the
/// map view only ever receives a small, bounded number of annotations. Members
/// are kept as store handles; their ids are resolved on demand by
/// `getClusterMembers`.
final class MapClusterAnnotation: NSObject, MKAnnotation {
  var id: String
  var count: Int
  var memberHandles: [Int32]
  /// Region that frames this cluster's members, used for tap-to-zoom.
  var region: MKCoordinateRegion
  let enteringAnimation: ResolvedOverlayEnteringAnimation

  @objc dynamic var coordinate: CLLocationCoordinate2D

  init(
    id: String,
    coordinate: CLLocationCoordinate2D,
    count: Int,
    memberHandles: [Int32],
    region: MKCoordinateRegion,
    enteringAnimation: ResolvedOverlayEnteringAnimation
  ) {
    self.id = id
    self.coordinate = coordinate
    self.count = count
    self.memberHandles = memberHandles
    self.region = region
    self.enteringAnimation = enteringAnimation
  }

  func update(
    id: String,
    coordinate: CLLocationCoordinate2D,
    count: Int,
    memberHandles: [Int32],
    region: MKCoordinateRegion
  ) {
    self.id = id
    self.coordinate = coordinate
    self.count = count
    self.memberHandles = memberHandles
    self.region = region
  }
}

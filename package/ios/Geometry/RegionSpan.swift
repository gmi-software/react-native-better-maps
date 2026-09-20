import Foundation

/// The span half of a region, which `CLLocationCoordinate2DIsValid` says nothing about.
enum RegionSpan {
  /// A span has to cover an area: a `NaN` or non-positive delta collapses the
  /// region, and on Android the halved deltas would put the southern edge above
  /// the northern one, which `LatLngBounds` rejects.
  static func isDrawable(latitudeDelta: Double, longitudeDelta: Double) -> Bool {
    latitudeDelta.isFinite
      && latitudeDelta > 0
      && longitudeDelta.isFinite
      && longitudeDelta > 0
  }
}

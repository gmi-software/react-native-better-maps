import Foundation

/// How far a cluster press zooms: the span the camera fits on one axis, given
/// how far the cluster's members spread on it. Android does the same in
/// `LatLngBounds+ClusterZoom.kt`, so a press frames a cluster alike everywhere.
enum ClusterZoomSpan {
  /// Room around the outermost members, so they don't land on the map's edge.
  static let paddingFactor = 1.6

  /// The smallest span in degrees, about a kilometre: members stacked on one
  /// coordinate spread over nothing, and fitting that would zoom to the maximum.
  static let minimumDelta = 0.01

  static func delta(min: Double, max: Double) -> Double {
    Swift.max((max - min) * paddingFactor, minimumDelta)
  }
}

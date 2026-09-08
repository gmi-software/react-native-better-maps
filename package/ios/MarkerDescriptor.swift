/// Marker data as the native store holds it.
///
/// Nitrogen used to generate these structs from the `markers` view prop. Markers
/// now reach native code as packed batches (see `MarkerBatchDecoder`), so no
/// spec references them and they live here instead. Field names and types
/// match the TypeScript `MarkerDescriptor`. Should a Nitro spec reference
/// `MarkerDescriptor` again, nitrogen would generate a conflicting type and
/// this file has to go.
struct MarkerImage {
  var uri: String
  var width: Double?
  var height: Double?
  var scale: Double?
}

/// Anchor point on the marker image (0..1).
struct MarkerAnchor {
  var x: Double
  var y: Double
}

/// Point offset in density-independent pixels.
struct MarkerPoint {
  var x: Double
  var y: Double
}

struct MarkerDescriptor {
  var id: String
  var coordinate: Coordinate
  var title: String?
  var subtitle: String?
  var draggable: Bool?
  var clusterable: Bool?
  var image: MarkerImage?
  var anchor: MarkerAnchor?
  var centerOffset: MarkerPoint?
  var rotation: Double?
  var flat: Bool?
  var opacity: Double?
  var enteringAnimation: OverlayEnteringAnimationDescriptor?
}

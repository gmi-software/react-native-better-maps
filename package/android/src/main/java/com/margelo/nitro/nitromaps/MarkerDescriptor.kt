package com.margelo.nitro.nitromaps

/**
 * Marker data as the native store holds it.
 *
 * Nitrogen used to generate these classes from the `markers` view prop. Markers
 * now reach native code as packed batches (see [MarkerBatchDecoder]), so no
 * spec references them and they live here instead. Field names and types match
 * the TypeScript `MarkerDescriptor`. Should a Nitro spec reference
 * `MarkerDescriptor` again, nitrogen would generate a conflicting class and
 * this file has to go.
 */
data class MarkerImage(
  val uri: String,
  val width: Double?,
  val height: Double?,
  val scale: Double?,
)

/** Anchor point on the marker image (0..1). */
data class MarkerAnchor(
  val x: Double,
  val y: Double,
)

/** Point offset in density-independent pixels. */
data class MarkerPoint(
  val x: Double,
  val y: Double,
)

data class MarkerDescriptor(
  val id: String,
  val coordinate: Coordinate,
  val title: String?,
  val subtitle: String?,
  val draggable: Boolean?,
  val clusterable: Boolean?,
  val image: MarkerImage?,
  val anchor: MarkerAnchor?,
  val centerOffset: MarkerPoint?,
  val rotation: Double?,
  val flat: Boolean?,
  val opacity: Double?,
  val enteringAnimation: OverlayEnteringAnimationDescriptor?,
)

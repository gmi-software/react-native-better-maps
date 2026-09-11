package com.margelo.nitro.nitromaps

internal fun marker(
  id: String = "marker-1",
  customViewId: String? = null,
  image: MarkerImage? = null,
  markerColor: String? = null,
  anchor: MarkerAnchor? = null,
  centerOffset: MarkerPoint? = null,
  rotation: Double? = null,
  flat: Boolean? = null,
  opacity: Double? = null,
  zIndex: Double? = null,
  enteringAnimation: OverlayEnteringAnimationDescriptor? = null,
): MarkerDescriptor {
  return MarkerDescriptor(
    id,
    customViewId,
    Coordinate(37.77, -122.41),
    "Title",
    "Subtitle",
    false,
    true,
    image,
    markerColor,
    anchor,
    centerOffset,
    rotation,
    flat,
    opacity,
    zIndex,
    enteringAnimation,
  )
}

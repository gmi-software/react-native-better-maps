package com.margelo.nitro.nitromaps

internal fun marker(
  id: String = "marker-1",
  image: MarkerImage? = null,
  anchor: MarkerAnchor? = null,
  centerOffset: MarkerPoint? = null,
  rotation: Double? = null,
  flat: Boolean? = null,
  opacity: Double? = null,
  enteringAnimation: OverlayEnteringAnimationDescriptor? = null,
): MarkerDescriptor {
  return MarkerDescriptor(
    id,
    Coordinate(37.77, -122.41),
    "Title",
    "Subtitle",
    false,
    true,
    image,
    anchor,
    centerOffset,
    rotation,
    flat,
    opacity,
    enteringAnimation,
  )
}

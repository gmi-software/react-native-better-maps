package com.margelo.nitro.nitromaps

internal fun marker(
  id: String = "marker-1",
  coordinate: Coordinate = Coordinate(37.77, -122.41),
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
  // Named arguments on purpose: MarkerDescriptor is generated from
  // package/src/native/specs/overlays.ts, so reordering a field there silently
  // shifts every positional argument after it.
  return MarkerDescriptor(
    id = id,
    coordinate = coordinate,
    title = "Title",
    subtitle = "Subtitle",
    draggable = false,
    clusterable = true,
    image = image,
    markerColor = markerColor,
    zIndex = zIndex,
    anchor = anchor,
    centerOffset = centerOffset,
    rotation = rotation,
    flat = flat,
    opacity = opacity,
    enteringAnimation = enteringAnimation,
  )
}

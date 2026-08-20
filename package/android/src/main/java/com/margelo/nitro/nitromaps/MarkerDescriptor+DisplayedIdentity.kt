package com.margelo.nitro.nitromaps

/** Displayed-marker identity. Omits `enteringAnimation`; keep in sync with the Swift hasher. */
internal fun MarkerDescriptor.displayedIdentityVersion(): Long =
  renderSignature(
    id,
    coordinate.latitude,
    coordinate.longitude,
    title,
    subtitle,
    draggable,
    clusterable,
    image?.uri,
    image?.width,
    image?.height,
    image?.scale,
    anchor?.x,
    anchor?.y,
    centerOffset?.x,
    centerOffset?.y,
    rotation,
    flat,
    opacity,
  )

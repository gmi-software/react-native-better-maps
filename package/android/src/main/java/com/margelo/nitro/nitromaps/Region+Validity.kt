package com.margelo.nitro.nitromaps

/** A `NaN` or non-positive span puts the southern edge above the northern one, which `LatLngBounds` rejects. */
internal fun Region.isValid(): Boolean =
  isValidCoordinate(latitude, longitude) &&
    latitudeDelta.isFinite() &&
    latitudeDelta > 0.0 &&
    longitudeDelta.isFinite() &&
    longitudeDelta > 0.0

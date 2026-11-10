package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.GoogleMap

/**
 * Converts the cross-platform map type to Google Maps' native type. `mutedStandard` is Apple-only
 * and falls back to the normal map.
 */
fun MapType.toGoogleMapType(): Int =
  when (this) {
    MapType.STANDARD,
    MapType.MUTEDSTANDARD -> GoogleMap.MAP_TYPE_NORMAL
    MapType.SATELLITE -> GoogleMap.MAP_TYPE_SATELLITE
    MapType.HYBRID -> GoogleMap.MAP_TYPE_HYBRID
    MapType.TERRAIN -> GoogleMap.MAP_TYPE_TERRAIN
  }

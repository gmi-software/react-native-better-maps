package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import kotlin.math.PI
import kotlin.math.atan
import kotlin.math.cos
import kotlin.math.ln
import kotlin.math.min
import kotlin.math.sinh
import kotlin.math.tan

/** Latitude where the Web Mercator projection Google Maps uses is cut off. */
private const val MAX_MERCATOR_LATITUDE = 85.05112877980659

/**
 * Grows the bounds so that fitting the result into the whole map leaves [padding] free on
 * each edge, the way `setVisibleMapRect(_:edgePadding:)` does on iOS.
 *
 * [CameraUpdateFactory.newLatLngBounds][com.google.android.gms.maps.CameraUpdateFactory]
 * takes one padding value for all four edges, so asymmetric insets cannot be handed to it.
 * Handing them to [GoogleMap.setPadding][com.google.android.gms.maps.GoogleMap.setPadding]
 * for the duration of the fit does not work either: padding carries the camera with it —
 * 100 px of left padding shifts the centre 50 px to the right — so restoring the previous
 * padding afterwards would take the offset straight back out.
 *
 * Both insets of an axis therefore go into the bounds themselves, converted from pixels at
 * the scale the fit is about to pick. That scale is what makes this exact rather than an
 * approximation: fitting the grown bounds edge to edge picks the same zoom as fitting the
 * original ones into the box [padding] leaves over, and centres them half the difference
 * between the opposing insets away from the middle.
 *
 * [mapPadding] is only subtracted from the viewport, never folded in. Google Maps fits
 * bounds inside the region its own padding leaves over and centres them there already, so
 * adding it here would count it twice.
 *
 * Returns null when the caller should just fit the bounds it has: when there are no
 * [padding] insets, when they fill the viewport, or for bounds without extent on either
 * axis (every coordinate in one spot), which the SDK fits at its maximum zoom rather than
 * at a scale these bounds imply.
 */
internal fun LatLngBounds.expandedForEdgePadding(
  padding: EdgePaddingPixels?,
  mapPadding: EdgePaddingPixels?,
  viewportWidthPx: Int,
  viewportHeightPx: Int,
): LatLngBounds? {
  if (padding == null || padding.isEmpty) {
    return null
  }

  val contentWidth = viewportWidthPx - padding.horizontal - (mapPadding?.horizontal ?: 0L)
  val contentHeight = viewportHeightPx - padding.vertical - (mapPadding?.vertical ?: 0L)
  if (contentWidth <= 0 || contentHeight <= 0) {
    return null
  }

  // Bounds that cross the antimeridian read back as an east edge west of the west edge.
  val rawLongitudeSpan = northeast.longitude - southwest.longitude
  val longitudeSpan = if (rawLongitudeSpan < 0.0) rawLongitudeSpan + 360.0 else rawLongitudeSpan
  val northEdge = mercatorY(northeast.latitude)
  val southEdge = mercatorY(southwest.latitude)

  // Pixels per projected unit, on whichever axis runs out of room first.
  val horizontalScale =
    if (longitudeSpan > 0.0) contentWidth / (longitudeSpan / 360.0) else Double.POSITIVE_INFINITY
  val verticalScale =
    if (southEdge > northEdge) contentHeight / (southEdge - northEdge) else Double.POSITIVE_INFINITY
  val scale = min(horizontalScale, verticalScale)
  if (!scale.isFinite() || scale <= 0.0) {
    return null
  }

  val grownLongitudeSpan = longitudeSpan + padding.horizontal / scale * 360.0
  if (grownLongitudeSpan >= 360.0) {
    return null
  }

  // `LatLng` wraps a longitude past ±180 back into range, which is what bounds growing
  // across the antimeridian need.
  return LatLngBounds(
    LatLng(
      latitudeAtMercatorY((southEdge + padding.bottom / scale).coerceAtMost(1.0)),
      southwest.longitude - padding.left / scale * 360.0,
    ),
    LatLng(
      latitudeAtMercatorY((northEdge - padding.top / scale).coerceAtLeast(0.0)),
      northeast.longitude + padding.right / scale * 360.0,
    ),
  )
}

/** Web Mercator y in `0.0..1.0`, 0 at the northern edge of the projection and 1 at the southern. */
private fun mercatorY(latitude: Double): Double {
  val radians = latitude.coerceIn(-MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE) * PI / 180.0
  return (1.0 - ln(tan(radians) + 1.0 / cos(radians)) / PI) / 2.0
}

private fun latitudeAtMercatorY(y: Double): Double = atan(sinh(PI * (1.0 - 2.0 * y))) * 180.0 / PI

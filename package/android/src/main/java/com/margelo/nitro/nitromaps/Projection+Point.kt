package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.Projection
import com.google.android.gms.maps.model.LatLng
import kotlin.math.roundToInt
import android.graphics.Point as PixelPoint

/**
 * Where the map draws [coordinate], in density-independent pixels from the top-left corner of the
 * map view. `toScreenLocation` measures from that same corner, in whole device pixels.
 */
internal fun Projection.pointFor(
  coordinate: Coordinate,
  density: Float,
): Point {
  val pixel = toScreenLocation(LatLng(coordinate.latitude, coordinate.longitude))
  return Point(x = pixelsToDp(pixel.x, density), y = pixelsToDp(pixel.y, density))
}

/**
 * The coordinate under [point], given in density-independent pixels from the top-left corner of the
 * map view, or `null` where the map shows no ground.
 */
internal fun Projection.coordinateAt(
  point: Point,
  density: Float,
): Coordinate? {
  // Typed nullable on purpose: the SDK annotates the result `@NonNull`, yet documents `null` for a
  // point whose ray misses the ground - above the horizon of a steeply tilted map - and Kotlin
  // would otherwise take the annotation at its word.
  val latLng: LatLng? = fromScreenLocation(PixelPoint(dpToPixels(point.x, density), dpToPixels(point.y, density)))
  return latLng?.toCoordinate()
}

/** Both axes finite. A point outside the map view still converts: it stands for somewhere just off screen. */
internal fun Point.isValid(): Boolean = x.isFinite() && y.isFinite()

/**
 * The whole device pixel nearest to [dp], which has to be finite.
 *
 * A [Point] is in the density-independent pixels React Native lays the map view out in - the unit
 * `CGPoint` has on iOS - while `Projection` counts device pixels. A value past the `Int` range
 * saturates at its edge instead of wrapping.
 */
internal fun dpToPixels(
  dp: Double,
  density: Float,
): Int = (dp * density).roundToInt()

/** The reverse of [dpToPixels], for the device pixels `toScreenLocation` answers in. */
internal fun pixelsToDp(
  pixels: Int,
  density: Float,
): Double = pixels / density.toDouble()

package com.margelo.nitro.nitromaps

// Named arguments on purpose, as in MarkerDescriptorFixture.kt: the descriptors
// are generated from package/src/native/specs/overlays.ts, so reordering a field
// there silently shifts every positional argument after it.

internal val ROUTE = arrayOf(Coordinate(52.2297, 21.0122), Coordinate(52.237, 21.017))
internal val HOLE = arrayOf(Coordinate(52.231, 21.014), Coordinate(52.232, 21.015), Coordinate(52.2315, 21.016))

internal fun polylineDescriptor(
  id: String = "route",
  coordinates: Array<Coordinate> = ROUTE,
  strokeColor: String? = "#FF0000",
  strokeWidth: Double? = 4.0,
  zIndex: Double? = 1.0,
  tappable: Boolean? = true,
) = PolylineDescriptor(
  id = id,
  coordinates = coordinates,
  strokeColor = strokeColor,
  strokeWidth = strokeWidth,
  zIndex = zIndex,
  tappable = tappable,
)

internal fun polygonDescriptor(
  id: String = "district",
  coordinates: Array<Coordinate> = ROUTE,
  holes: Array<Array<Coordinate>>? = null,
  fillColor: String? = "#007AFF33",
  strokeColor: String? = "#007AFF",
  strokeWidth: Double? = 2.0,
  zIndex: Double? = 1.0,
  tappable: Boolean? = false,
) = PolygonDescriptor(
  id = id,
  coordinates = coordinates,
  holes = holes,
  fillColor = fillColor,
  strokeColor = strokeColor,
  strokeWidth = strokeWidth,
  zIndex = zIndex,
  tappable = tappable,
)

internal fun circleDescriptor(
  id: String = "radius",
  center: Coordinate = Coordinate(52.22, 21.01),
  radius: Double = 800.0,
  fillColor: String? = "#34C75933",
  strokeColor: String? = "#34C759",
  strokeWidth: Double? = 2.0,
  tappable: Boolean? = true,
) = CircleDescriptor(
  id = id,
  center = center,
  radius = radius,
  fillColor = fillColor,
  strokeColor = strokeColor,
  strokeWidth = strokeWidth,
  tappable = tappable,
)

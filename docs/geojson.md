# GeoJSON overlays

`Geojson` renders a GeoJSON object as existing map overlays. Conversion happens in JavaScript and reuses the marker, polyline, and polygon descriptor pipeline on iOS and Android.

## Supported geometry

| GeoJSON type         | Overlay                          |
| -------------------- | -------------------------------- |
| `Point`              | `Marker`                         |
| `MultiPoint`         | One `Marker` per position        |
| `LineString`         | `Polyline`                       |
| `MultiLineString`    | One `Polyline` per line          |
| `Polygon`            | `Polygon` from the exterior ring |
| `MultiPolygon`       | One `Polygon` per part           |
| `Feature`            | Inner geometry                   |
| `FeatureCollection`  | Each feature                     |
| `GeometryCollection` | Each nested geometry             |

Coordinates are `[longitude, latitude]`. A third value (altitude) is ignored.

## Style

Component props supply defaults. Feature `properties` override them using simplestyle names:

| Property         | Applies to    | Notes                          |
| ---------------- | ------------- | ------------------------------ |
| `stroke`         | Line, polygon | Hex color                      |
| `stroke-width`   | Line, polygon | Density-independent pixels     |
| `stroke-opacity` | Line, polygon | Replaces alpha on hex `stroke` |
| `fill`           | Polygon       | Hex color                      |
| `fill-opacity`   | Polygon       | Replaces alpha on hex `fill`   |
| `title` / `name` | Point         | Marker title                   |

Colors follow the library-wide format: `#RGB`, `#RGBA`, `#RRGGBB`, or `#RRGGBBAA` with alpha last. Opacity properties replace the color's alpha, so `fill: '#34C75980'` with `fill-opacity: 0.25` becomes `#34C75940`. Non-hex colors are left unchanged.

`onPress` receives the original `GeojsonFeature`, including `properties`.

## Limits

- Prefer `geojsonToOverlayDescriptors` plus bulk `MapView` overlay props above about 1000 generated overlays.
- Interior polygon rings (holes) are ignored until native hole support exists.
- Point styling is limited to title text; pin color and custom marker views are not applied.
- TopoJSON is not parsed. Convert it to GeoJSON first.
- Invalid GeoJSON does not throw. It is skipped with a development warning.

## Bulk conversion

```tsx
import { MapView, geojsonToOverlayDescriptors } from 'react-native-better-maps';

const overlays = geojsonToOverlayDescriptors(deliveryZones, {
  strokeColor: '#FF3B30',
  fillColor: '#FF3B3044',
  strokeWidth: 2,
});

export function DeliveryZonesMap() {
  return (
    <MapView
      markers={overlays.markers}
      polylines={overlays.polylines}
      polygons={overlays.polygons}
      onPolygonPress={(id) => {
        console.log(overlays.featuresByOverlayId[id]?.properties);
      }}
    />
  );
}
```

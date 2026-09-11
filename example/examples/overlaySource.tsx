import {
  Geojson,
  type Coordinate,
  type MapViewProps,
} from 'react-native-better-maps';
import type { MapScenario } from './types';

type ScenarioOverlayProps = Pick<
  MapViewProps,
  | 'markers'
  | 'polylines'
  | 'polygons'
  | 'circles'
  | 'children'
  | 'onMarkerPress'
  | 'onMarkerDragEnd'
  | 'onPolylinePress'
  | 'onPolygonPress'
  | 'onCirclePress'
>;

export function createScenarioOverlayProps(
  scenario: MapScenario,
  onMarkerPress: (id: string) => void,
  onMarkerDragEnd: (id: string, coordinate: Coordinate) => void,
  onOverlayPress: (label: string) => void,
): ScenarioOverlayProps {
  const geojson = scenario.geojson;

  return {
    markers: scenario.markers,
    polylines: scenario.polylines,
    polygons: scenario.polygons,
    circles: scenario.circles,
    children:
      geojson == null ? undefined : (
        <Geojson
          id={scenario.id}
          geojson={geojson}
          strokeColor={scenario.geojsonStyle?.strokeColor}
          fillColor={scenario.geojsonStyle?.fillColor}
          strokeWidth={scenario.geojsonStyle?.strokeWidth}
          onPress={(feature) => {
            const name = feature.properties?.name;
            onOverlayPress(typeof name === 'string' ? name : 'GeoJSON feature');
          }}
        />
      ),
    onMarkerPress: scenario.markers != null ? onMarkerPress : undefined,
    onMarkerDragEnd: scenario.markers != null ? onMarkerDragEnd : undefined,
    onPolylinePress: scenario.polylines != null ? onOverlayPress : undefined,
    onPolygonPress: scenario.polygons != null ? onOverlayPress : undefined,
    onCirclePress: scenario.circles != null ? onOverlayPress : undefined,
  };
}

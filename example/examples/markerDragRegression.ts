import markerRed from '../assets/markerred.png';
import type { MapScenario } from './types';

export const MARKER_DRAG_REGRESSION_SCENARIO_ID = 'marker-drag-regression';

export const markerDragRegressionScenario: MapScenario = {
  id: MARKER_DRAG_REGRESSION_SCENARIO_ID,
  name: 'Marker drag regression',
  description: 'Simulator test fixture for pin and image marker dragging',
  region: {
    latitude: 52.2297,
    longitude: 21.0122,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  },
  markers: [
    {
      id: 'pin',
      coordinate: { latitude: 52.2201, longitude: 20.9962 },
      title: 'Draggable pin',
      draggable: true,
      enteringAnimation: false,
    },
    {
      id: 'image',
      coordinate: { latitude: 52.2201, longitude: 21.0282 },
      title: 'Draggable image',
      image: markerRed,
      anchor: { x: 0.5, y: 1 },
      draggable: true,
      enteringAnimation: false,
    },
  ],
};

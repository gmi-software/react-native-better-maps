import type { GeojsonFeatureCollection } from 'react-native-better-maps';
import deliveryZonesJson from './data/delivery-zones.json';
import type { MapScenario } from './types';

const deliveryZones = deliveryZonesJson as GeojsonFeatureCollection;

/** Mixed GeoJSON FeatureCollection: polygons, a route, and pickup points. */
export const geojsonScenario: MapScenario = {
  id: 'geojson',
  name: 'GeoJSON',
  description: 'Delivery zones from a bundled FeatureCollection',
  region: {
    latitude: 52.2297,
    longitude: 21.0,
    latitudeDelta: 0.06,
    longitudeDelta: 0.06,
  },
  geojson: deliveryZones,
  geojsonStyle: {
    strokeColor: '#FF3B30',
    fillColor: '#FF3B3044',
    strokeWidth: 2,
  },
};

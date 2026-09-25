import type { MapScenario } from './types';

/**
 * Starts tight on one city while the markers span the whole country, so the
 * mount-effect `fitToCoordinates` is unmistakable either way. The status header
 * reports how its promise settled.
 */
export const mountEffectCameraScenario: MapScenario = {
  id: 'mount-effect-camera',
  name: 'Fit on mount',
  description: 'fitToCoordinates from a mount effect, with the promise result',
  region: {
    latitude: 52.2297,
    longitude: 21.0122,
    latitudeDelta: 0.06,
    longitudeDelta: 0.06,
  },
  markers: [
    {
      id: 'gdansk',
      coordinate: { latitude: 54.352, longitude: 18.6466 },
      title: 'Gdańsk',
      subtitle: 'North',
    },
    {
      id: 'szczecin',
      coordinate: { latitude: 53.4285, longitude: 14.5528 },
      title: 'Szczecin',
      subtitle: 'West',
    },
    {
      id: 'rzeszow',
      coordinate: { latitude: 50.0413, longitude: 21.999 },
      title: 'Rzeszów',
      subtitle: 'South east',
    },
    {
      id: 'wroclaw',
      coordinate: { latitude: 51.1079, longitude: 17.0385 },
      title: 'Wrocław',
      subtitle: 'South west',
    },
  ],
  advanced: {
    fitToCoordinatesOnMount: true,
  },
};

import type { MapScenario } from './types';

export const CAMERA_TIMING_SCENARIO_ID = 'camera-timing';

/**
 * Buttons for `animateCamera` at 250 ms and 2000 ms and for `fitToCoordinates`
 * without `animated`, so iOS and Android can be compared side by side. The
 * status header reports how long each promise took to settle.
 */
export const cameraTimingScenario: MapScenario = {
  id: CAMERA_TIMING_SCENARIO_ID,
  name: 'Camera timing',
  description:
    'animateCamera at 250 ms and 2000 ms, and fitToCoordinates without animated',
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
    },
    {
      id: 'szczecin',
      coordinate: { latitude: 53.4285, longitude: 14.5528 },
      title: 'Szczecin',
    },
    {
      id: 'rzeszow',
      coordinate: { latitude: 50.0413, longitude: 21.999 },
      title: 'Rzeszów',
    },
  ],
};

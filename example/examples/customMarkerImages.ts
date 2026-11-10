import { Image } from 'react-native';
import markerBlue from '../assets/markerblue.png';
import markerGreen from '../assets/markergreen.png';
import markerRed from '../assets/markerred.png';
import markerViolet from '../assets/markerviolet.png';
import poiNavigation from '../assets/poiNavigation.png';
import poiRestaurant from '../assets/poiRestaurant.png';
import poiStar from '../assets/poiStar.png';
import type { MapScenario } from './types';

// A bundled require() asset always resolves; React Native 0.88 still types the
// result as `| undefined`.
const markerRedSource = Image.resolveAssetSource(markerRed)!;

/** Leaflet Color Markers — logical size 25×41 dp (@2x bitmaps). */
const LEAFLET_MARKER = {
  width: 25,
  height: 41,
  scale: 2,
} as const;

const LEAFLET_BASE =
  'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img';

const PIN_ANCHOR = { x: 0.5, y: 1 } as const;

export interface CustomMarkerImagesOptions {
  rotation: number;
  flat: boolean;
}

const BASE = {
  latitude: 52.2297,
  longitude: 21.0122,
};

export function createCustomMarkerImagesScenario(
  options: CustomMarkerImagesOptions,
): MapScenario {
  const { latitude, longitude } = BASE;
  const latStep = 0.0065;
  const lngStep = 0.011;

  return {
    id: 'custom-marker-images',
    name: 'Custom markers',
    description:
      'Leaflet pins, Icons8 POI, anchors, rotation, flat, opacity, centerOffset & remote URL',
    region: {
      latitude,
      longitude,
      latitudeDelta: 0.045,
      longitudeDelta: 0.055,
    },
    advanced: {
      fitToCoordinatesOnReady: true,
    },
    markers: [
      {
        id: 'default-pin',
        coordinate: {
          latitude: latitude + latStep * 2.2,
          longitude: longitude - lngStep * 1.5,
        },
        title: 'Default pin',
        subtitle: 'Platform marker · no image prop',
      },
      {
        id: 'bundled-pin',
        coordinate: {
          latitude: latitude + latStep * 2.2,
          longitude,
        },
        title: 'Bundled asset',
        subtitle: 'Leaflet red pin · bundled asset',
        image: markerRed,
        anchor: PIN_ANCHOR,
      },
      {
        id: 'remote-pin',
        coordinate: {
          latitude: latitude + latStep * 2.2,
          longitude: longitude + lngStep * 1.5,
        },
        title: 'Remote URL',
        subtitle: 'Leaflet gold pin · async fetch',
        image: {
          uri: `${LEAFLET_BASE}/marker-icon-2x-gold.png`,
          ...LEAFLET_MARKER,
        },
        anchor: PIN_ANCHOR,
      },

      {
        id: 'anchor-bottom',
        coordinate: {
          latitude: latitude + latStep * 0.6,
          longitude: longitude - lngStep * 1.5,
        },
        title: 'Anchor bottom',
        subtitle: '{ x: 0.5, y: 1 } · tip on coordinate',
        image: markerBlue,
        anchor: PIN_ANCHOR,
      },
      {
        id: 'anchor-center',
        coordinate: {
          latitude: latitude + latStep * 0.6,
          longitude,
        },
        title: 'Anchor center',
        subtitle: '{ x: 0.5, y: 0.5 } · Icons8 star badge',
        image: poiStar,
        anchor: { x: 0.5, y: 0.5 },
      },
      {
        id: 'anchor-top-left',
        coordinate: {
          latitude: latitude + latStep * 0.6,
          longitude: longitude + lngStep * 1.5,
        },
        title: 'Anchor top-left',
        subtitle: '{ x: 0, y: 0 } · corner on coordinate',
        image: markerGreen,
        anchor: { x: 0, y: 0 },
      },

      {
        id: 'rotated-pin',
        coordinate: {
          latitude: latitude - latStep * 0.9,
          longitude: longitude - lngStep * 1.5,
        },
        title: 'Rotation',
        subtitle: `${options.rotation.toFixed(0)}° · use dock ↻ to cycle`,
        image: poiNavigation,
        anchor: { x: 0.5, y: 0.5 },
        rotation: options.rotation,
        flat: false,
      },
      {
        id: 'flat-pin',
        coordinate: {
          latitude: latitude - latStep * 0.9,
          longitude,
        },
        title: 'Flat mode',
        subtitle: options.flat
          ? 'flat on · rotates with map (Android)'
          : 'flat off · screen-aligned',
        image: {
          uri: `${LEAFLET_BASE}/marker-icon-2x-orange.png`,
          ...LEAFLET_MARKER,
        },
        anchor: PIN_ANCHOR,
        rotation: 45,
        flat: options.flat,
      },
      {
        id: 'faded-pin',
        coordinate: {
          latitude: latitude - latStep * 0.9,
          longitude: longitude + lngStep * 1.5,
        },
        title: 'Opacity',
        subtitle: 'opacity 0.45 · Leaflet violet',
        image: markerViolet,
        anchor: PIN_ANCHOR,
        opacity: 0.45,
      },

      {
        id: 'offset-pin',
        coordinate: {
          latitude: latitude - latStep * 2.4,
          longitude: longitude - lngStep * 1.5,
        },
        title: 'Center offset',
        subtitle: 'centerOffset { x: 0, y: -18 } dp',
        image: poiRestaurant,
        anchor: { x: 0.5, y: 0.5 },
        centerOffset: { x: 0, y: -18 },
      },
      {
        id: 'draggable-pin',
        coordinate: {
          latitude: latitude - latStep * 2.4,
          longitude,
        },
        title: 'Draggable',
        subtitle: 'Long-press & drag this pin',
        image: markerRed,
        anchor: PIN_ANCHOR,
        draggable: true,
      },
      {
        id: 'scaled-pin',
        coordinate: {
          latitude: latitude - latStep * 2.4,
          longitude: longitude + lngStep * 1.5,
        },
        title: 'Explicit size',
        subtitle: 'width/height 37×61 dp (1.5×)',
        image: {
          uri: markerRedSource.uri,
          width: 37,
          height: 61,
          scale: markerRedSource.scale,
        },
        anchor: PIN_ANCHOR,
      },
    ],
  };
}

export const customMarkerImagesScenario = createCustomMarkerImagesScenario({
  rotation: 45,
  flat: true,
});

export const CUSTOM_MARKER_IMAGES_SCENARIO_ID = customMarkerImagesScenario.id;

import type { Camera, Region } from 'react-native-better-maps';

export interface BoundingBox {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

/** Approximate mainland Poland bounding box; all fixtures live inside it. */
export const POLAND_BOUNDS: BoundingBox = {
  minLatitude: 49.002,
  maxLatitude: 54.835,
  minLongitude: 14.123,
  maxLongitude: 24.145,
};

/** Warsaw at city scale: the marker fixtures have their densest hotspot here. */
export const WARSAW_REGION: Region = {
  latitude: 52.2297,
  longitude: 21.0122,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

/** Whole country: clusters form and re-form as the zoom sweeps across octaves. */
export const POLAND_REGION: Region = {
  latitude: 51.92,
  longitude: 19.13,
  latitudeDelta: 6.2,
  longitudeDelta: 10.5,
};

export const WARSAW_CENTER = { latitude: 52.2297, longitude: 21.0122 };
export const POLAND_CENTER = { latitude: 51.92, longitude: 19.13 };

export function cameraAt(
  center: { latitude: number; longitude: number },
  overrides: Partial<Omit<Camera, 'center'>> = {},
): Camera {
  return {
    center,
    zoom: 12,
    heading: 0,
    pitch: 0,
    ...overrides,
  };
}

export const WARSAW_CAMERA = cameraAt(WARSAW_CENTER, { zoom: 12 });
export const POLAND_CAMERA = cameraAt(POLAND_CENTER, { zoom: 6 });

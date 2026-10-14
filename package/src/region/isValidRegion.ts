import type { Region } from '../types/region';
import { isValidCoordinate } from '../utils/validateGeometry';

export function isValidRegion(value: Region | undefined): boolean {
  return (
    value != null &&
    isValidCoordinate({
      latitude: value.latitude,
      longitude: value.longitude,
    }) &&
    Number.isFinite(value.latitudeDelta) &&
    value.latitudeDelta > 0 &&
    Number.isFinite(value.longitudeDelta) &&
    value.longitudeDelta > 0
  );
}

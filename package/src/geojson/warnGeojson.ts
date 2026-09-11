export function warnGeojson(message: string): void {
  if ((globalThis as { __DEV__?: boolean }).__DEV__ !== true) {
    return;
  }

  console.warn(`[react-native-better-maps] Geojson: ${message}`);
}

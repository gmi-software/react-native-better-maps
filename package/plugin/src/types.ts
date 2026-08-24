export type BetterMapsPluginOptions = {
  /**
   * Shared Google Maps API key for both platforms when platform-specific keys are omitted.
   * When set on iOS, links the Google Maps iOS SDK via Podfile.properties.json.
   */
  googleMapsApiKey?: string;
  /**
   * Google Maps API key for iOS (`GoogleMapsIosApiKey` in Info.plist).
   * When set, also writes `betterMaps.iosGoogleProvider` to Podfile.properties.json
   * so the Google Maps iOS SDK is linked during `pod install`.
   */
  iosGoogleMapsApiKey?: string;
  /**
   * Google Maps API key for Android (`com.google.android.geo.API_KEY` meta-data).
   * Does not enable the Google Maps iOS SDK.
   */
  androidGoogleMapsApiKey?: string;
  /**
   * When set to a string, adds `NSLocationWhenInUseUsageDescription` on iOS and
   * `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION` on Android.
   * Pass `false` or omit to skip.
   */
  locationPermission?: string | false;
  /**
   * When set to a string, adds `NSLocationAlwaysAndWhenInUseUsageDescription` on iOS and
   * `ACCESS_BACKGROUND_LOCATION` on Android.
   * Pass `false` or omit to skip.
   */
  locationAlwaysPermission?: string | false;
};

export function wantsWhenInUseLocation(
  options: BetterMapsPluginOptions,
): options is BetterMapsPluginOptions & { locationPermission: string } {
  return typeof options.locationPermission === 'string';
}

export function wantsAlwaysLocation(
  options: BetterMapsPluginOptions,
): options is BetterMapsPluginOptions & { locationAlwaysPermission: string } {
  return typeof options.locationAlwaysPermission === 'string';
}

export function requiresForegroundLocation(
  options: BetterMapsPluginOptions,
): boolean {
  return wantsWhenInUseLocation(options) || wantsAlwaysLocation(options);
}

function normalizeApiKey(value: string | undefined): string | undefined {
  if (value == null) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function resolveIosGoogleMapsApiKey(
  options: BetterMapsPluginOptions,
): string | undefined {
  return (
    normalizeApiKey(options.iosGoogleMapsApiKey) ??
    normalizeApiKey(options.googleMapsApiKey)
  );
}

export function resolveAndroidGoogleMapsApiKey(
  options: BetterMapsPluginOptions,
): string | undefined {
  return (
    normalizeApiKey(options.androidGoogleMapsApiKey) ??
    normalizeApiKey(options.googleMapsApiKey)
  );
}

export function shouldEnableIosGoogleMapsProvider(
  options: BetterMapsPluginOptions,
): boolean {
  return resolveIosGoogleMapsApiKey(options) != null;
}

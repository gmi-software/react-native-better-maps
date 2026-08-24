import {
  ConfigPlugin,
  IOSConfig,
  withInfoPlist,
  withPodfileProperties,
} from '@expo/config-plugins';

import {
  type BetterMapsPluginOptions,
  requiresForegroundLocation,
  resolveIosGoogleMapsApiKey,
  shouldEnableIosGoogleMapsProvider,
  wantsAlwaysLocation,
  wantsWhenInUseLocation,
} from './types';

type InfoPlist = IOSConfig.InfoPlist;
type PodfileProperties = Record<string, string>;

export const IOS_GOOGLE_MAPS_API_KEY = 'GoogleMapsIosApiKey';
/** Must match the Podfile.properties.json key in `react-native-better-maps.podspec`. */
export const IOS_GOOGLE_PROVIDER_PODFILE_PROPERTY =
  'betterMaps.iosGoogleProvider';

export function applyGoogleMapsIosApiKey(
  infoPlist: InfoPlist,
  apiKey: string | undefined,
): InfoPlist {
  const nextInfoPlist = { ...infoPlist };

  if (apiKey) {
    nextInfoPlist[IOS_GOOGLE_MAPS_API_KEY] = apiKey;
  } else {
    delete nextInfoPlist[IOS_GOOGLE_MAPS_API_KEY];
  }

  return nextInfoPlist;
}

export function applyIosGoogleProviderPodfileProperty(
  podfileProperties: PodfileProperties,
  enabled: boolean,
): PodfileProperties {
  const nextPodfileProperties = { ...podfileProperties };

  if (enabled) {
    nextPodfileProperties[IOS_GOOGLE_PROVIDER_PODFILE_PROPERTY] = 'true';
  } else {
    delete nextPodfileProperties[IOS_GOOGLE_PROVIDER_PODFILE_PROPERTY];
  }

  return nextPodfileProperties;
}

export function applyLocationPermissionsToInfoPlist(
  infoPlist: InfoPlist,
  options: BetterMapsPluginOptions,
): InfoPlist {
  if (requiresForegroundLocation(options)) {
    infoPlist.NSLocationWhenInUseUsageDescription = wantsWhenInUseLocation(
      options,
    )
      ? options.locationPermission
      : options.locationAlwaysPermission;
  }
  if (wantsAlwaysLocation(options)) {
    infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription =
      options.locationAlwaysPermission;
  }

  return infoPlist;
}

const withIosGoogleProviderPodfileProperty: ConfigPlugin<
  BetterMapsPluginOptions
> = (config, options = {}) => {
  const enableIosGoogleProvider = shouldEnableIosGoogleMapsProvider(options);

  return withPodfileProperties(config, (config) => {
    config.modResults = applyIosGoogleProviderPodfileProperty(
      config.modResults,
      enableIosGoogleProvider,
    );
    return config;
  });
};

export const withBetterMapsIos: ConfigPlugin<BetterMapsPluginOptions> = (
  config,
  options = {},
) => {
  config = withIosGoogleProviderPodfileProperty(config, options);

  const iosGoogleMapsApiKey = resolveIosGoogleMapsApiKey(options);
  const needsLocation = requiresForegroundLocation(options);

  return withInfoPlist(config, (config) => {
    config.modResults = applyGoogleMapsIosApiKey(
      config.modResults,
      iosGoogleMapsApiKey,
    );
    if (needsLocation) {
      config.modResults = applyLocationPermissionsToInfoPlist(
        config.modResults,
        options,
      );
    }
    return config;
  });
};

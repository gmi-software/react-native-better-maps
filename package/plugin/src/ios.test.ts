import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  applyGoogleMapsIosApiKey,
  applyLocationPermissionsToInfoPlist,
  IOS_GOOGLE_MAPS_API_KEY,
  IOS_GOOGLE_PROVIDER_PODFILE_PROPERTY,
} from './ios';
import {
  resolveIosGoogleMapsApiKey,
  shouldEnableIosGoogleMapsProvider,
} from './types';

describe('IOS_GOOGLE_PROVIDER_PODFILE_PROPERTY', () => {
  it('matches the key read in react-native-better-maps.podspec', () => {
    expect(IOS_GOOGLE_PROVIDER_PODFILE_PROPERTY).toBe(
      'betterMaps.iosGoogleProvider',
    );

    const podspecPath = join(
      __dirname,
      '../../react-native-better-maps.podspec',
    );
    const podspec = readFileSync(podspecPath, 'utf8');
    expect(podspec).toContain(
      `'${IOS_GOOGLE_PROVIDER_PODFILE_PROPERTY}'`,
    );
  });
});

describe('applyGoogleMapsIosApiKey', () => {
  it('returns the plist unchanged when the API key is omitted', () => {
    expect(applyGoogleMapsIosApiKey({}, undefined)).toEqual({});
  });

  it('sets GoogleMapsIosApiKey when an API key is provided', () => {
    expect(applyGoogleMapsIosApiKey({}, 'test-ios-key')).toEqual({
      [IOS_GOOGLE_MAPS_API_KEY]: 'test-ios-key',
    });
  });
});

describe('resolveIosGoogleMapsApiKey', () => {
  it('prefers iosGoogleMapsApiKey over googleMapsApiKey', () => {
    expect(
      resolveIosGoogleMapsApiKey({
        googleMapsApiKey: 'shared',
        iosGoogleMapsApiKey: 'ios-key',
      }),
    ).toBe('ios-key');
  });

  it('falls back to googleMapsApiKey when iosGoogleMapsApiKey is omitted', () => {
    expect(resolveIosGoogleMapsApiKey({ googleMapsApiKey: 'shared' })).toBe(
      'shared',
    );
  });

  it('returns undefined when no iOS key is provided', () => {
    expect(resolveIosGoogleMapsApiKey({})).toBeUndefined();
  });

  it('returns undefined when the iOS key is blank', () => {
    expect(
      resolveIosGoogleMapsApiKey({ iosGoogleMapsApiKey: '   ' }),
    ).toBeUndefined();
  });
});

describe('shouldEnableIosGoogleMapsProvider', () => {
  it('enables when iosGoogleMapsApiKey is provided', () => {
    expect(
      shouldEnableIosGoogleMapsProvider({ iosGoogleMapsApiKey: 'ios-key' }),
    ).toBe(true);
  });

  it('enables when only googleMapsApiKey is provided', () => {
    expect(
      shouldEnableIosGoogleMapsProvider({ googleMapsApiKey: 'shared' }),
    ).toBe(true);
  });

  it('does not enable when only androidGoogleMapsApiKey is provided', () => {
    expect(
      shouldEnableIosGoogleMapsProvider({
        androidGoogleMapsApiKey: 'android-key',
      }),
    ).toBe(false);
  });

  it('does not enable when no key is provided', () => {
    expect(shouldEnableIosGoogleMapsProvider({})).toBe(false);
  });
});

describe('applyLocationPermissionsToInfoPlist', () => {
  it('returns the plist unchanged when location options are omitted', () => {
    expect(applyLocationPermissionsToInfoPlist({}, {})).toEqual({});
  });

  it('returns the plist unchanged when location options are false', () => {
    expect(
      applyLocationPermissionsToInfoPlist(
        {},
        {
          locationPermission: false,
          locationAlwaysPermission: false,
        },
      ),
    ).toEqual({});
  });

  it('sets NSLocationWhenInUseUsageDescription when when-in-use permission is set', () => {
    const updated = applyLocationPermissionsToInfoPlist(
      {},
      {
        locationPermission: 'Allow $(PRODUCT_NAME) to use your location.',
      },
    );

    expect(updated.NSLocationWhenInUseUsageDescription).toBe(
      'Allow $(PRODUCT_NAME) to use your location.',
    );
    expect(
      updated.NSLocationAlwaysAndWhenInUseUsageDescription,
    ).toBeUndefined();
  });

  it('backfills NSLocationWhenInUseUsageDescription when only always permission is set', () => {
    const updated = applyLocationPermissionsToInfoPlist(
      {},
      {
        locationAlwaysPermission: 'Allow background location access.',
      },
    );

    expect(updated.NSLocationAlwaysAndWhenInUseUsageDescription).toBe(
      'Allow background location access.',
    );
    expect(updated.NSLocationWhenInUseUsageDescription).toBe(
      'Allow background location access.',
    );
  });

  it('sets both location usage descriptions when both options are set', () => {
    const updated = applyLocationPermissionsToInfoPlist(
      {},
      {
        locationPermission: 'When in use',
        locationAlwaysPermission: 'Always',
      },
    );

    expect(updated.NSLocationWhenInUseUsageDescription).toBe('When in use');
    expect(updated.NSLocationAlwaysAndWhenInUseUsageDescription).toBe('Always');
  });
});

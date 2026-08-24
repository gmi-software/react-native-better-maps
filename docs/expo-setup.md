# Expo setup (SDK 56+)

This guide covers configuring `react-native-better-maps` in an Expo app with the New Architecture enabled.

## Prerequisites

- Expo SDK 56+ (verified through SDK 57)
- React Native 0.78+ with the New Architecture enabled (the default since Expo SDK 53; SDK 57 removed the `newArchEnabled` config property because the New Architecture is the only option)
- `react-native-nitro-modules` installed alongside `react-native-better-maps`

| Expo SDK | React Native | Status   |
| -------- | ------------ | -------- |
| 57       | 0.86         | Verified |
| 56       | 0.85         | Verified |

## Install

```bash
bun add react-native-better-maps react-native-nitro-modules
```

## Config plugin

Add the plugin to `app.json` or `app.config.js`:

```js
/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    // ...your existing config
    plugins: [
      [
        'react-native-better-maps',
        {
          googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
          locationPermission:
            'Allow $(PRODUCT_NAME) to use your location for map features.',
        },
      ],
    ],
  },
};
```

### Plugin options

| Option                     | Type              | Default | Description                                                                                                                                                                                                                     |
| -------------------------- | ----------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `googleMapsApiKey`         | `string`          | —       | Shared fallback for iOS and Android when platform-specific keys are omitted.                                                                                                                                                    |
| `iosGoogleMapsApiKey`      | `string`          | —       | Injects `GoogleMapsIosApiKey` into `Info.plist` and sets `betterMaps.iosGoogleProvider` in `Podfile.properties.json` so the Google Maps SDK is linked on iOS.                                                                 |
| `androidGoogleMapsApiKey`  | `string`          | —       | Injects `com.google.android.geo.API_KEY` meta-data on Android.                                                                                                                                                                  |
| `locationPermission`       | `string \| false` | —       | Foreground location message. Injects iOS `NSLocationWhenInUseUsageDescription` plus Android `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION`.                                                                                |
| `locationAlwaysPermission` | `string \| false` | —       | Background location message. Injects iOS `NSLocationAlwaysAndWhenInUseUsageDescription` plus Android `ACCESS_BACKGROUND_LOCATION`; also supplies foreground usage strings and permissions when `locationPermission` is omitted. |

Omitting Google Maps keys does not fail prebuild. iOS MapKit works without a key, but the iOS and Android Google Maps providers require their platform keys before they can render.

## Google Maps API key

### Local development

Create a `.env` file (see `example/.env.example`):

```dotenv
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

Load it in `app.config.js` with `process.env.GOOGLE_MAPS_API_KEY` as shown above.

### EAS Build

Store the key as an EAS secret:

```bash
eas secret:create --name GOOGLE_MAPS_API_KEY --value your-google-maps-api-key
```

Reference it in `app.config.js` via `process.env.GOOGLE_MAPS_API_KEY`. EAS injects secrets into the build environment automatically.

### Alternative: Expo built-in Google Maps config

You can use Expo's native `android.config.googleMaps.apiKey` instead of the plugin's `googleMapsApiKey`. Pick one source — do not configure both.

## Prebuild

Generate native projects:

```bash
expo prebuild --clean
```

The plugin injects:

- **Android:** `com.google.android.geo.API_KEY` meta-data (when `googleMapsApiKey` or `androidGoogleMapsApiKey` is set) and location permissions (when location options are set)
- **iOS:** `GoogleMapsIosApiKey` in `Info.plist` and `betterMaps.iosGoogleProvider` in `Podfile.properties.json` (when `googleMapsApiKey` or `iosGoogleMapsApiKey` is set), plus location usage description strings (when location options are set)

On iOS, the API key and pod linkage are separate artifacts. The plugin keeps them in sync during prebuild. If you later remove Google Maps keys from the plugin config, re-run `expo prebuild` to remove both `GoogleMapsIosApiKey` and `betterMaps.iosGoogleProvider`, then run `pod install` to update the linked pods. Bare React Native apps without the plugin must manage both settings manually; see [Bare React Native](../README.md#bare-react-native) in the README.

## Run

```bash
expo run:android
expo run:ios
```

## Example app

The monorepo example at `example/` uses this plugin. From the repo root:

```bash
GOOGLE_MAPS_API_KEY=your-key bun example prebuild
GOOGLE_MAPS_API_KEY=your-key bun example android
```

The example's `prebuild` script builds the plugin (`build:plugin`) before running `expo prebuild`, since the workspace symlink requires compiled plugin output.

## Troubleshooting

| Symptom                                     | Fix                                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Blank Google map                            | Ensure `googleMapsApiKey` or the platform-specific Google Maps key is set, then run `expo prebuild` again.                     |
| iOS Google Maps key present but provider fails | iOS needs `GoogleMapsIosApiKey` in `Info.plist` **and** `"betterMaps.iosGoogleProvider": "true"` in `Podfile.properties.json`, then `pod install`. Re-run prebuild after changing or removing plugin keys so both artifacts stay aligned. |
| Location dot not showing                    | Set `locationPermission` or `locationAlwaysPermission` in the plugin options and re-run prebuild.                              |
| Plugin not found                            | Confirm `react-native-better-maps` is installed and listed in `plugins`.                                                        |
| `Cannot find module './plugin/build/index'` | Run `bun run build:plugin` in the package (or `bun run build` from the repo root) before prebuild when using a workspace link. |

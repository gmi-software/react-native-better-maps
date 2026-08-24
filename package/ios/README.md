# iOS native implementation

Swift implementation of the `MapView` Nitro HybridView backed by Apple MapKit and Google Maps.

## Structure

```text
ios/
├── HybridMapView.swift                # MapView HybridView host and provider selection
├── AppleMapProviderAdapter.swift      # Apple MapKit implementation
├── GoogleMapProviderAdapter.swift     # Google Maps SDK implementation
├── MapProviderAdapter.swift           # Shared provider adapter contract
└── *+*.swift                          # SDK-specific conversion helpers
```

Generated Nitrogen bindings live in `../nitrogen/generated/ios/` and are included by the podspec.

## Google Maps API key

The library does not ship an API key. Host apps that use `provider="google"` on iOS must provide one.

Expo apps can set the key with the package config plugin:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-better-maps",
        {
          "iosGoogleMapsApiKey": "YOUR_API_KEY"
        }
      ]
    ]
  }
}
```

Non-Expo (bare) apps must configure **both** the runtime key and CocoaPods linkage — the Expo config plugin writes these together, but bare projects have no plugin step:

1. Add the API key to `Info.plist`:

```xml
<key>GoogleMapsIosApiKey</key>
<string>YOUR_API_KEY</string>
```

2. Enable the Google Maps pod in `ios/Podfile.properties.json`, then run `pod install`:

```json
{
  "betterMaps.iosGoogleProvider": "true"
}
```

Without the podfile property, the library builds without `GoogleMaps` and `provider="google"` fails with a SDK-not-linked error even when the key is present. After a one-time `expo prebuild`, keep `Podfile.properties.json` aligned with your `Info.plist` key — stale values can leave the SDK linked or unlinked independently of the key.

For the example Expo app, set `GOOGLE_MAPS_IOS_API_KEY` or the shared `GOOGLE_MAPS_API_KEY` fallback (see `example/.env.example`) before running `expo prebuild` or `expo run:ios`.

`googleMapId` is supported for Google Cloud Map ID styling:

```tsx
<MapView provider="google" googleMapId="YOUR_MAP_ID" />
```

## Getting started

1. Run `bun run nitrogen` from the repo root to generate native bindings.
2. Run `pod install` from `example/ios` after changing native dependencies.
3. Build the example app: `GOOGLE_MAPS_IOS_API_KEY=your-key bun example ios`.

See [src/native/README.md](../src/native/README.md) for the JS ↔ native architecture.

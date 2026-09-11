# Security Policy

## Supported versions

Fixes land on the latest minor release. Older minors do not receive backports —
upgrading is the supported path.

| Version | Supported           |
| ------- | ------------------- |
| 1.1.x   | ✅                  |
| 1.0.x   | ❌ upgrade to 1.1.x |
| < 1.0   | ❌                  |

## Reporting a vulnerability

**Do not open a public issue.**

Report it privately through
[GitHub Security Advisories](https://github.com/gmi-software/react-native-better-maps/security/advisories/new).
If that is not possible, email <security@gmi.software>.

Please include:

- the version of `react-native-better-maps`, React Native and
  `react-native-nitro-modules`
- the affected map provider (`apple` / `google`) and platform
- what an attacker can do with it, and a reproduction if you have one

We aim to acknowledge a report within five working days. If a fix is warranted
we will agree a disclosure timeline with you, credit you in the advisory unless
you prefer otherwise, and publish the advisory alongside the release that fixes
it.

## Map provider API keys are not a vulnerability in this library

The most common report we expect is _"I extracted the Google Maps API key from
an app that uses this library."_ That is expected behavior of the Google Maps
SDKs, not a flaw here.

The key has to reach the native SDK inside the app process, so it lives in the
shipped binary:

- **iOS** — `GoogleMapsIosApiKey` in `Info.plist`, read via `Bundle.main` and
  handed to `GMSServices.provideAPIKey`
- **Android** — `com.google.android.geo.API_KEY` in `AndroidManifest.xml`, read
  by the Google Maps SDK itself

Anyone with the `.ipa` or `.apk` can read it. This library does not transmit the
key anywhere: it only passes it to the provider SDK in-process.

The actual protection is server-side, in Google Cloud:

- restrict the key to your iOS bundle ID and your Android package name plus the
  SHA-1 fingerprint of your signing certificate
- restrict it to only the APIs you use (Maps SDK for iOS / Android)
- use separate keys per platform and per build variant, and set quotas

A report that a key can be extracted from a binary will be closed with a link to
this section. A report that this library leaks a key somewhere it should not —
a log line, a network request, a crash report payload — is a real issue and we
want to hear about it.

## Supply chain

Releases are built and published only by the
[Release workflow](.github/workflows/release.yml), never from a developer
machine:

- npm publishing uses OIDC trusted publishing, so no long-lived npm token exists
  in the repository or on any laptop
- every published version carries
  [npm provenance](https://docs.npmjs.com/generating-provenance-statements),
  which you can verify with `npm audit signatures`
- every GitHub Action is pinned by commit SHA, not by tag
- workflows check out with `persist-credentials: false`, and CI never writes to
  git

If you believe a published artifact does not match this repository, treat it as
a vulnerability and report it through the channel above.

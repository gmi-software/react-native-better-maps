# Contributing to react-native-better-maps

Thank you for your interest in contributing!

## Development setup

1. Install [Bun](https://bun.sh/) and Node.js 22+.
2. Clone the repository and install dependencies:

   ```bash
   bun install
   ```

3. Build the library:

   ```bash
   bun run build
   ```

4. Run the example app:

   ```bash
   bun run example start
   ```

## Building the native code

`bun run lint`, `bun run typecheck` and `bun run build` never touch `package/ios` or
`package/android` — they stop at TypeScript. The Swift, Kotlin and C++ sources are compiled by
the **Native** workflow, which runs on pull requests that change them and gates the npm publish.

Nothing native is committed: `package/nitrogen/`, `package/plugin/build/`, `example/ios/` and
`example/android/` are all gitignored, and the Gradle wrapper and Xcode workspace only exist
after an Expo prebuild. To reproduce a red native job locally, run the same chain CI does:

```bash
bun install
bun run --filter react-native-better-maps build:plugin   # app.plugin.js resolves to plugin/build
bun run nitrogen                                         # the podspec and build.gradle load generated files
```

Then, for iOS. Keep `--scratch-path` on `swift test`: its default is `package/ios/.build`, which sits
inside the podspec's `ios/**/*.swift` glob.

```bash
swift test --package-path package/ios --scratch-path "$TMPDIR/spm-build"

(cd example && bunx expo prebuild --platform ios --no-install)
(cd example/ios && pod install)
xcodebuild build \
  -workspace example/ios/NitroMapsExample.xcworkspace \
  -scheme react-native-better-maps \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$TMPDIR/better-maps-dd" \
  ARCHS=arm64 ONLY_ACTIVE_ARCH=NO CODE_SIGNING_ALLOWED=NO
```

`ARCHS` is pinned because a generic destination has no active arch, so the Debug default of
`ONLY_ACTIVE_ARCH=YES` would otherwise build arm64 and x86_64 for no extra signal.

Set `GOOGLE_MAPS_IOS_API_KEY` to any non-empty string before `expo prebuild` to compile the
Google Maps adapters as well. The config plugin writes `betterMaps.iosGoogleProvider` into
`Podfile.properties.json`, and the podspec only depends on `GoogleMaps` when that flag is set —
so without it every file behind `#if canImport(GoogleMaps)` compiles to nothing. CI builds both
configurations for exactly this reason.

And for Android:

```bash
(cd example && bunx expo prebuild --platform android --no-install)
(cd example/android && ./gradlew \
  :react-native-better-maps:assembleDebug \
  :react-native-better-maps:testDebugUnitTest \
  -PreactNativeArchitectures=arm64-v8a)
```

Both tasks go in one invocation: a second `./gradlew` pays the configuration phase, which shells out
to node, all over again. No Google Maps key is needed to build Android; it is only read at runtime.

Two things that waste time if you do not know them:

- Name the Xcode scheme explicitly. `xcodebuild -list` returns the pod schemes first, so
  letting it pick the default gives a green `BUILD SUCCEEDED` that never compiled the library.
- Re-run `pod install` after switching branches. `example/ios` is gitignored, so the Pods
  project is whatever the previous checkout left behind and can reference files that no longer
  exist.

## Scripts

| Script | Description |
| --- | --- |
| `bun run lint` | Run ESLint across the monorepo |
| `bun run typecheck` | Type-check the library package |
| `bun run build` | Build the library with react-native-builder-bob |
| `bun run nitrogen` | Run Nitrogen codegen (when specs are ready) |
| `bun run format` | Format all files with Prettier |
| `bun run format:cpp` | Format C++ with clang-format (`config/.clang-format`) |
| `bun run format:kotlin` | Format Kotlin with ktlint (`config/.editorconfig`) |
| `bun run format:swift` | Format Swift with swift-format (`config/.swift-format`) |
| `bun run format:native` | Run all three native formatters |
| `bun run doctor` | Run React Doctor locally |

## React Doctor

[React Doctor](https://www.react.doctor/docs) scans React and React Native code for security risks, performance regressions, effect misuse, and architecture issues. It complements ESLint — it does not replace lint, typecheck, or build checks.

Run locally from the monorepo root:

```bash
bun run doctor
# or
npx react-doctor@latest
```

Both `package/` (library) and `example/` (Expo app) are included in scans.

### CI behavior

React Doctor runs in a separate GitHub Actions workflow (`.github/workflows/react-doctor.yml`):

- **Pull requests:** posts a summary comment with a health score and inline review comments on changed lines. During the initial advisory rollout, findings are reported but do not block merges (`blocking: none`, `scope: full`).
- **Pushes to `main`:** records the health score trend without failing the branch.

After the baseline is documented and critical findings are addressed, CI will switch to blocking new errors on changed files only.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By taking part you are expected to uphold it; report unacceptable behavior to security@gmi.software.

## Security

Do not report vulnerabilities through issues or pull requests. See [SECURITY.md](SECURITY.md) for the private reporting channel.

## Commit messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Commit messages are validated locally via Husky and on pull requests in CI.

Format:

```text
<type>[optional scope]: <description>
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

Examples:

```text
feat: add marker clustering support
fix(ios): correct viewport filter for wrapped longitudes
chore: add commitlint configuration
```

## Pull request guidelines

- Keep changes focused and well-scoped.
- Run `bun run lint`, `bun run typecheck`, and `bun run build` before opening a PR.
- Use conventional commit messages for all commits in the PR.
- Follow existing naming conventions and avoid `any` in TypeScript.
- Update documentation when changing public APIs.

## Code style

- TypeScript strict mode is enforced.
- Use Prettier for formatting (`bun run format`).
- Place imports at the top of files.
- Use exhaustive switch handling for discriminated unions.

## Releasing

Maintainers cut releases from CI — see [RELEASING.md](RELEASING.md).

## Reporting issues

Please use [GitHub Issues](https://github.com/gmi-software/react-native-better-maps/issues) and include:

- Library version
- React Native / Expo version
- Platform (iOS / Android)
- Steps to reproduce
- Expected vs actual behavior

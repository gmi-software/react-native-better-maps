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

## Scripts

| Script | Description |
| --- | --- |
| `bun run lint` | Run ESLint across the monorepo |
| `bun run typecheck` | Type-check the library package |
| `bun run build` | Build the library with react-native-builder-bob |
| `bun run nitrogen` | Run Nitrogen codegen (when specs are ready) |
| `bun run format` | Format all files with Prettier |
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

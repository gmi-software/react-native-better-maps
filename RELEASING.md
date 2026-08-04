# Releasing

Releases are cut by the [Release workflow](.github/workflows/release.yml) and
published to npm from CI with [provenance](https://docs.npmjs.com/generating-provenance-statements).
Nothing is published from a developer machine, and no long-lived npm token
exists anywhere.

## Versioning

The version bump is derived from [Conventional Commits](https://www.conventionalcommits.org/)
since the previous tag: `fix:` gives a patch, `feat:` a minor, and a
`BREAKING CHANGE:` footer a major. You can override this with the workflow's
`increment` input.

Two things are worth knowing because tooling cannot infer them:

- A commit that is not conventional (for example `Fix threading issues on ios`)
  is invisible to the bump calculation and to the generated release notes. Add
  it to the changelog by hand.
- A change in runtime behavior that keeps the same types — such as a callback
  that starts firing once per gesture instead of continuously — is a breaking
  change for consumers even though their code still compiles. Either take the
  major, or ship it as a minor with a prominent **Behavior changes** section, as
  1.1.0 did.

## Changelog

`CHANGELOG.md` is written by hand, not generated. This is deliberate: the parts
of a release that matter most to users — behavior changes, migration snippets,
the reason a fix exists — cannot be derived from commit subjects.

The workflow **fails** if `CHANGELOG.md` has no `## <version>` section for the
version being released, so the notes cannot be forgotten.

Auto-generated notes from conventional commits still go into the GitHub Release
body, so the commit-level detail is not lost.

## Cutting a release

1. Make sure `main` is green and contains everything you want to ship.
2. Add a `## <version>` section to `CHANGELOG.md` and merge it to `main`.
3. Run the **Release** workflow from the Actions tab with `dry_run: true`. It
   resolves the version, runs the full gate, and prints the plan without tagging
   or publishing.
4. Re-run with `dry_run: false`.

The workflow then bumps `package/package.json`, commits `chore: release vX.Y.Z`,
tags `vX.Y.Z`, pushes both, publishes to npm with provenance, and creates the
GitHub Release.

The iOS podspec reads its version from `package.json`, so there is no second
version to keep in sync.

## One-time setup

### npm trusted publishing

Publishing uses OIDC, so it only works once npm knows which workflow is allowed
to publish this package. On npmjs.com, open the `react-native-better-maps`
package settings and add a **GitHub Actions** trusted publisher pointing at:

- repository: `gmi-software/react-native-better-maps`
- workflow: `release.yml`

Until this is configured the publish step will fail with an authentication
error. If an `NPM_TOKEN` secret still exists in the repository, delete it once
trusted publishing works — it is no longer used.

### Branch protection

The workflow pushes the release commit and tag directly to `main`. If `main`
requires pull requests or status checks, allow `github-actions[bot]` to bypass
those rules, or the push will be rejected after the package has already been
published.

## Notes on the configuration

`package/.release-it.json` sets `npm.skipChecks: true`. release-it otherwise
runs `npm whoami` during startup, which fails under trusted publishing because
the short-lived token is only minted at publish time.

## Releasing locally

Not supported for real releases — a local publish would produce a package
without provenance. To inspect what a release would do:

```bash
cd package
bunx release-it --dry-run
```

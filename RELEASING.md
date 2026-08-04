# Releasing

Releases are published to npm from CI with
[provenance](https://docs.npmjs.com/generating-provenance-statements) by the
[Release workflow](.github/workflows/release.yml). Nothing is published from a
developer machine, and no long-lived npm token exists anywhere.

Publishing is triggered by pushing a version tag. CI never writes to git: `main`
requires pull request reviews with `enforce_admins` enabled, so nothing — not
even `github-actions[bot]` — can push a release commit to it. The version bump
goes through a normal reviewed pull request instead, which has the useful side
effect of putting the changelog in front of a reviewer.

## Cutting a release

**1. Open a release pull request.** Bump the version and write the notes:

```bash
cd package
npm version 1.1.0 --no-git-tag-version
```

Then add a matching `## 1.1.0` section to `CHANGELOG.md`, and open a pull request
with both changes. Review and merge it as usual.

**2. Rehearse (optional).** Run the **Release** workflow manually from the
Actions tab. A manual run is always a dry run: it validates the version, the
changelog and the full gate without publishing.

**3. Push the tag.**

```bash
git checkout main && git pull
git tag -a v1.1.0 -m 'v1.1.0'
git push origin v1.1.0
```

The workflow then verifies the tag matches `package/package.json`, that
`CHANGELOG.md` has a section for it, and that the version is not already on npm;
runs the full gate; publishes to npm with provenance; and creates the GitHub
Release with notes generated from the conventional commits since the last tag.

The iOS podspec reads its version from `package.json`, so there is no second
version to keep in sync.

## Versioning

The bump is a judgement call, made when you open the release pull request. The
usual rules apply — `fix:` is a patch, `feat:` a minor, an incompatible API
change a major — but two cases are easy to get wrong:

- A commit that is not conventional (for example `Fix threading issues on ios`)
  is invisible to the generated release notes. Add it to the changelog by hand.
- A change in runtime behavior that keeps the same types — such as a callback
  that starts firing once per gesture instead of continuously — breaks consumers
  even though their code still compiles. Either take the major, or ship it as a
  minor with a prominent **Behavior changes** section, as 1.1.0 did.

## Changelog

`CHANGELOG.md` is written by hand, not generated. This is deliberate: the parts
of a release that matter most — behavior changes, migration snippets, the reason
a fix exists — cannot be derived from commit subjects. The workflow **fails** if
there is no `## <version>` section, so the notes cannot be forgotten.

Notes generated from conventional commits still go into the GitHub Release body,
so commit-level detail is not lost.

## One-time setup: npm trusted publishing

Publishing uses OIDC, so it only works once npm knows which workflow may publish
this package. On npmjs.com, open the `react-native-better-maps` package settings
and add a **GitHub Actions** trusted publisher pointing at:

- repository: `gmi-software/react-native-better-maps`
- workflow: `release.yml`

Until this is configured the publish step fails with an authentication error. If
an `NPM_TOKEN` secret still exists in the repository, delete it once trusted
publishing works — it is no longer used.

## Notes on the configuration

A few settings exist for non-obvious reasons:

- `npm.skipChecks: true` in `package/.release-it.json` — release-it otherwise
  runs `npm whoami` at startup, which fails under trusted publishing because the
  token is only minted at publish time.
- The workflow does **not** set `registry-url` on `actions/setup-node` — doing so
  writes an `_authToken` entry into `.npmrc`, which makes npm assume classic
  token auth and skip the OIDC flow. The registry is pinned by `publishConfig`.
- `release-it` runs with `--no-increment --no-git`: the version is already
  committed and the tag already pushed, so CI only publishes and creates the
  release.

## Inspecting a release locally

A local publish would produce a package without provenance, so it is not
supported. To see what a release would do:

```bash
cd package
bunx release-it --no-increment --no-git --dry-run
```

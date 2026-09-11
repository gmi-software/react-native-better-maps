## What does this change?

<!-- What the change does, and why. Link the issue it closes: "Closes #123". -->

## How was it verified?

<!--
Say what you actually ran — "builds" is not verification.
For native changes, name the provider, platform and device you tested on.
-->

## Scope

- **Providers:** <!-- apple / google / both / not provider specific -->
- **Platforms:** <!-- iOS / Android / both / JS only -->

## Checklist

- [ ] `bun run lint`, `bun run typecheck` and `bun run build` pass
- [ ] Tests pass, and new behavior is covered by a test
- [ ] Nitro specs changed? `bun run nitrogen` was re-run and the generated code is committed
- [ ] Public API changed? The README and the capability matrix are updated
- [ ] Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
- [ ] Behavior changed without a type change? Say so explicitly above — it breaks consumers whose code still compiles

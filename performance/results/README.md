# Results

- `baseline/<platform>/<device>-<build>/` — committed baselines, one directory per device and build variant, written by `bun perf baseline`. `run.json` holds the whole run; `<scenario>.json` one result each; `summary.md` the rendered scorecard.
- `runs/` — local runs (gitignored). `bun perf run` writes here; `bun perf compare` reads the latest by default.
- `bench/` — JS micro-benchmark output (gitignored) from `bun perf bench`.

Result files follow the schema in `performance/app/result.ts`. A metric that could not be measured is `null` and is rendered as `N/A`; nothing is estimated.

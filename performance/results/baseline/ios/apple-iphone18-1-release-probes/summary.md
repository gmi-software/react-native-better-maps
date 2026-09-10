Run 20260910-160744-llt0 (baseline run 2 (JS frame sampler), iPhone 17 Pro simulator, concurrent with Android emulator run) · ios 26.5 · Apple iPhone18,1 · 60 Hz · provider apple
Build: release, Hermes, probes · NOT production-representative (simulator/emulator: desktop CPU and GPU, 60 Hz; not a device measurement)
Recorded 2026-09-10T14:07:50.382Z → 2026-09-10T14:19:12.571Z

| Scenario | FPS avg | Frame p95 | Frame p99 | Worst frame | Jank ratio | JS lag p95 | JS commit avg | Native main-thread | RAM after | RAM Δ interaction | JS allocated | CPU |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| markers-100 | 59.3 | 16.7 ms | 21.3 ms | 45.4 ms | 0.6 % | 0.48 ms | N/A | 1.82 ms | 260 MB | 75 MB | 109 KB | 31 % |
| markers-1k | 58.6 | 16.7 ms | 33.3 ms | 50.0 ms | 1.8 % | 0.57 ms | N/A | 3.15 ms | 264 MB | 84 MB | 168 KB | 32 % |
| markers-10k | 57.9 | 16.7 ms | 36.6 ms | 43.8 ms | 3.0 % | 0.45 ms | N/A | 8.03 ms | 253 MB | 61 MB | 157 KB | 32 % |
| markers-50k | 56.6 | 16.7 ms | 52.1 ms | 101.4 ms | 2.4 % | 0.47 ms | N/A | 13.8 ms | 355 MB | 95 MB | 167 KB | 29 % |
| markers-children-1k | 59.0 | 16.7 ms | 33.3 ms | 46.9 ms | 1.2 % | 0.53 ms | N/A | 3.35 ms | 313 MB | 79 MB | 146 KB | 32 % |
| markers-10k-rich | 58.3 | 16.7 ms | 34.0 ms | 41.7 ms | 2.4 % | 0.53 ms | N/A | 7.10 ms | 298 MB | 80 MB | 148 KB | 33 % |
| camera-fast-pan-0 | 59.5 | 16.7 ms | 16.7 ms | 48.0 ms | 0.4 % | 0.51 ms | N/A | 2.37 ms | 321 MB | 109 MB | 119 KB | 34 % |
| camera-fast-pan-1k | 59.5 | 16.7 ms | 16.7 ms | 51.0 ms | 0.4 % | 0.51 ms | N/A | 4.73 ms | 322 MB | 133 MB | 179 KB | 31 % |
| camera-idle-10k | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.48 ms | N/A | 0.00 ms | 233 MB | 7 MB | 119 KB | 2 % |
| camera-slow-pan-10k | 59.2 | 16.7 ms | 33.3 ms | 45.8 ms | 1.0 % | 0.47 ms | N/A | 11.6 ms | 308 MB | 86 MB | 293 KB | 28 % |
| camera-fast-pan-10k | 59.2 | 16.7 ms | 24.6 ms | 42.1 ms | 0.9 % | 0.41 ms | N/A | 10.6 ms | 339 MB | 126 MB | 215 KB | 30 % |
| camera-continuous-pan-10k | 59.2 | 16.7 ms | 33.3 ms | 41.7 ms | 1.1 % | 0.48 ms | N/A | 24.0 ms | 306 MB | 76 MB | 354 KB | 27 % |
| camera-zoom-in-10k | 57.4 | 16.7 ms | 41.3 ms | 46.0 ms | 3.8 % | 0.52 ms | N/A | 45.9 ms | 418 MB | 196 MB | 689 KB | 47 % |
| camera-zoom-out-10k | 57.8 | 16.7 ms | 35.5 ms | 40.9 ms | 3.7 % | 0.46 ms | N/A | 28.1 ms | 412 MB | 186 MB | 465 KB | 47 % |
| camera-rapid-zoom-10k | 58.4 | 16.7 ms | 33.3 ms | 37.6 ms | 2.8 % | 0.54 ms | N/A | 14.9 ms | 345 MB | 108 MB | 283 KB | 41 % |
| camera-rotate-10k | 58.2 | 16.7 ms | 47.9 ms | 71.2 ms | 1.6 % | 0.46 ms | N/A | 8.35 ms | 306 MB | 72 MB | 172 KB | 32 % |
| camera-pitch-10k | 58.0 | 16.7 ms | 34.3 ms | 47.0 ms | 2.8 % | 0.48 ms | N/A | 4.29 ms | 345 MB | 113 MB | 123 KB | 43 % |
| camera-rapid-10k | 57.3 | 16.7 ms | 33.5 ms | 45.1 ms | 4.3 % | 0.50 ms | N/A | 17.7 ms | 316 MB | 84 MB | 292 KB | 37 % |
| camera-fast-pan-50k | 58.4 | 16.7 ms | 35.1 ms | 47.5 ms | 2.3 % | 0.52 ms | N/A | 28.9 ms | 402 MB | 134 MB | 295 KB | 37 % |
| mutations-10k | 59.9 | 16.7 ms | 16.7 ms | 43.5 ms | 0.1 % | 0.53 ms | 13.0 ms | 114.6 ms | 253 MB | 21 MB | 81.7 MB | 7 % |
| mutations-1k-children | 59.7 | 16.7 ms | 16.7 ms | 84.3 ms | 0.3 % | 0.53 ms | 4.76 ms | 21.9 ms | 223 MB | -9 MB | 47.0 MB | 4 % |
| mutations-continuous-1k | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.49 ms | 2.59 ms | 35.1 ms | 208 MB | -2 MB | 12.2 MB | 13 % |
| mutations-continuous-10k | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.58 ms | 15.4 ms | 162.7 ms | 245 MB | 21 MB | 87.7 MB | 22 % |
| polyline-100 | 59.6 | 16.7 ms | 16.7 ms | 46.9 ms | 0.3 % | 0.50 ms | 0.36 ms | 16.1 ms | 319 MB | 81 MB | 690 KB | 20 % |
| polyline-1k | 59.2 | 16.7 ms | 33.3 ms | 35.6 ms | 1.3 % | 0.51 ms | 0.60 ms | 21.7 ms | 312 MB | 92 MB | 2.3 MB | 21 % |
| polyline-10k | 59.4 | 16.7 ms | 16.7 ms | 46.6 ms | 0.7 % | 0.51 ms | 1.25 ms | 17.2 ms | 318 MB | 85 MB | 15.3 MB | 22 % |
| polyline-100k | 57.5 | 16.7 ms | 50.4 ms | 69.7 ms | 2.2 % | 0.65 ms | 6.77 ms | 27.9 ms | 321 MB | 107 MB | 147.8 MB | 27 % |
| polygon-100 | 59.3 | 16.7 ms | 17.6 ms | 49.0 ms | 0.8 % | 0.51 ms | 0.43 ms | 15.4 ms | 307 MB | 72 MB | 459 KB | 25 % |
| polygon-1k | 59.5 | 16.7 ms | 16.7 ms | 35.3 ms | 0.8 % | 0.52 ms | 0.65 ms | 15.7 ms | 304 MB | 91 MB | 1.5 MB | 25 % |
| polygon-10k | 59.5 | 16.7 ms | 16.7 ms | 45.6 ms | 0.4 % | 0.45 ms | 0.90 ms | 15.0 ms | 314 MB | 91 MB | 9.7 MB | 21 % |
| polylines-200x50 | 57.7 | 16.7 ms | 37.7 ms | 50.0 ms | 3.0 % | 0.50 ms | 1.16 ms | 90.1 ms | 346 MB | 98 MB | 3.6 MB | 32 % |
| polygons-200x20 | 57.4 | 16.7 ms | 44.0 ms | 61.5 ms | 2.5 % | 0.54 ms | 0.84 ms | 123.2 ms | 348 MB | 104 MB | 1.8 MB | 26 % |
| cluster-1k | 59.4 | 16.7 ms | 33.3 ms | 34.7 ms | 1.0 % | 0.51 ms | 5.01 ms | 68.0 ms | 408 MB | 156 MB | 1.1 MB | 30 % |
| cluster-10k | 58.9 | 16.7 ms | 33.3 ms | 37.1 ms | 1.9 % | 0.52 ms | 11.3 ms | 118.8 ms | 427 MB | 133 MB | 3.0 MB | 34 % |
| cluster-50k | 58.4 | 16.7 ms | 34.1 ms | 87.8 ms | 1.7 % | 0.53 ms | 49.3 ms | 128.4 ms | 467 MB | 131 MB | 9.8 MB | 65 % |
| combined-10k-camera | 58.7 | 16.7 ms | 33.4 ms | 48.9 ms | 1.9 % | 0.50 ms | N/A | 16.9 ms | 446 MB | 181 MB | 367 KB | 38 % |
| combined-10k-cluster-camera | 59.8 | 16.7 ms | 16.7 ms | 33.3 ms | 0.3 % | 0.51 ms | N/A | 76.9 ms | 438 MB | 148 MB | 686 KB | 39 % |
| combined-10k-updates | 59.5 | 16.7 ms | 16.7 ms | 33.3 ms | 0.8 % | 0.47 ms | 13.1 ms | 84.1 ms | 365 MB | 108 MB | 44.1 MB | 33 % |
| combined-10k-polyline | 58.9 | 16.7 ms | 33.3 ms | 45.7 ms | 1.5 % | 0.53 ms | 1.55 ms | 15.6 ms | 387 MB | 99 MB | 6.8 MB | 27 % |
| combined-10k-polygon | 58.0 | 16.7 ms | 42.8 ms | 61.2 ms | 1.6 % | 0.56 ms | 2.94 ms | 137.6 ms | 452 MB | 129 MB | 1.9 MB | 29 % |
| combined-all | 58.9 | 16.7 ms | 35.1 ms | 39.8 ms | 1.9 % | 0.53 ms | 13.3 ms | 102.8 ms | 497 MB | 159 MB | 35.7 MB | 41 % |
| stability-5m | 59.5 | 16.7 ms | 16.7 ms | 60.1 ms | 0.8 % | 0.51 ms | 13.2 ms | 1139.9 ms | 390 MB | 112 MB | 112.3 MB | 28 % |

#### mutations-10k steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | markers.set | markers.fingerprint | markers.indexBuild | markers.viewportCompute | markers.applyDiff | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| add-1 | 1 | 12.3 ms | 1.13 ms | 1.60 ms | 1.60 ms | 0.66 ms | 1.72 ms | 0.07 ms | 0.00 ms | 1.9 MB |
| remove-1 | 1 | 12.2 ms | 1.20 ms | 1.64 ms | 1.64 ms | 0.55 ms | 1.46 ms | 0.05 ms | 0.00 ms | 1.8 MB |
| update-1 | 1 | 12.1 ms | 1.39 ms | 1.71 ms | 1.71 ms | 0.66 ms | 1.78 ms | 0.05 ms | 0.00 ms | 1.8 MB |
| update-10 | 10 | 13.6 ms | 1.68 ms | 2.12 ms | 2.12 ms | 0.60 ms | 1.45 ms | 0.06 ms | 0.00 ms | 1.8 MB |
| update-100 | 100 | 12.9 ms | 1.49 ms | 2.35 ms | 2.35 ms | 0.75 ms | 1.75 ms | 0.07 ms | 0.00 ms | 1.8 MB |
| update-1pct | 100 | 14.1 ms | 1.64 ms | 2.39 ms | 2.39 ms | 0.88 ms | 1.29 ms | 0.06 ms | 0.10 ms | 1.8 MB |
| update-10pct | 1000 | 10.8 ms | 1.22 ms | 1.83 ms | 1.83 ms | 0.56 ms | 1.05 ms | 0.05 ms | 0.14 ms | 1.9 MB |
| update-100pct | 10000 | 9.27 ms | 1.11 ms | 1.70 ms | 1.70 ms | 0.61 ms | 1.24 ms | 0.06 ms | 0.49 ms | 3.5 MB |

JS commit cost vs. changed markers: empirical exponent -0.02 (0 = flat, 1 = linear).

#### mutations-1k-children steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | markers.set | markers.fingerprint | markers.indexBuild | markers.viewportCompute | markers.applyDiff | polylines.set | polygons.set | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| add-1 | 1 | 4.64 ms | 0.41 ms | 0.33 ms | 0.33 ms | 0.12 ms | 0.21 ms | 0.02 ms | 0.00 ms | 0.00 ms | 0.00 ms | 1.1 MB |
| remove-1 | 1 | 5.16 ms | 0.29 ms | 0.35 ms | 0.35 ms | 0.12 ms | 0.19 ms | 0.02 ms | 0.00 ms | 0.00 ms | 0.00 ms | 1.1 MB |
| update-1 | 1 | 4.11 ms | 0.33 ms | 0.27 ms | 0.27 ms | 0.08 ms | 0.15 ms | 0.02 ms | 0.00 ms | 0.00 ms | 0.00 ms | 1.1 MB |
| update-10 | 10 | 4.64 ms | 0.32 ms | 0.30 ms | 0.30 ms | 0.07 ms | 0.17 ms | 0.02 ms | 0.00 ms | 0.00 ms | 0.00 ms | 1.1 MB |
| update-100 | 100 | 4.30 ms | 0.37 ms | 0.25 ms | 0.25 ms | 0.07 ms | 0.11 ms | 0.02 ms | 0.09 ms | 0.00 ms | 0.00 ms | 1.1 MB |
| update-1pct | 10 | 4.68 ms | 0.34 ms | 0.33 ms | 0.33 ms | 0.12 ms | 0.17 ms | 0.03 ms | 0.00 ms | 0.00 ms | 0.00 ms | 1.1 MB |
| update-10pct | 100 | 4.19 ms | 0.35 ms | 0.37 ms | 0.37 ms | 0.10 ms | 0.20 ms | 0.03 ms | 0.00 ms | 0.00 ms | 0.00 ms | 1.1 MB |
| update-100pct | 1000 | 4.14 ms | 0.40 ms | 0.33 ms | 0.33 ms | 0.11 ms | 0.17 ms | 0.02 ms | 0.20 ms | 0.00 ms | 0.00 ms | 1.3 MB |

JS commit cost vs. changed markers: empirical exponent -0.02 (0 = flat, 1 = linear).

#### mutations-continuous-1k steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | markers.set | markers.fingerprint | markers.indexBuild | markers.viewportCompute | markers.applyDiff | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| continuous |  | 2.59 ms | 0.42 ms | 0.41 ms | 20.4 ms | 6.11 ms | 11.7 ms | 1.47 ms | 8.62 ms | 12.1 MB |

#### mutations-continuous-10k steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | markers.set | markers.fingerprint | markers.indexBuild | markers.viewportCompute | markers.applyDiff | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| continuous |  | 15.4 ms | 1.72 ms | 2.37 ms | 118.3 ms | 43.8 ms | 82.9 ms | 3.29 ms | 0.51 ms | 87.6 MB |

#### polyline-100 steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | polylines.set | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| restyle | 100 | 0.25 ms | 0.09 ms | 1.30 ms | 1.30 ms | 59 KB |
| perturb | 100 | 0.55 ms | 0.18 ms | 2.37 ms | 2.36 ms | 59 KB |

#### polyline-1k steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | polylines.set | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| restyle | 1000 | 0.63 ms | 0.20 ms | 3.08 ms | 3.08 ms | 251 KB |
| perturb | 1000 | 0.63 ms | 0.15 ms | 1.76 ms | 1.76 ms | 265 KB |

#### polyline-10k steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | polylines.set | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| restyle | 10000 | 0.92 ms | 0.14 ms | 1.40 ms | 1.40 ms | 1.7 MB |
| perturb | 10000 | 1.40 ms | 0.20 ms | 2.28 ms | 2.28 ms | 1.9 MB |

#### polyline-100k steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | polylines.set | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| restyle | 100000 | 6.88 ms | 0.46 ms | 3.14 ms | 3.14 ms | 16.7 MB |
| perturb | 100000 | 6.49 ms | 0.55 ms | 3.47 ms | 3.47 ms | 18.2 MB |

#### polygon-100 steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | polygons.set | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| restyle | 100 | 0.40 ms | 0.13 ms | 2.77 ms | 2.77 ms | 59 KB |

#### polygon-1k steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | polygons.set | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| restyle | 1000 | 0.67 ms | 0.15 ms | 2.78 ms | 2.78 ms | 251 KB |

#### polygon-10k steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | polygons.set | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| restyle | 10000 | 0.87 ms | 0.14 ms | 2.59 ms | 2.59 ms | 1.7 MB |

#### polylines-200x50 steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | polylines.set | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| restyle-all |  | 0.88 ms | 0.20 ms | 29.0 ms | 29.0 ms | 793 KB |

#### polygons-200x20 steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | polygons.set | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| restyle-all |  | 0.87 ms | 0.19 ms | 40.7 ms | 40.7 ms | 354 KB |

#### cluster-1k steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | markers.set | markers.fingerprint | markers.indexBuild | markers.viewportCompute | markers.applyDiff | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| zoom-sweep |  | N/A | N/A | N/A | N/A | N/A | N/A | 16.8 ms | 19.9 ms | 439 KB |
| pan |  | N/A | N/A | N/A | N/A | N/A | N/A | 25.5 ms | 19.8 ms | 291 KB |
| update-1pct | 10 | 5.01 ms | 0.41 ms | 0.37 ms | 0.37 ms | 0.12 ms | 0.24 ms | 0.36 ms | 0.14 ms | 268 KB |

#### cluster-10k steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | markers.set | markers.fingerprint | markers.indexBuild | markers.viewportCompute | markers.applyDiff | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| zoom-sweep |  | N/A | N/A | N/A | N/A | N/A | N/A | 195.4 ms | 42.0 ms | 768 KB |
| pan |  | N/A | N/A | N/A | N/A | N/A | N/A | 172.2 ms | 26.7 ms | 408 KB |
| update-1pct | 100 | 11.3 ms | 1.25 ms | 2.35 ms | 2.35 ms | 0.76 ms | 1.58 ms | 3.55 ms | 0.41 ms | 1.8 MB |

#### cluster-50k steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | markers.set | markers.fingerprint | markers.indexBuild | markers.viewportCompute | markers.applyDiff | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| zoom-sweep |  | N/A | N/A | N/A | N/A | N/A | N/A | 2152.4 ms | 39.8 ms | 872 KB |
| pan |  | N/A | N/A | N/A | N/A | N/A | N/A | 1766.2 ms | 23.9 ms | 328 KB |
| update-1pct | 500 | 49.3 ms | 8.51 ms | 8.16 ms | 8.16 ms | 3.46 ms | 7.74 ms | 28.6 ms | 0.84 ms | 8.6 MB |

#### combined-10k-updates steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | markers.set | markers.fingerprint | markers.indexBuild | markers.viewportCompute | markers.applyDiff | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| updates-while-panning |  | 13.1 ms | 2.13 ms | 2.20 ms | 55.0 ms | 17.4 ms | 36.6 ms | 2.72 ms | 7.83 ms | 44.0 MB |

#### combined-10k-polyline steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | polylines.set | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| route-update |  | 1.54 ms | 0.16 ms | 1.85 ms | 1.85 ms | 1.9 MB |

#### combined-10k-polygon steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | polygons.set | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| restyle-all |  | 2.79 ms | 0.56 ms | 37.9 ms | 37.9 ms | 356 KB |

#### combined-all steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | markers.set | markers.fingerprint | markers.indexBuild | markers.viewportCompute | markers.applyDiff | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| updates-while-panning |  | 13.3 ms | 2.04 ms | 2.10 ms | 42.1 ms | 14.6 ms | 29.8 ms | 7.45 ms | 2.67 ms | 35.3 MB |

#### stability-5m timeline

| Window | At | FPS | p95 | p99 | Worst | Jank | RAM | CPU | JS alloc | Native main |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| minute-1 | 63 s | 59.2 | 16.7 ms | 28.9 ms | 52.1 ms | 1.2 % | 420 MB | 28 % | 22.1 MB | 244.7 ms |
| minute-2 | 125 s | 59.6 | 16.7 ms | 16.7 ms | 39.6 ms | 0.7 % | 441 MB | 28 % | 23.1 MB | 242.8 ms |
| minute-3 | 188 s | 59.6 | 16.7 ms | 16.7 ms | 38.2 ms | 0.6 % | 460 MB | 28 % | 23.3 MB | 234.8 ms |
| minute-4 | 250 s | 59.5 | 16.7 ms | 16.7 ms | 60.1 ms | 0.8 % | 481 MB | 28 % | 22.8 MB | 236.0 ms |

Drift first → last window: FPS 0.3, RAM 61 MB.

Run 20260910-162544-6m8g (baseline run 3 (JS-queue probe), Android emulator API 35 arm64, solo) · android 15 · Google sdk_gphone64_arm64 · 60 Hz · provider google
Build: release, Hermes, probes · NOT production-representative (simulator/emulator: desktop CPU and GPU, 60 Hz; not a device measurement)
Recorded 2026-09-10T14:25:47.462Z → 2026-09-10T14:37:43.810Z

| Scenario | FPS avg | Frame p95 | Frame p99 | Worst frame | Jank ratio | JS lag p95 | JS commit avg | Native main-thread | RAM after | RAM Δ interaction | JS allocated | CPU |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| markers-100 | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.20 ms | N/A | 1.54 ms | 178 MB | 18 MB | 145 KB | 18 % |
| markers-1k | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.24 ms | N/A | 3.67 ms | 180 MB | -5 MB | 157 KB | 20 % |
| markers-10k | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.21 ms | N/A | 7.62 ms | 200 MB | -2 MB | 174 KB | 22 % |
| markers-50k | 59.3 | 16.7 ms | 16.7 ms | 50.0 ms | 0.6 % | 0.23 ms | N/A | 28.8 ms | 253 MB | -7 MB | 249 KB | 39 % |
| markers-children-1k | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.27 ms | N/A | 2.96 ms | 240 MB | -36 MB | 157 KB | 25 % |
| markers-10k-rich | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.18 ms | N/A | 4.21 ms | 253 MB | 54 MB | 176 KB | 14 % |
| camera-fast-pan-0 | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.21 ms | N/A | 0.88 ms | 267 MB | 33 MB | 167 KB | 17 % |
| camera-fast-pan-1k | 59.7 | 16.7 ms | 16.7 ms | 33.3 ms | 0.4 % | 0.23 ms | N/A | 3.36 ms | 291 MB | 36 MB | 206 KB | 19 % |
| camera-idle-10k | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.55 ms | N/A | 0.00 ms | 270 MB | 4 MB | 209 KB | 5 % |
| camera-slow-pan-10k | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.19 ms | N/A | 6.04 ms | 220 MB | -19 MB | 349 KB | 14 % |
| camera-fast-pan-10k | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.17 ms | N/A | 9.23 ms | 269 MB | -17 MB | 254 KB | 23 % |
| camera-continuous-pan-10k | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.19 ms | N/A | 12.7 ms | 229 MB | 6 MB | 389 KB | 12 % |
| camera-zoom-in-10k | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.20 ms | N/A | 51.2 ms | 263 MB | -31 MB | 577 KB | 25 % |
| camera-zoom-out-10k | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.18 ms | N/A | 42.5 ms | 272 MB | 22 MB | 434 KB | 25 % |
| camera-rapid-zoom-10k | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.19 ms | N/A | 42.9 ms | 335 MB | 86 MB | 427 KB | 34 % |
| camera-rotate-10k | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.25 ms | N/A | 45.3 ms | 257 MB | -38 MB | 301 KB | 32 % |
| camera-pitch-10k | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.21 ms | N/A | 1.52 ms | 287 MB | -29 MB | 137 KB | 50 % |
| camera-rapid-10k | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.27 ms | N/A | 17.6 ms | 293 MB | -60 MB | 351 KB | 27 % |
| camera-fast-pan-50k | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.19 ms | N/A | 36.0 ms | 334 MB | -18 MB | 364 KB | 36 % |
| mutations-10k | 59.9 | 16.7 ms | 16.7 ms | 33.3 ms | 0.2 % | 0.66 ms | 16.0 ms | 170.6 ms | 314 MB | -54 MB | 43.6 MB | 12 % |
| mutations-1k-children | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.37 ms | 4.88 ms | 25.9 ms | 334 MB | -40 MB | 28.7 MB | 7 % |
| mutations-continuous-1k | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.39 ms | 2.58 ms | 31.7 ms | 333 MB | 16 MB | 6.7 MB | 12 % |
| mutations-continuous-10k | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 8.04 ms | 12.3 ms | 90.0 ms | 328 MB | -69 MB | 44.5 MB | 23 % |
| polyline-100 | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.30 ms | 0.66 ms | 4.72 ms | 340 MB | -46 MB | 553 KB | 12 % |
| polyline-1k | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.35 ms | 1.02 ms | 6.84 ms | 334 MB | -64 MB | 1.7 MB | 13 % |
| polyline-10k | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.28 ms | 1.66 ms | 27.0 ms | 371 MB | -25 MB | 9.5 MB | 13 % |
| polyline-100k | 58.6 | 16.7 ms | 33.3 ms | 33.3 ms | 2.4 % | 41.0 ms | 6.03 ms | 120.5 ms | 422 MB | 69 MB | 90.8 MB | 29 % |
| polygon-100 | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.32 ms | 0.73 ms | 3.90 ms | 415 MB | 49 MB | 386 KB | 11 % |
| polygon-1k | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.26 ms | 0.82 ms | 6.39 ms | 420 MB | 51 MB | 1.1 MB | 11 % |
| polygon-10k | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.38 ms | 1.39 ms | 19.4 ms | 442 MB | 67 MB | 6.1 MB | 12 % |
| polylines-200x50 | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.21 ms | 1.96 ms | 37.4 ms | 428 MB | -2 MB | 2.6 MB | 24 % |
| polygons-200x20 | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.27 ms | 1.18 ms | 17.8 ms | 390 MB | -9 MB | 1.3 MB | 37 % |
| cluster-1k | 59.9 | 16.7 ms | 16.7 ms | 33.3 ms | 0.2 % | 0.22 ms | 1.58 ms | 74.6 ms | 470 MB | 68 MB | 811 KB | 14 % |
| cluster-10k | 59.9 | 16.7 ms | 16.7 ms | 33.3 ms | 0.2 % | 0.21 ms | 11.2 ms | 80.6 ms | 391 MB | -94 MB | 1.6 MB | 22 % |
| cluster-50k | 59.9 | 16.7 ms | 16.7 ms | 33.3 ms | 0.2 % | 0.24 ms | 62.3 ms | 175.2 ms | 447 MB | -5 MB | 5.0 MB | 34 % |
| combined-10k-camera | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.16 ms | N/A | 26.2 ms | 488 MB | -24 MB | 459 KB | 28 % |
| combined-10k-cluster-camera | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.25 ms | N/A | 79.2 ms | 475 MB | 8 MB | 344 KB | 30 % |
| combined-10k-updates | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.97 ms | 10.2 ms | 61.3 ms | 492 MB | -41 MB | 22.5 MB | 24 % |
| combined-10k-polyline | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 0.25 ms | 3.81 ms | 15.2 ms | 562 MB | -1 MB | 4.4 MB | 21 % |
| combined-10k-polygon | 59.8 | 16.7 ms | 16.7 ms | 33.3 ms | 0.4 % | 0.20 ms | 4.23 ms | 45.9 ms | 564 MB | -13 MB | 1.4 MB | 38 % |
| combined-all | 59.9 | 16.7 ms | 16.7 ms | 33.3 ms | 0.2 % | 0.47 ms | 12.0 ms | 128.8 ms | 604 MB | 24 MB | 18.3 MB | 44 % |
| stability-5m | 60.0 | 16.7 ms | 16.7 ms | 33.3 ms | 0.0 % | 0.21 ms | 13.2 ms | 1208.9 ms | 540 MB | -75 MB | 72.1 MB | 23 % |

#### mutations-10k steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | markers.set | markers.fingerprint | markers.indexBuild | markers.viewportCompute | markers.applyDiff | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| add-1 | 1 | 16.7 ms | 14.3 ms | 0.98 ms | 0.98 ms | 0.94 ms | 0.30 ms | 0.06 ms | 0.00 ms | 1001 KB |
| remove-1 | 1 | 16.7 ms | 15.2 ms | 1.43 ms | 1.43 ms | 1.35 ms | 0.51 ms | 0.08 ms | 0.01 ms | 910 KB |
| update-1 | 1 | 17.2 ms | 16.3 ms | 1.33 ms | 1.33 ms | 1.30 ms | 0.34 ms | 0.06 ms | 0.00 ms | 910 KB |
| update-10 | 10 | 18.8 ms | 17.0 ms | 1.23 ms | 1.23 ms | 1.20 ms | 0.54 ms | 0.06 ms | 0.00 ms | 911 KB |
| update-100 | 100 | 16.7 ms | 15.6 ms | 2.12 ms | 2.12 ms | 2.03 ms | 0.92 ms | 0.08 ms | 0.01 ms | 921 KB |
| update-1pct | 100 | 17.4 ms | 14.4 ms | 1.39 ms | 1.39 ms | 1.34 ms | 0.41 ms | 0.07 ms | 0.09 ms | 923 KB |
| update-10pct | 1000 | 17.4 ms | 13.1 ms | 2.36 ms | 2.36 ms | 2.31 ms | 0.39 ms | 0.10 ms | 0.17 ms | 1.0 MB |
| update-100pct | 10000 | 12.1 ms | 14.1 ms | 1.29 ms | 1.29 ms | 1.21 ms | 0.39 ms | 0.06 ms | 0.53 ms | 2.1 MB |

JS commit cost vs. changed markers: empirical exponent -0.02 (0 = flat, 1 = linear).

#### mutations-1k-children steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | markers.set | markers.fingerprint | markers.indexBuild | markers.viewportCompute | markers.applyDiff | polylines.set | polygons.set | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| add-1 | 1 | 6.82 ms | 5.80 ms | 0.24 ms | 0.26 ms | 0.22 ms | 0.30 ms | 0.05 ms | 0.01 ms | 0.02 ms | 0.00 ms | 702 KB |
| remove-1 | 1 | 4.00 ms | 10.1 ms | 0.27 ms | 0.27 ms | 0.23 ms | 0.25 ms | 0.04 ms | 0.00 ms | 0.02 ms | 0.00 ms | 696 KB |
| update-1 | 1 | 4.44 ms | 9.37 ms | 0.34 ms | 0.34 ms | 0.31 ms | 0.27 ms | 0.04 ms | 0.00 ms | 0.01 ms | 0.00 ms | 694 KB |
| update-10 | 10 | 5.30 ms | 8.34 ms | 0.19 ms | 0.19 ms | 0.17 ms | 0.17 ms | 0.03 ms | 0.00 ms | 0.01 ms | 0.00 ms | 695 KB |
| update-100 | 100 | 4.50 ms | 9.70 ms | 0.30 ms | 0.30 ms | 0.25 ms | 0.15 ms | 0.02 ms | 0.06 ms | 0.01 ms | 0.00 ms | 707 KB |
| update-1pct | 10 | 5.03 ms | 10.3 ms | 0.40 ms | 0.40 ms | 0.36 ms | 0.49 ms | 0.03 ms | 0.00 ms | 0.01 ms | 0.00 ms | 696 KB |
| update-10pct | 100 | 4.98 ms | 9.77 ms | 0.25 ms | 0.25 ms | 0.21 ms | 0.53 ms | 0.04 ms | 0.00 ms | 0.02 ms | 0.00 ms | 706 KB |
| update-100pct | 1000 | 3.49 ms | 8.83 ms | 0.28 ms | 0.28 ms | 0.26 ms | 0.36 ms | 0.02 ms | 0.20 ms | 0.01 ms | 0.00 ms | 814 KB |

JS commit cost vs. changed markers: empirical exponent -0.04 (0 = flat, 1 = linear).

#### mutations-continuous-1k steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | markers.set | markers.fingerprint | markers.indexBuild | markers.viewportCompute | markers.applyDiff | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| continuous |  | 2.58 ms | 13.7 ms | 0.29 ms | 14.7 ms | 12.6 ms | 15.9 ms | 2.04 ms | 3.59 ms | 6.5 MB |

#### mutations-continuous-10k steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | markers.set | markers.fingerprint | markers.indexBuild | markers.viewportCompute | markers.applyDiff | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| continuous |  | 12.3 ms | 7.07 ms | 0.91 ms | 45.6 ms | 44.1 ms | 16.1 ms | 2.32 ms | 0.19 ms | 44.3 MB |

#### polyline-100 steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | polylines.set | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| restyle | 100 | 0.55 ms | 13.3 ms | 0.46 ms | 0.46 ms | 36 KB |
| perturb | 100 | 0.62 ms | 12.5 ms | 0.41 ms | 0.41 ms | 36 KB |

#### polyline-1k steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | polylines.set | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| restyle | 1000 | 0.97 ms | 12.1 ms | 0.64 ms | 0.64 ms | 167 KB |
| perturb | 1000 | 1.08 ms | 12.3 ms | 0.73 ms | 0.73 ms | 177 KB |

#### polyline-10k steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | polylines.set | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| restyle | 10000 | 1.37 ms | 9.61 ms | 3.00 ms | 3.00 ms | 1.0 MB |
| perturb | 10000 | 1.76 ms | 3.75 ms | 2.75 ms | 2.75 ms | 1.1 MB |

#### polyline-100k steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | polylines.set | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| restyle | 100000 | 6.12 ms | 16.0 ms | 15.4 ms | 15.4 ms | 9.9 MB |
| perturb | 100000 | 6.00 ms | 11.8 ms | 14.5 ms | 14.5 ms | 11.0 MB |

#### polygon-100 steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | polygons.set | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| restyle | 100 | 0.79 ms | 12.8 ms | 0.83 ms | 0.83 ms | 36 KB |

#### polygon-1k steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | polygons.set | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| restyle | 1000 | 0.80 ms | 13.6 ms | 1.05 ms | 1.05 ms | 167 KB |

#### polygon-10k steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | polygons.set | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| restyle | 10000 | 1.16 ms | 6.55 ms | 3.49 ms | 3.49 ms | 1.0 MB |

#### polylines-200x50 steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | polylines.set | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| restyle-all |  | 2.10 ms | 7.44 ms | 12.2 ms | 12.2 ms | 525 KB |

#### polygons-200x20 steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | polygons.set | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| restyle-all |  | 1.10 ms | 13.8 ms | 5.66 ms | 5.66 ms | 233 KB |

#### cluster-1k steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | markers.set | markers.fingerprint | markers.indexBuild | markers.viewportCompute | markers.applyDiff | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| zoom-sweep |  | N/A | N/A | N/A | N/A | N/A | N/A | 12.8 ms | 68.9 ms | 220 KB |
| pan |  | N/A | N/A | N/A | N/A | N/A | N/A | 10.3 ms | 1.13 ms | 109 KB |
| update-1pct | 10 | 1.58 ms | 13.7 ms | 0.26 ms | 0.26 ms | 0.24 ms | 0.26 ms | 0.86 ms | 0.10 ms | 148 KB |

#### cluster-10k steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | markers.set | markers.fingerprint | markers.indexBuild | markers.viewportCompute | markers.applyDiff | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| zoom-sweep |  | N/A | N/A | N/A | N/A | N/A | N/A | 33.5 ms | 72.9 ms | 253 KB |
| pan |  | N/A | N/A | N/A | N/A | N/A | N/A | 47.4 ms | 1.46 ms | 110 KB |
| update-1pct | 100 | 11.2 ms | 6.10 ms | 1.08 ms | 1.08 ms | 1.07 ms | 0.31 ms | 4.19 ms | 0.18 ms | 932 KB |

#### cluster-50k steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | markers.set | markers.fingerprint | markers.indexBuild | markers.viewportCompute | markers.applyDiff | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| zoom-sweep |  | N/A | N/A | N/A | N/A | N/A | N/A | 242.8 ms | 163.9 ms | 219 KB |
| pan |  | N/A | N/A | N/A | N/A | N/A | N/A | 248.8 ms | 2.05 ms | 110 KB |
| update-1pct | 500 | 62.3 ms | 15.4 ms | 2.95 ms | 2.95 ms | 2.93 ms | 0.67 ms | 22.9 ms | 0.15 ms | 4.3 MB |

#### combined-10k-updates steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | markers.set | markers.fingerprint | markers.indexBuild | markers.viewportCompute | markers.applyDiff | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| updates-while-panning |  | 10.2 ms | 8.26 ms | 1.07 ms | 26.8 ms | 26.0 ms | 7.67 ms | 3.55 ms | 4.19 ms | 22.3 MB |

#### combined-10k-polyline steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | polylines.set | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| route-update |  | 2.85 ms | 15.5 ms | 1.94 ms | 1.93 ms | 1.1 MB |

#### combined-10k-polygon steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | polygons.set | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| restyle-all |  | 4.91 ms | 13.8 ms | 7.99 ms | 7.99 ms | 235 KB |

#### combined-all steps (median over repeats)

| Step | Changed | JS commit | Commit → native | Native setter | markers.set | markers.fingerprint | markers.indexBuild | markers.viewportCompute | markers.applyDiff | JS alloc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| updates-while-panning |  | 12.0 ms | 9.91 ms | 1.01 ms | 20.3 ms | 19.4 ms | 8.57 ms | 14.1 ms | 22.0 ms | 17.9 MB |

#### stability-5m timeline

| Window | At | FPS | p95 | p99 | Worst | Jank | RAM | CPU | JS alloc | Native main |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| minute-1 | 63 s | 60.0 | 16.7 ms | 16.7 ms | 33.3 ms | 0.0 % | 664 MB | 26 % | 11.5 MB | 326.2 ms |
| minute-2 | 125 s | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 640 MB | 22 % | 13.0 MB | 247.1 ms |
| minute-3 | 188 s | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 704 MB | 22 % | 13.0 MB | 228.6 ms |
| minute-4 | 251 s | 60.0 | 16.7 ms | 16.7 ms | 16.7 ms | 0.0 % | 714 MB | 21 % | 12.8 MB | 199.3 ms |

Drift first → last window: FPS 0.0, RAM 50 MB.

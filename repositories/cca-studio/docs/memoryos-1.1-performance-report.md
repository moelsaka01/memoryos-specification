# MemoryOS 1.1 Performance Report

## Purpose

This report records the MO-1108 performance audit of Memory Studio's observable-cognition pipeline. Measurements are from executable production modules and accepted observation frames; they are not estimates or synthetic delays.

## Test environment

- Date: 2026-08-23
- Platform: Windows x64
- Processor: Intel64 Family 6 Model 140, stepping 1
- Node.js: 24.14.0
- V8: 13.6.233.17
- Samples per size: 5
- Garbage collection: explicitly exposed between samples
- Startup to benchmark entry after module loading: **60.871 ms**

The raw result is [memoryos-1.1-benchmark-results.json](../benchmarks/memoryos-1.1-benchmark-results.json). Results are specific to this machine and should be compared only with runs using the same environment and command.

## Latency results

Values are median milliseconds; parenthesized values are p95.

| Nodes | Accept observation | Build trace | Replay | Evolution | Comparative reconstruction | Comparative replay | Renderer preparation |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 6.616 (14.392) | 7.089 (11.224) | 0.273 (0.709) | 0.548 (0.700) | 1.625 (1.755) | 4.029 (5.851) | 4.137 (5.788) |
| 500 | 19.756 (21.098) | 22.804 (30.772) | 0.185 (0.264) | 1.102 (1.181) | 2.274 (2.890) | 4.265 (5.333) | 4.830 (4.872) |
| 1,000 | 33.358 (35.438) | 41.833 (43.700) | 0.363 (0.407) | 4.318 (5.543) | 4.582 (5.258) | 3.882 (6.032) | 4.759 (4.907) |
| 5,000 | 222.416 (241.658) | 323.220 (406.508) | 0.570 (0.655) | 10.507 (11.065) | 23.135 (29.087) | 4.752 (6.572) | 9.424 (10.611) |
| 10,000 | 514.329 (535.370) | 657.623 (717.559) | 0.489 (0.671) | 20.157 (27.953) | 41.921 (50.995) | 4.876 (6.821) | 15.346 (18.585) |

`Renderer preparation` measures validation and preparation of Trace, Evolution, and Comparative renderer state. Browser DOM construction and frame delivery are measured separately because Node.js cannot measure browser layout or paint.

## Browser rendering results

The release browser run used Chrome 151 on Windows 10 x64, 8 logical processors, 16 GiB reported device memory, and a 1280 × 720 viewport at DPR 1.5. Measurements below are real browser values from [memoryos-1.1-browser-render-results.json](../benchmarks/memoryos-1.1-browser-render-results.json).

| Nodes | DOM elements | Projection | DOM construction | Cold frame | Visual settle | Click sync | Steady interaction frame | Browser heap |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 2,446 | 7.7 ms | 28.7 ms | 117.6 ms | **1,336.2 ms** | 1.1 ms | 0.546 ms | 4.925 MiB |
| 500 | 1,643 | 10.3 ms | 28.9 ms | 264.9 ms | 110.4 ms | 0.5 ms | 1.8 ms | 3.884 MiB |
| 1,000 | 3,143 | 12.5 ms | 54.4 ms | 104.9 ms | 120.1 ms | 0.6 ms | 36.0 ms | 6.444 MiB |
| 5,000 | 15,143 | 72.9 ms | 281.6 ms | 764.3 ms | 103.0 ms | 1.9 ms | 120.8 ms | 19.806 MiB |
| 10,000 | 30,143 | 405.0 ms | 1,391.4 ms | 2,473.3 ms | 145.2 ms | 4.5 ms | 318.1 ms | 31.798 MiB |

`Cold frame` is the first animation-frame callback after renderer invocation. `Visual settle` is an actual task boundary requested after cold frame delivery, before the click; it is not a fixed value. `Steady interaction frame` therefore excludes the initial SVG paint.

The 100-node visual-settle value is a measured scheduling outlier. It is intentionally retained rather than filtered or replaced. The immediately following click completed synchronously in 1.1 ms and reached its frame callback in 0.546 ms.

Dense-mode interaction work remains small: the 10,000-node click mutation completed synchronously in 4.5 ms. Browser painting still grows with real SVG cardinality—318.1 ms for the 10,000-node steady frame—so the largest target degrades deliberately rather than claiming 60 fps. All semantic nodes and relationships remain present and interactive.

## Memory results

Retained heap was measured with the complete immutable two-frame investigation, both traces, Evolution, and Comparative Reconstruction live.

| Nodes | Edges | Retained heap |
| ---: | ---: | ---: |
| 100 | 152 | 0.284 MiB |
| 500 | 552 | 0.972 MiB |
| 1,000 | 1,052 | 1.864 MiB |
| 5,000 | 5,052 | 8.948 MiB |
| 10,000 | 10,052 | 18.467 MiB |

## Findings and corrective work

1. **Repeated canonical frame projection.** Trace and Evolution validation rebuilt and serialized an immutable semantic world multiple times. Module-private weak caches now retain only the fact that a deeply immutable object identity has already passed canonical validation. Weak references do not extend frame or trace lifetime. Invalid or mutable inputs remain uncached and follow the original validation path.
2. **Quadratic alignment storage.** Comparative Reconstruction used a JavaScript-number LCS table. A 10,000 by 10,000 alignment could require hundreds of MiB. The replacement preserves immediate-match and Observation-A tie behavior exactly, stores directions in two bits per cell, and uses linear fast paths for identical and insertion/removal-only traces.
3. **Repeated renderer searches.** Trace relationship lookup and graph adjacency were repeatedly scanned. They are now exact keyed indexes.
4. **Unbounded decorative DOM.** Dense worlds retain every semantic node, edge, flow, and interaction while dropping non-semantic synapses, microstructure, redundant node layers, edge titles, and duplicate inventory. Dense mode begins at 500 nodes.
5. **Full-world interaction updates.** Hover, selection, Replay, and Comparative transitions now update only affected semantic keys. Perspective/filter changes retain the full deterministic update because they intentionally affect the complete world.
6. **Host-dependent ordering.** Evolution now uses direct code-unit lexical ordering rather than locale collation.

No public contract, runtime behavior, semantic identity, ordering rule, or renderer responsibility changed.

## Reproduction

```console
cd repositories/cca-studio
npm run benchmark -- --samples=5 --output=benchmarks/memoryos-1.1-benchmark-results.json
npm run test:scalability
```

Run the browser-native benchmark through `http://127.0.0.1:4173/benchmark.html?autorun=1`. It measures actual DOM construction, next-frame delivery, click emphasis, DOM cardinality, and browser heap when supported.

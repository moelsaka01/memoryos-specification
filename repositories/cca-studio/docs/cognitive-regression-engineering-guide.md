# Cognitive Regression Engineering Guide

## Purpose

This guide defines the implementation boundary for MO-1206 Cognitive
Regression Analysis. The Investigation Core owns comparison. SDK, CLI, Studio,
and future transports may format a report, but they must not recompute it.

## Execution boundary

`InvestigationCore.regression(baselineIdentifier, candidateIdentifier)` loads
two Core-owned immutable investigations, enforces Workspace and source-kind
compatibility, and delegates factual comparison to
`cognitive-regression.js`. The operation does not use the Core commit path and
therefore cannot append a transition or change lifecycle state.

`MemoryOS.regression(baseline, candidate)` is the JavaScript SDK facade. It
checks handle ownership, delegates once to the Core, and wraps the returned
value as an immutable `RegressionReport` without changing its content.

## Deterministic comparison

Each category projects stable subjects and source-authored values from the two
investigations. Subjects are canonicalized, unioned, and sorted lexically.
Values are canonicalized and hashed with the category and the
`INVESTIGATION-CORE-REGRESSION-FACT-1.0` domain. The ordered report material is
then hashed with `INVESTIGATION-CORE-REGRESSION-1.0` to produce its identifier.

Directional rules are exact:

| Baseline subject | Candidate subject | Result |
| --- | --- | --- |
| absent | present | `added` |
| present | absent | `removed` |
| present, different digest | present, different digest | `modified` |
| present, same digest | present, same digest | no difference |

Reversing inputs deterministically reverses `added` and `removed` and swaps
before/after digests. It does not introduce interpretation.

## Exclusions

Regression does not consume DOM, canvas, renderer, layout, camera, color,
animation, timing, wall-clock, randomness, provider SDK, or network state. It
also excludes package descriptions, authorship presentation, unknown
non-critical extension payloads, compatibility declarations, and local Core
aliases. Those values are not cognition.

## Integrity

The engine accepts only frozen Investigation Core objects with the closed Core
shape and internally consistent investigation, state, and transition-log
identity. The public report validator verifies:

- the closed report, descriptor, category, and difference shapes;
- exact category order and status vocabulary;
- ordered unique subjects;
- SHA-256 digest form and directionality;
- aggregate status consistency; and
- the canonical report identifier.

## Verification

From the workspace root:

```console
npm --prefix repositories/cca-studio run test:regression
npm --prefix repositories/cca-studio run test:investigation-core
npm --prefix repositories/cca-studio run test:sdk
```

The dedicated CTest registration is `cca.memory_studio.regression` when Node.js
and `CCA_ENABLE_STUDIO_WEB_TESTS` are available.


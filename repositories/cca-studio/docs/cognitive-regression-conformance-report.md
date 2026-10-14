# Cognitive Regression Conformance Report

## Purpose

This report maps the MO-1206 Core and JavaScript SDK acceptance boundary to
implementation and automated evidence.

| Acceptance condition | Implementation | Automated evidence |
| --- | --- | --- |
| One regression implementation | `web/js/cognitive-regression.js`, invoked only by `InvestigationCore.regression()` | Architecture dependency assertions and SDK-to-Core parity |
| Read-only execution | Core regression bypasses the transition commit path | Transition-log digest and projection equality before/after comparison |
| Fixed categories and statuses | Closed report validator | Contract, ordering, shape, and aggregate-status tests |
| Evidence differences | Current native evidence nodes or verified MIP evidence records | Added, removed, and modified evidence tests |
| Reflection and Retrieval differences | Current source-authored semantic records | Independent modification tests |
| Replay differences | Existing Replay artifact and current deterministic Replay state | Replay-state regression test |
| Evolution differences | Current semantic transformations and relationships plus existing exact Evolution artifacts, excluding renderer projections | Native and MIP semantic-change, relationship-change, Evolution-artifact, and renderer-exclusion tests |
| Verification differences | Existing package and Core verification evidence | Verification-state tests |
| Transition differences | Normalized immutable transition history, including accepted native Observation truth | Transition-only, converged-state history, and cognition-digest import tests |
| Lifecycle differences | Current derived Core lifecycle | Lifecycle-only test |
| Package neutrality | Local aliases, metadata, and extension compatibility are excluded | Equivalent-package and supported-extension tests |
| Ownership | Same Workspace and same source kind are mandatory | Workspace, source-kind, missing-handle, and foreign-SDK-handle failures |
| Determinism | Canonical subjects, fixed ordering, domain-separated SHA-256 digests | Repetition, direction reversal, JSON stability, and bounded performance tests |
| No interpretation | No scoring, ranking, inference, prediction, explanation, or summary logic | Source-boundary architecture assertion |
| Immutable publication | Deep-frozen Core report and SDK wrapper | Recursive immutability and construction-boundary tests |

## Test entry points

```console
npm --prefix repositories/cca-studio run test:regression
npm --prefix repositories/cca-studio test
```

The schema is
[cognitive-regression-report-1.0.schema.json](schemas/cognitive-regression-report-1.0.schema.json).

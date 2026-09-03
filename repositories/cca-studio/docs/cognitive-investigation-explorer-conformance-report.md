# Cognitive Investigation Explorer Conformance Report

## Purpose

This report maps MO-1207 Core acceptance conditions to implementation and
automated evidence.

| Acceptance condition | Implementation | Automated evidence |
| --- | --- | --- |
| One navigation implementation | `cognitive-investigation-explorer.js`, called by `InvestigationCore.investigate()` | Dependency and Core-delegation assertions |
| Existing reports | Canonical clone plus MO-1206 report validation | Detached JSON, malformed report, and tampered identity tests |
| Reflection navigation | Exact Reflection subject identity | Found and missing Reflection tests |
| Replay navigation | Fixed Replay category projection | Replay category test |
| Evidence navigation | Fixed Evidence category projection | Modified and added evidence endpoint tests |
| Retrieval navigation | Fixed Retrieval category projection | Retrieval category test |
| Evolution navigation | Fixed Evolution category projection | Semantic transformation test |
| Transition navigation | Exact transition kind/action locators | Replay action selector test |
| Lifecycle navigation | Exact lifecycle-state locators | `ReplayComplete` normalization and selection test |
| Verification navigation | Fixed Verification category projection | Verification category test |
| Evidence termination | Nullable endpoints point to exact existing report digests | Pointer, source identity, directionality, and digest equality tests |
| Deterministic ordering | Fixed category order and existing difference order | Match index, repeated result, and validator ordering checks |
| Deterministic JSON | Canonical result serializer | Byte-identical repeated serialization test |
| Read-only behavior | No Core commit path | Transition-log digest and projection equality tests |
| No execution or interpretation | No Trace, Replay, renderer, scoring, inference, or explanation dependency | Static architecture boundary test |
| Failure safety | Validate before result publication | Query and report failure tests |
| Bounded performance | Linear traversal of a validated report | 100-operation bounded performance test |
| Executable example | Dependency-free Node.js example | Example execution in release validation |

## Test entry points

```console
npm --prefix repositories/cca-studio run test:explorer
npm --prefix repositories/cca-studio test
```

The machine-readable result contract is
[cognitive-investigation-result-1.0.schema.json](schemas/cognitive-investigation-result-1.0.schema.json).

# MO-1207 CLI Investigation Conformance Report

## Purpose

This report records CLI conformance for deterministic Cognitive Regression investigation.

## Architecture boundary

| Requirement | Evidence | Status |
|---|---|---|
| SDK-only navigation | The command invokes only `MemoryOS.investigate()` with parsed JSON and an explicit query. | Conformant |
| No duplicated navigation | CLI production source does not import the Explorer, Cognitive Regression, Investigation Core, or MIP modules. | Conformant |
| Immutable source truth | The CLI neither changes the Regression Report nor constructs result matches or evidence endpoints. | Conformant |
| Renderer independence | Human and JSON formatting consume the same immutable SDK result. | Conformant |

## Command contract

```text
memoryos investigate REPORT [--category CATEGORY] [--reflection ID] [--transition TRANSITION] [--json]
```

`REPORT` is a raw SDK Regression Report or the successful deterministic envelope emitted by `memoryos regression --json`. The SDK owns report validation, category selection, Reflection identity matching, transition normalization, selector compatibility, result identity, and deterministic match ordering.

The CLI supports no fuzzy search, inferred selection, ranking, summarization, explanation, or AI interpretation.

## Automated evidence

The CLI suite covers Evidence, Reflection, Replay, Retrieval, Evolution, transition, and Verification navigation; raw and enveloped reports; empty results; exact SDK parity; repeated JSON stability; human rendering; invalid arguments, reports, categories, and selector combinations; architecture boundaries; and bounded execution.

The executable example creates a real Regression envelope and investigates it through the production `memoryos` entry point.

```sh
npm test
npm run test:examples
```

## Assessment

The MO-1207 CLI is a conformant presentation and automation boundary over the single deterministic Regression Explorer implementation exposed by the MemoryOS SDK.

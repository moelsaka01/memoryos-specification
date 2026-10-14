# MO-1206 CLI Regression Conformance Report

## Purpose

This report records CLI conformance for deterministic Cognitive Regression Analysis.

## Architecture boundary

| Requirement | Evidence | Status |
|---|---|---|
| SDK-only execution | The production command imports both packages through `MemoryOS` and invokes `MemoryOS.regression()` once. | Conformant |
| One regression implementation | No CLI source imports the Investigation Core, MIP implementation, or Cognitive Regression module. | Conformant |
| Read-only operation | The CLI passes SDK-owned Investigation handles without applying lifecycle operations. | Conformant |
| Exact report truth | JSON output contains the immutable SDK Regression Report; the CLI only canonicalizes object-key encoding. | Conformant |

## Command contract

```text
memoryos regression BASELINE CANDIDATE [--json]
```

Both operands are explicit MIP inputs. The CLI assigns fixed process-local role identifiers so packages with the same source identifier coexist in one SDK binding. These aliases do not participate in semantic comparison. At most one operand may read from standard input.

The existing `compare` command remains a single-Investigation Evolution operation. Regression is the additive two-Investigation operation and does not alter Replay, Compare, or session semantics.

## Determinism and output

- The SDK owns every category, status, difference, digest, and overall result.
- JSON preserves the SDK's category and difference array order.
- Human output deterministically expands every SDK report field.
- Output adds no explanations, summaries, rankings, timestamps, colors, randomness, or file metadata.
- Detection is a successful analysis and returns exit code `0`.
- Invalid packages and cross-Workspace inputs fail through the existing deterministic error mapping.

## Automated evidence

The CLI suite verifies exact operand grammar, identical packages, changed cognition, stable repeated JSON, direct SDK result parity, human rendering, invalid packages, one-stdin enforcement, and cross-Workspace rejection. The architecture test verifies that production CLI sources retain exactly one platform dependency: the public SDK facade.

The executable example invokes Regression through `bin/memoryos.js` alongside every released MO-1205 command.

```sh
npm test
npm run test:examples
```

## Assessment

The MO-1206 CLI is a conformant automation boundary over the single Investigation Core implementation exposed by the MemoryOS SDK.

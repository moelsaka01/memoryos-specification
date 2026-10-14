# MO-1301 conformance and release-readiness guide

This guide describes the additive MemoryOS 1.3 Investigation Policies
assessment. It does not modify or replace the published CCA-MEMORYOS-1.0
assessment. MemoryOS v1.2.1 remains the compatibility baseline, and every
retained v1.2.1 manifest, review, evidence, and report is byte-pinned by the
separate [`mo1301-conformance-inventory.json`](../mo1301-conformance-inventory.json).

## Assessment boundary

The MO-1301 inventory binds:

- the v1.2.1 baseline and approved Phase 1 through Phase 3 commits;
- all 16 frozen machine-definition identities;
- Fact Model, Rule Registry, Deterministic Fact Source Registry, Regression
  source-model, Resource Profile, evaluator, and outcome identities;
- the 31-limit Resource Profile and its 4060-byte outcome closure;
- references to all 17 final Evaluation Identity/outcome vectors and all 10
  cache vectors;
- SDK and CLI product version `1.1.0`; and
- the logical conformance areas required by Contract Freeze 8.

The inventory references the frozen Studio vectors in place. It does not copy,
regenerate, or reinterpret them. It also records that CCA-MEMORYOS-1.1 is an
intended later publication, not an existing normative Standard.

## Logical coverage

The focused MO-1301 suite covers policy artifacts and sets, fact contexts,
Regression sources, registries, rule evaluation, evidence, aggregation,
resources, Evaluation Identity, outcomes, cache behavior, the three SDK
surfaces, CLI behavior, provenance, cross-language byte parity, available
cross-platform execution, and the MO-1302 handoff.

The production JavaScript SDK integration suite independently exercises every
production-reachable row of all six rules, exact evidence, the five required
Policy and Policy Set aggregation combinations, authored ordering, and no
short-circuit behavior. It also reproduces all 17 golden evaluations and all 10
cache records at the closest valid public/private boundary. The focused Phase
1 through Phase 3 implementation tests remain additional branch-level oracles
for limit boundaries, provenance rejection, and evaluator internals.

The conformance layer authenticates the frozen definitions, validates exact
retained identity and outcome bytes, verifies publication cross-bindings,
compares exact restricted-JCS contract-identity bytes, and executes one common
MIP-backed Policy request through the JavaScript SDK, Python SDK, CLI, and raw
private bridge. That production-surface vector requires byte-identical canonical
Policy, Evaluation Identity, and outcome artifacts, plus identical digests and
decision. The layer also exercises handoff mappings; it does not create a second
evaluator.

Run the focused assessment from the workspace root:

```console
npm --prefix repositories/cca-conformance run test:mo1301
```

Run the complete registered MemoryOS conformance package:

```console
MEMORYOS_CONFORMANCE_PYTHON=/absolute/path/to/python npm --prefix repositories/cca-conformance test
```

The CMake registration is `memoryos.standard.mo1301` and carries the
`memoryos-1.3`, `mo1301`, and conformance labels in addition to the historical
MemoryOS Standard labels.

## Version separation

| Surface | Version |
|---|---|
| JavaScript, Python, and C++ SDK products | `1.1.0` |
| MemoryOS CLI product | `1.1.0` |
| Policy and Policy Set artifacts | `1.0.0` |
| Fact Model and PolicyFactContext | `1.0.0` |
| Rule and source registries | `1.0.0` |
| Evaluator and outcome contract | `1.0.0` |
| Resource Profile | `memoryos.policy.resource-profile.standard@1.0.0` |
| Published MemoryOS Standard | `CCA-MEMORYOS-1.0` |

Product versions and normative contract versions are deliberately independent.

## Evidence interpretation

Passing detached-artifact checks proves byte, canonicalization, schema,
identity, and digest properties only. It does not reconstruct authoritative
Core state or trusted Regression provenance. Tests that require authority use
owner-bound capabilities minted by the production integration path.

The two historical v1.2.1 inventory checks may report the already-known source
inventory mismatch after intentional v1.3 tracked files are added. That signal
is retained and reported separately; the historical manifest is never rewritten
to bless new files. The MO-1301 inventory attests the new surface.

## Platform status

Windows execution in the current development host is reported separately from
Linux and macOS configuration readiness. Tests configured for another platform
are not reported as executed. Native C++ parity remains a release gate whenever
the host lacks a permitted compiler or the pinned dependency environment cannot
resolve. The bridge/protocol and source-level contract checks remain executable
without claiming native C++ execution.

## Publication gate

This assessment is release-readiness material, not a release artifact. It does
not create a tag, publish a release, write GitHub Actions YAML, or publish
CCA-MEMORYOS-1.1. Candidate Standard materialization follows implementation,
full parity/conformance, and independent review.

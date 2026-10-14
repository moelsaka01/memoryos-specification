# Cognitive Investigation Explorer Engineering Guide

## Purpose

This guide defines the MO-1207 implementation boundary. The Explorer navigates
an existing Cognitive Regression Report; all consumers delegate to the
Investigation Core and must not reconstruct navigation independently.

## Authority boundary

`InvestigationCore.investigate(report, query)` delegates once to the
renderer-independent Explorer module. The module canonical-clones a detached
JSON report, validates its closed MO-1206 contract and content identity,
normalizes the closed query, and projects matching report differences.

The Core accepts the raw Regression Report. A CLI transport envelope is not a
Core concept and must be unwrapped by its transport owner before delegation.
No consumer may modify the report or synthesize missing evidence during that
transport step.

Studio loads a detached report from its ordinary semantic-world context and
passes it unchanged to the public JavaScript SDK. It does not require Trace,
Replay, or Cognitive Evolution first. The load is atomic: Core validation and
Workspace matching must both succeed before Studio retains or renders the
report. Subsequent category navigation calls only `MemoryOS.investigate()`
over that retained report. Presentation-level location is enabled only for an
exact node key in the active observed frame and does not activate a Trace.

## Deterministic navigation

Navigation traverses only the report's fixed category sequence and the
existing ordered differences in each category. It does not sort by a client
preference, score, or relevance. Result identity uses canonical JSON and the
domain `INVESTIGATION-CORE-EXPLORER-1.0`.

Transition and lifecycle difference subjects carry factual locators derived
while MO-1206 already compares their authoritative values. These additive
subject members preserve the closed top-level Regression Report contract and
allow exact selection such as `replay-complete`; they do not add semantic
interpretation.

## Evidence termination

Every non-null endpoint points to one existing `beforeDigest` or `afterDigest`
inside the validated report. The endpoint repeats only the minimum source
descriptor needed by an independent client to identify the side. Semantic
payloads are not copied into Explorer results.

## Prohibited behavior

The Explorer imports no renderer, DOM, Trace builder, Replay controller,
Evolution engine, provider SDK, network client, clock, timer, or randomness.
It never:

- computes regression;
- reruns Replay;
- creates investigation state;
- mutates source investigations;
- explains, summarizes, ranks, predicts, or infers; or
- resolves presentation layout.

## Verification

From the workspace root:

```console
npm --prefix repositories/cca-studio run test:explorer
node repositories/cca-studio/examples/cognitive_investigation_explorer_usage.mjs
```

The CTest entry is `cca.memory_studio.investigation_explorer` when Node.js and
the mandatory Studio web tests are enabled.

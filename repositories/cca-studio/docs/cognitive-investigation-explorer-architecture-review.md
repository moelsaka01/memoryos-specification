# Cognitive Investigation Explorer Architecture Review

## Purpose

This review assesses MO-1207 against the established MemoryOS platform
boundaries and the requirement that navigation terminate at deterministic
evidence already represented by the Investigation Core.

## Authority assessment

The dependency direction remains:

```text
Runtime truth
    ↓
Investigation Core
    ↓
Cognitive Regression Report
    ↓
Cognitive Investigation Explorer
    ↓
SDK / CLI / Studio
```

The Explorer is invoked through `InvestigationCore.investigate()`. SDK, CLI,
and Studio are consumers. They may transport or present the immutable result,
but they do not own navigation behavior.

## Read-only flow

The input is a detached or in-process Regression Report plus a closed query.
The operation validates the report identifier and follows ordered difference
references. It does not load, replay, compare, checkpoint, restore, or commit
an investigation. Consequently, it cannot change a transition log, lifecycle,
Replay cursor, Verification state, or cognitive artifact.

## Determinism assessment

The source order is fixed by the validated Regression Report. Query
normalization is lexical and deterministic. Endpoints are JSON pointers to
existing digest members. Result identity is a domain-separated SHA-256 digest
of the canonical result material. Equivalent reports and queries therefore
produce byte-identical serialized results.

## Separation assessment

The Explorer module depends only on the Cognitive Regression contract and
canonical JSON/integrity utilities. It contains no renderer, layout, UI,
Replay, Trace, runtime, adapter, SDK, or provider dependency. Semantic payloads
are not duplicated. Missing matches produce an immutable empty result rather
than fabricated evidence.

## Review conclusion

MO-1207 preserves the MemoryOS execution authority, renderer separation,
Workspace boundary, and deterministic evidence model. No Replay,
recomputation, inference, explanation, or second investigation implementation
is introduced. The core architecture is approved for integration review.

# MO-1305 R5 measurement clock model

R1 and R4 remain immutable failed attempts. R4's exact source assertion was
`baselineReceivedUtcMs <= requestStartedUtcMs && requestStartedUtcMs <= responseCompletedUtcMs && responseCompletedUtcMs <= cleanupCutoffUtcMs`
in `campaign.mjs`, line 27 of the preserved R4 source. The status and exact body
checks preceded it. The failure omitted these operands, so no particular
inequality can be identified retrospectively. Windows Kernel-General event 1
recorded a -1243 ms civil-clock change at 2026-09-24T08:27:07.3698288Z. The failed
record was written at approximately 08:27:56Z. The event supports a clock-related
explanation; it does not recover the missing operands.

## Authority and clock domains

The frozen engineering protocol is `measurement-protocol-2.0.0.json`; the failure
schema is `failure-schema-2.0.0.json`. Both are hashed build inputs. Every
clock-bearing source line is classified by `mo1305-clock-audit.py` into A civil
metadata, B duration, C ordering, D correlation, or E timeout authority. The audit
includes the complete measurement directory, outer MO-1305 tools/tests, and
unchanged gateway timing sources. No native UTC epoch is used for measurement
ordering, freshness, elapsed time, or deadline expiry.

Node uses `process.hrtime.bigint()`; nanoseconds are serialized as exact decimal
strings. Python native collection and orchestration observations use
`time.perf_counter_ns()`. This host reports QueryPerformanceCounter, monotonic
true and adjustable false. Locally inspected Python subprocess timeout code uses
`time.monotonic` for its deadline and remaining-time checks; it does not subtract
civil UTC. Timers request wakeups; the explicit monotonic comparison authorizes
expiry. Existing subprocess, process-wait and thread-join timeouts remain relative
monotonic OS/runtime waits. Sampling/trickle delays are pacing, never capture proof.

Each orchestrator, measured process and collector has a distinct named domain.
No two independent epochs are compared. Domain mismatch is an explicit failure.
The collector's GetProcessTimes creation FILETIME is a stable identity component
compared for equality; it is never ordered against current UTC. Existing product
certificate validity still uses civil certificate dates, a calendar/security rule
outside resource-measurement timing; its runtime bytes and behavior are unchanged.

## Native capture contract

READY alone is insufficient. A complete numeric row with the expected process,
candidate, archive, campaign and collector session identities must arrive.
Each requested capture gets a strictly newer ticket. The collector takes a fresh
native sample, writes and flushes its journal, calls fsync, then acknowledges that
ticket and persisted sequence. An operation starts only after its pre-capture
acknowledgement. A new post-capture ticket follows its response. The validator
recalculates summaries from the bounded raw sequence range. Same-process
monotonic stamps prove dispatch/delivery order and the unchanged 10-second
freshness bound. UTC stamps and wall-minus-monotonic deltas are descriptive,
including backward movement. Native resource counters remain unchanged.

Adverse shutdown records the final live capture, subsequent raw rows through
exit, and the actual server/collector exit results. It does not invent a sample
of a dead process or replace a real peak with zero.

## Semantic duration and runtime identity

Gateway source and contract bytes remain unchanged. The existing runtime computes
semantic operationUs with hrtime bigint from owner.started through pre-publication
integrity and worker cleanup. The non-shipping measurement launcher returns every
original hrtime value unchanged while retaining the last value. Its observation
of the synchronous ownership publication assignment records that actual endpoint
and owner.started. The derived rounded duration must equal the original runtime
metric for published operations. Cancelled/aborted observations record their
monotonic endpoint and explicit boundary without pretending a response was
published. No metric, headroom, limit or semantic result is replaced.

Request start/end are separately recorded in the orchestrator domain and yield
roundTripUs. Final semantic deadline derivation still uses the original runtime
monotonic operationUs metric. The 24 MiB worker configuration, 128 MiB frozen
ceiling, 3/2 headroom, rounding, 105 cases, 30 cold/100 warm samples and 20 adverse
scenarios with three >=60-second repetitions are unchanged.

## Failures, tests and release gate

Every timing/order failure records a code, relationship, named actual operands,
units and clock domain, plus known ticket, sequence, PID, candidate, campaign,
run, case, phase and sample index. Unknown identity fields are null only before
that identity exists. The full observed window and HTTP-check outcome survive
failure. Cleanup failures are separate records and cannot replace the primary
failure. Partial records and process exits are saved even on a failed sample.
Secrets are never recorded; generic potentially sensitive compound operands are
represented by type, byte length and digest.

The deterministic suite covers backward 1 ms/2 seconds, forward 5 seconds/one
hour, the injected R4 -1243 ms fixture, delayed readiness, stale/duplicate/out-of-
order sequences, wrong ticket/process/candidate/run/campaign, malformed or
unpersisted rows, missing post-capture, collector/process exit, monotonic timeouts,
epoch mismatch and real monotonic reversal. It never changes Windows time.

R5 starts from zero only after its new 105-case ordinary and complete adverse
smoke preflight and all clock tests pass. R4 preflight does not certify R5.
Complete input identities are frozen before the full campaign and checked before
and after ordinary and adverse execution. Any release-critical failure preserves
R5 as failed and blocks final limits, I1 and B1.

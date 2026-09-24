# MO-1305 Contract Freeze 1: verification and semantic-deadline correction

Normative correction version 2.0.0, authorized 2026-09-24. Precedence is the
original freeze, then the Windows platform correction, then this correction.
Unchanged requirements retain their authority. The executable policy is
`repositories/cca-conformance/tools/mo1305-platforms/verification-policy.json`.
This correction does not implement or certify the gateway.

The previous methodology required 105 cases times 30 cold and 100 warm samples
(13,650 observations), followed by 20 adverse scenarios times three repetitions
of at least 60 seconds. Repeating every deterministic semantic and protocol case
at that scale made iteration excessive without proportionate functional evidence.
Coverage, resource characterization, enforcement boundaries and sustained behavior
have different purposes and now have separate evidence and acceptance gates.

R1 remains FAIL (missing native capture), R4 remains FAIL (wall-clock ordering),
and R5 remains FAIL / RESOURCE_GATE. R5 provided 105/105 preflight cases,
20/20 adverse smoke scenarios, 28 clock regressions, 8,664 recorded observations
and 8,580 fully validated observations in 66 completed cases. Preserve their
identities, raw data, partial records and failure evidence. Do not rewrite their
requirements, reuse campaign IDs, or turn incomplete attempts into PASS receipts.

## Semantic-deadline ceiling correction

R5 `max-mip-policySet`, warm index 11, has valid HTTP, semantic, native capture
and same-process monotonic evidence. Its original metric is 9,281,479 microseconds:
9,281.479 ms times four is 37,125.916 ms; rounding upward to 100 ms gives 37,200 ms.
The previous 30,000 ms preliminary absolute ceiling cannot accommodate that valid
witness with the required headroom. Its replacement is **60,000 ms**.

60,000 ms is an absolute ceiling, never an automatically selected final deadline.
The final formula remains exactly
`ceil100ms(max(1000 ms, 4 * maximumObservedValidOperationMs))`.
Fresh selected-vector observations supply the final maximum. No R5 sample enters
the final derivation. All memory ceilings, 1.5x memory headroom, 4x deadline
headroom and upward rounding remain unchanged. A new ceiling breach stops work
for correction authorization; it does not trigger a broader campaign.

## Layer A: complete functional and semantic coverage

Execute every one of the 105 frozen functional cases at least once against the
final installed candidate. Require 105/105 PASS. One execution is sufficient for
a deterministic case unless another layer or a specific lifecycle requirement
requires repetition. Preserve case diversity: all semantic operations, Policy,
Policy Set, MIP, identity/outcome verification, PASS/FAIL/COULD_NOT_EVALUATE,
metadata, operational endpoints, routing/method/media handling, authentication,
authorization, strict JSON/schema, Host/proxy/browser restrictions, filesystem
and URI/SSRF rejection, stable errors and exact deterministic serialization.
Security categories also retain their dedicated adversarial/boundary witnesses.
Controlled error projections must remain distinguished from real error triggers.

## Layer B: selected resource characterization

Freeze selection before repetitions. Prefer at most 15 vectors; never exceed 20
without documented authorization. Evaluate these 16 dimensions: maximum request,
response, semantic duration, young generation, old generation, external memory,
parent memory, Base64 expansion, JSON depth/nodes/members, Policy workload,
Policy Set workload, MIP workload, Evaluation Identity verification, Policy Outcome
verification, error response, and TLS/HTTP parent workload. Collapse overlapping
dimensions when justified. Some parser/size dimensions may be established by
exact structural analysis plus Layer A/C witnesses instead of repeated vectors.

For each selection record ID/case, dimensions, relevant input/output sizes,
semantic structure, representative rationale, why omitted cases are not expected
to exceed that dimension, and supporting R1/R4/R5 observations. Historical samples
are diagnostic selection evidence only. Use fresh candidate-bound resource data.
Do not claim repeated measurements of omitted cases or statistical confidence.
The purpose is engineering characterization, observed maxima, headroom and bounds.

Default **10 cold + 20 warm** samples per selected vector; retain every sample.
Only a vector with materially unstable resource variance may be extended, up to
**30 cold + 50 warm** total. Record the trigger before extension; never extend the
entire catalog automatically. The selection record freezes an objective variance
trigger and proposed increment before execution. If a justified extension cannot
fit the task budget, preserve it as incomplete and decompose the work.

Derive memory budgets from fresh selected valid absolute peaks using unchanged
minima, ceilings, 1.5x headroom and rounding. Include relevant fresh sustained
parent-load peaks. Derive the semantic deadline from fresh selected valid semantic
durations using the unchanged formula. Derive wire limits from closed-schema
structural maxima, exact serialization and boundary witnesses where possible;
retain the original wire headroom/rounding and ceilings. No outlier exclusions.

## Layer C: exact boundary enforcement

Require N-1, N and N+1 or explicit semantic equivalents for every applicable
release-critical request/response, target/header, JSON depth/members/nodes/string,
Base64 decoded/encoded, connection/request/write-slot, rate/admission, semantic
deadline, write/drain/shutdown deadline and deterministic memory-control bound.
Distinguish parser rejection from valid semantic input. Final limits and their
OpenAPI projection require final installed confirmation. Measurement-to-final
changes must be limited to derived limits, their projection and provenance;
otherwise remeasure affected candidate behavior.

## Layer D: bounded adverse and sustained stress

All **20 adverse scenarios** still execute as bounded functional/security cases.
Select at most **10 sustained stress vectors**, collapsing overlap with explicit
risk mapping: connection churn/flood, request/rate pressure, semantic busy,
backpressure/slow clients, cancellation, worker creation/reaping, shutdown,
logging and cleanup. Default **two repetitions of 10 seconds** per selected
vector. Individually justified extensions may reach at most **three repetitions
of 20 seconds**; longer tests require separate authorization. There is no mandatory
60-second repetition. Functional minimum duration is three seconds, with explicit
state/coverage checks where a timing interval alone cannot establish the risk.

Accept only bounded memory/connections/workers/queues, correct rate behavior,
cleanup, no stale publication, leaked process/socket, crash, semantic corruption
or credential leakage. Preserve strict TCP/TLS 1.3/HTTP 1.1, raw framing/CL-TE,
parser, Host/proxy, browser, auth, JSON/schema, filesystem/network/URI boundaries,
environment hardening, runtime substitution and log-injection coverage.

## Evidence reuse and final gates

Classify existing evidence A functional, B semantic parity, C HTTP/TLS,
D security/adversarial, E installation/package, F diagnostic resource,
G historical failed attempt, H final confirmation required. Reuse only with an
explicit binding and unchanged relevant behavior. Candidate/contract changes,
incomplete evidence, weak binding or an explicit final requirement require the
affected confirmation. Do not rerun unaffected predecessor surfaces unless the
frozen regression trigger requires it; run required regressions once.

Require final real-process HTTP/TLS, Node fetch, curl, raw TLS, independent SDK
parity, one genuine isolated offline npm ci with scripts/audit/fund disabled and
initially empty cache, exact installed files, OpenAPI/schema/route/security
consistency, SBOM/notices, bounded dated primary-source advisory review, required
regressions and workspace checks. Produce distinct bounded canonical receipts
for coverage, resources, boundaries, stress, parity, transport, installation and
supply chain, bound to this methodology and candidate identities.

Commit this correction as V with subject
`docs(memoryos-1.3): bound MO-1305 phase 1 verification`, parent
`c2e3835b852fd966046ac9e984538fdcaf8b26bf`, containing only correction documentation
and necessary policy/conformance files. I1 may follow only after every revised
pre-I1 gate passes, with V as parent. B1 has I1 as parent and changes only binding
evidence/inventory. Post-B1 validation is one bounded conformance, receipt, graph,
workspace, whitespace and clean-status check, not another resource campaign.
No amend, squash, push or release tag. Phase 2/3 and Windows certification remain
pending until their own tasks. Windows 11 x64 only; Ubuntu/Linux, VM and
cross-platform parity remain NOT_REQUIRED.

## Prospective task execution budget

MO-1305 and later individual implementation/conformance tasks target at most
60 minutes and have an absolute maximum of 90 minutes unless the owner explicitly
authorizes a longer soak/certification task. Measure elapsed task time monotonically.
Before a campaign, compare its planned duration and remaining work against the
remaining budget. Do not knowingly launch work whose minimum exceeds it. Evaluate
remaining work at about 60 minutes; stop at a safe checkpoint if it cannot finish.
Stop by 90 minutes, preserve evidence and report unfinished gates. Time exhaustion
never grants PASS; decompose the work. This is engineering process policy, not
product runtime behavior, and does not rewrite released evidence.

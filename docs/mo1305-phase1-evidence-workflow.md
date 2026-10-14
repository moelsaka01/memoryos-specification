# MO-1305 Phase 1 evidence workflow

Current continuation authority: [host interruption validity and selective resume](mo1305-host-interruption-validity.md). Its task budget is a 45-minute target and 60-minute hard maximum. R6 remains FAIL; 341 independently revalidated R6 observations and 109 fresh observations complete the 450-sample modular resource aggregate. Current final acceptance and binding state are recorded in [the conformance inventory](../repositories/cca-conformance/mo1305-conformance-inventory.json) and the new modular evidence under `evidence/mo1305-phase1-resume/`. The R6 checkpoint and earlier progress notes below are historical; their obsolete counts, task budgets and absence-of-commit statements do not override the current continuation authority.

The resource campaign measures a fixed preliminary candidate, then derives
final limits using the unchanged freeze formulas. The resulting final limits
necessarily alter their own file and the OpenAPI projection. The evidence
keeps those two identities separate and proves the exact permitted difference.
This is Phase 1 resource derivation, not Phase 3 archive certification.

## Historical campaigns (superseded methodology)

The following R1/R4 description records the earlier method. R1, R4 and R5
remain FAIL; none supplies samples to the current resource derivation.
`full_run.py` now refuses the obsolete universal campaign.

### R4 identity

The corrected candidate uses archive SHA-256
`79b96b4067008bd0fef252c659333ef09341afa047b52164b92ce8e11150fd81`
(185,949 bytes) and input tree
`47dc5279fef922e4af42d71ea5ca874d802b54bf87d0857e2322a475188c55d8`.
The full runner will preserve it under
`.cache/mo1305-resource-review/frozen-candidate-r4/` after preflight succeeds.
Its ordinary evidence uses `evidence/mo1305-phase1-resource-r4/`.

The original `frozen-candidate/` and `mo1305-phase1-resource/` remain unchanged
and FAIL. The attempt stopped at cold index 17 of `header-max-bytes` because
READY preceded the first OS record. HTTP assertions passed, but no native
sample was available at summarization. The late raw record is not substituted.
All 58 complete cases, 17 partial cold records, the failed record, the archive
and the complete 285-file input snapshot remain preserved and hash-bound by
`evidence/mo1305-phase1-measurement-attempt1.json`. The corrected full campaign
starts from zero; the failed attempt supplies no successful-campaign samples.

Collector readiness now requires a real numeric row. A fresh native capture is
required before request start and after completion, with explicit UTC capture
windows in every ordinary sample. Controlled regression tests prove that READY,
stale data, timeout or collector exit cannot substitute for the required row.
The requested 20 ms interval, actual OS counters and frozen headroom are unchanged.

`tools/mo1305-phase1/full_run.py` refuses existing campaign output, preserves
the archive/source manifest/preliminary limits, executes every required sample,
and refuses any input drift. A failed sample is retained together with the
completed samples; it is not silently retried or excluded. Operational and
error cases have genuine cold server processes and warm requests too.

The 105-case catalog includes 73 independent SDK vectors and 32 operational,
parser, header, transport-error and controlled error-projection cases. Each
has 30 cold and 100 warm samples. Controlled exceptional projections measure
serialization and publication cost; real timeout, overload and integrity
triggers execute separately in the fault, lifecycle and adverse suites.
A deliberately schema-maximal error is not labelled an SDK-produced error.

Twenty adverse scenarios each run three repetitions of at least 60 seconds.
Naturally paused readers can fit the small bounded products in Windows TCP
buffers; that measured result is retained. A separate engineering adapter
withholds the real TLS Writable completion callbacks to exercise four blocked
write slots and their actual deadline. It does not change production files.

Each ordinary sample records worker committed generation peaks, live and
allocated counters, external and ArrayBuffer memory, parent absolute peaks and
explicit deltas, native process counters and OS peak working set, timing,
lengths, output digest, ownership counts and cleanup. The process monitor is
outside the service. V8 sampling can miss transient peaks during synchronous
work; the OS peak counter and frozen headroom are retained. Private native
allocations and trusted-code hooks do not constitute a hostile-code sandbox.

The native `cleanup` summary is the last successful OS counter sample in the
observation window, not a postmortem zero-memory measurement. Shutdown cases
record successful process exit separately. The 20 ms value is the requested
sampling interval; collection and scheduling add latency. Parent ownership
cleanup is checked from the final service state independently of OS sampling.

## Current bounded derivation and confirmation

The verification/deadline correction V takes precedence over the historical
method above. R6 selects 15 resource vectors before execution, each with
10 cold and 20 warm observations. Only a vector that triggers the frozen
variance rule may extend, up to 30 cold and 50 warm. The selected nine stress
vectors run twice for 10 seconds. Neither campaign claims statistical
confidence. The complete 105-case functional catalog executes once against
the final derived candidate; all 20 adverse scenarios also execute once.

The exact R6 source, archive, harness, fixtures and external-tool identities
are frozen under `.cache/mo1305-bounded-r6/frozen-measured/`. Inputs are
checked before and after resource and stress execution. The old R1/R4/R5
artifacts are independently hash-checked without changing them.

After the selected resource and stress campaigns and input checks pass:

1. `tools/mo1305-finalize.py derive` verifies all counts and hashes, computes
   maxima over every fresh selected resource and stress sample, applies the
   unchanged 1.5x memory and 4x deadline formulas with frozen rounding,
   and refuses every ceiling breach before writing FINAL limits.
2. The unchanged deterministic builder creates the final package.
3. `tools/mo1305-finalize.py adjustment` proves that only limits and OpenAPI
   changed in the source tree; only those files and generated dependency/SBOM
   provenance changed in the distribution. It does not rewrite measured samples.
4. `tools/mo1305-final-validation.py` executes fresh offline installation,
   105 functional cases, 20 adverse functional cases, targeted stress
   confirmation under the lowered budgets, package tests, installed
   security/lifecycle/client/parity tests, exact
   boundaries, actual Windows Ctrl+C, two independent builds, regressions,
   workspace verification and whitespace checks. Every command is archive-bound
   and preserves its exit code and raw log.
5. `tools/mo1305-receipts.py` creates ten separate canonical resource, functional, boundary, stress, parity,
   installation, supply-chain, package, HTTP and security receipts and the Phase 1 pending inventory from completed execution
   records. Generation is not validation. The conformance suite independently
   checks all artifacts, counts, formulas, expected results and source bindings.

Response-budget boundaries above the largest attainable compact schema product
use controlled byte-count witnesses against the actual publication comparison.
They are not fabricated valid SDK responses. Fake monotonic clocks exercise
exact deadline N-1/N/N+1 values and accompany real socket/worker deadline tests.
Base64 character counts and decoded-byte counts are checked separately.
Non-variable runtime configuration such as the fixed worker stack is recorded
as configuration and verified in runtime inspection, not mislabelled as a
client-input boundary. Logger saturation and bounded drain use controlled sinks.

## Commit roles

I1 is created only after every required Phase 1 gate passes. Its parent is
verification/deadline correction V, whose parent is platform correction C. The
preliminary deadline ceiling is 60,000 ms; the final deadline is derived from
new observations and may not exceed that ceiling. Other ceilings and safety
factors remain unchanged. Its receipts
name the already-existing parent and executed manifests, leaving future I1/B1
fields null.

After clean I1 exists, `tools/mo1305-bind.mjs` verifies its actual committed
bytes, copies its original inventory into binding evidence, and updates only
the inventory and binding evidence. The B1 validator checks actual ancestry,
subjects, permitted changed paths, prior inventory equality, committed source
and receipt bytes, predecessor tags and the absent MO-1305 tag. B1 does not
embed its own hash. Before B1, the prepared-binding gate checks the actual I1
HEAD and permits only the inventory and the two binding records to differ.
After B1, validation identifies B1 externally through HEAD and verifies its
committed binding bytes and ancestry.

Phase 2 and Phase 3 remain pending. Remote-mode release validation, Windows
release certification and final binding are future gates. Ubuntu/Linux, VM
and cross-platform parity remain NOT_REQUIRED. No push or tag is authorized.

## Interrupted preflight recovery and capture provenance

The 2026-09-24 local-date recovery found no surviving MO-1305 measurement
process. R2 remains INTERRUPTED with 69 complete cases and one partial cold
sample. Its exact source, archive, logs and raw data are retained under the local
recovery snapshot. R3 remains FAIL due to an added clock-comparison assertion;
its evidence and candidate are separately preserved. Neither contributes samples
to a successful campaign.

R4 ordinary samples use native capture tickets, strictly increasing raw sequence
numbers, process PID and Windows creation time, collector session and campaign
UUIDs, and exact source/archive identity. A pre-request ticket must be captured
and delivered before sending the request. A new post-response ticket must be
captured and delivered afterward. This proves freshness without equating
independently quantized UTC clocks. UTC capture/delivery and request interval
values remain available for diagnosis. The validator rejects stale tickets,
reused sequences, unrelated processes/runs and altered summaries; summaries are
recalculated from hash-bound raw data. Every process and collector must exit
successfully. A streaming journal preserves raw rows even if final collection
fails. Adverse repetitions bind each constituent process and operation report;
shutdown native cleanup remains the last available live-process sample, not an
invented postmortem zero.

The R4 freeze additionally records the actual Node, Python, PowerShell and npm
executable/script identities, private test certificate/key/token/config hashes,
original SDK oracle source and fixture inputs, and both contract authority files.
Private credential contents are not copied into repository evidence. The full
runner checks these inputs before and after both ordinary and adverse phases.
Only complete 105-case ordinary and 20-scenario smoke validation permits launch.

## Task budget

The current task targets completion within 60 minutes and must stop by 90.
The monotonic orchestration budget includes a conservative startup allowance.
No stage starts when its planned minimum exceeds the remaining budget. A
budget stop preserves partial evidence and requires a separate bounded task;
it cannot create a PASS receipt. Post-B1 verification checks conformance,
receipts, graph, workspace, whitespace and clean status once without rerunning
resources.

## R6 execution checkpoint

R6 stopped with HTTP 504 where 200 was expected at maximum-permitted-headers,
warm index 2. Its 11 completed vectors and 12 successful partial-vector samples
remain diagnostic evidence of a failed campaign. The workflow above has not
reached final derivation or final-candidate validation. See the separate R6
failed-attempt record and HTTP-timeout blocker document.

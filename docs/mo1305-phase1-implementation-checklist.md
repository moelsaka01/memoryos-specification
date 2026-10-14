# MO-1305 Phase 1 implementation checklist

Current continuation authority: [host interruption validity and selective resume](mo1305-host-interruption-validity.md). Its task budget is a 45-minute target and 60-minute hard maximum. R6 remains FAIL; 341 independently revalidated R6 observations and 109 fresh observations complete the 450-sample modular resource aggregate. Current final acceptance and binding state are recorded in [the conformance inventory](../repositories/cca-conformance/mo1305-conformance-inventory.json) and the new modular evidence under `evidence/mo1305-phase1-resume/`. The R6 checkpoint and earlier progress notes below are historical; their obsolete counts, task budgets and absence-of-commit statements do not override the current continuation authority.

Current authority: verification correction V `75cee55784c590bab52feaf8f2214e4d1b9e657f`.
The universal repetition and old parent requirements in the historical progress
notes below are superseded by the [bounded verification correction](mo1305-contract-freeze-1-verification-methodology-correction.md).
See the [current requirement/evidence review](mo1305-phase1-bounded-evidence-review.md).
Historical attempt descriptions are retained; they are not current campaign gates.

Authority: [Contract Freeze 1](mo1305-contract-freeze-1.md), platform correction
`c2e3835b852fd966046ac9e984538fdcaf8b26bf`, and the authorized resource review.
Branch remains main. I1 and B1 do not exist yet.

The original candidate, archive and failed measurement were preserved before
changes. The [historical report](mo1305-phase1-resume-report.md) remains a record
of that earlier stop. The [resource review](mo1305-phase1-resource-review.md)
explains why correctly configuring the worker fits the unchanged young-generation
ceiling without changing committed-memory accounting or the 1.5 multiplier.

## Current preflight

The complete installed preflight passed before the full campaign started:

| Surface | Evidence/result |
|---|---|
| Strict JSON, schemas, Base64, serialization and OpenAPI consistency | 27 package tests PASS, including memory/deadline guards and file-growth race |
| Semantic delegation and normative byte parity | All 73 independent SDK vectors PASS; 29 other integration checks and 40 cleanup requests |
| Native TLS 1.3, HTTP/1.1, raw framing and security policy | 174 actual TLS adversarial cases PASS |
| Node fetch and Windows curl | 24 cases PASS with real TLS and captured redacted request headers |
| Startup/configuration/environment/integrity | 51 baseline and 15 additional startup cases PASS |
| Cancellation, admission, deadlines, reaping and shutdown | 19 lifecycle cases and 15 worker faults PASS, including late publication |
| Worker authority restrictions | 27 denial probes in an isolated Worker PASS; no OS sandbox claim |
| Windows signals | Actual hidden-console Ctrl+C shutdown PASS; native POSIX SIGTERM delivery is not claimed |
| Offline installation | Actual npm ci, offline, scripts disabled, initially empty explicit cache, isolated outside checkout; every installed file matches |
| Toolchain provenance and notices | Signed Node release verified; exact node.exe and unmodified upstream LICENSE match |
| Supply chain | [Dated primary-source review](mo1305-phase1-supply-chain-review.md); no exhaustive zero-vulnerability claim |
| Stress harness preflight | All 20 short smoke scenarios PASS; these do not replace the full adverse campaign |
| Predecessors | 235 selected regression tests PASS; post-B1 rerun remains required |

The preflight artifact had SHA-256
`477bc587dca0b3c6b6849e20dccc42622121093d1bca84b76218c61cef496a43`.
Subsequent harness-only changes preserve relative evidence paths, explicitly
record parent memory deltas, and use the explicit Git executable in regressions.
Production source bytes did not change. A new archive was built and installed;
identities, maximum-MIP evaluation and maximum-error smoke samples passed.

## Preserved first full attempt and sampler correction

The first full attempt used archive SHA-256
`ef87a3e004a1171d035e28b56cb00e1cdd17fd60197c16d467b379f203c06f34`
and source tree
`389855821307e03aefaf9f614635468e83c56361023698c93d2fbd72718fca1e`.
It remains FAIL: 58 cases completed, followed by 17 completed cold samples and
one failed cold sample for `header-max-bytes`. The failure was
`MISSING_OS_SAMPLES`; HTTP expectations passed, but the collector announced
READY before delivering its first OS record. A late record is retained but is
not substituted into the failed sample. No adverse repetition ran.

The [attempt record](../repositories/cca-conformance/evidence/mo1305-phase1-measurement-attempt1.json)
binds its unchanged results, failed sample, log and preserved 285-file input
snapshot. None of its samples will be counted as a successful full campaign.

The corrected sampler requires a complete initial OS record and fresh native
captures before and after each request. Five synchronization regression tests
PASS. Candidate archive: 185,947 bytes, SHA-256
`6ffe6b27dce49be92e7e8c84529b2d6e6a117235cba6571ba2104705d212b27d`;
input tree
`d6fef9e83df15aea2fc999693c9b6b73860f6144dbd29f5d0d6e42a69ef12cb4`.
That R2 run was interrupted after 69 complete cases (138 samples) and one
additional cold sample. The [recovery record](../repositories/cca-conformance/evidence/mo1305-phase1-recovery.json)
binds the process discovery and preservation. No matching measurement process
remained when the task resumed. R3 preflight failed a newly added cross-process
wall-clock comparison before completing its first case; its exact input snapshot,
HTTP/native summary and failure log remain separate historical evidence.

R4 uses explicit capture tickets: the collector acknowledges a requested ticket
only after starting a new native capture. Readiness still requires an actual row.
PID, Windows process creation time, collector session, campaign ID, source/archive
identities, sequence numbers, raw hashes and successful exits are checked for
every ordinary sample. The validator recalculates native summaries from the raw
process records. UTC timestamps are retained, but separately quantized Python
and Node clocks are not assumed to order events at identical millisecond
boundaries; capture tickets and delivery-before-request establish causality.
The collector also journals rows as they arrive so a forced exit preserves them.

R4 archive: 185,949 bytes, SHA-256
`79b96b4067008bd0fef252c659333ef09341afa047b52164b92ce8e11150fd81`;
source tree
`47dc5279fef922e4af42d71ea5ca874d802b54bf87d0857e2322a475188c55d8`.
Gateway runtime and contract bytes remain unchanged. R4 complete-catalog and
adverse smoke preflight is PASS: 105/105 ordinary cases, 210 ordinary samples
from 210 distinct processes, all 20 adverse smoke scenarios, and complete raw
native/provenance validation. The R4 full campaign subsequently failed after 20 complete cases and 57 successful
records in the next case (2,657 successful records total). A wall-clock ordering
assertion failed at `evaluate-policySet-pass`, warm index 27. The exact failed
comparison cannot be recovered because its timestamp values were not serialized.
The [R4 blocker report](mo1305-phase1-r4-measurement-blocker.md) records preservation
and validation. No adverse repetition ran. The required complete campaign remains
105 cases with 30 cold and 100 warm samples, followed by all 20 adverse scenarios
three times for at least 60 seconds each. No final
budget or I1/B1 is authorized to proceed until those gates pass.

## Remaining release gates

- [ ] Complete all 13,650 ordinary samples and 60 adverse repetitions.
- [ ] Derive final limits from every observed maximum; preserve all ceilings,
  headroom and rounding rules.
- [ ] Prove only limits, their OpenAPI projection and generated provenance
  changed between measured and final packages.
- [ ] Run final installed confirmation, exact boundary matrix and two independent builds.
- [ ] Generate and validate canonical artifact-bound Phase 1 receipts and inventory.
- [ ] Pass workspace, scope, whitespace and conformance checks.
- [ ] Create I1 with the exact requested subject and platform-correction parent.
- [ ] Create B1 containing only inventory/binding evidence, parented by I1.
- [ ] Pass post-B1 package, conformance, graph, regression and workspace checks;
  leave a clean tree with no push or tag.

Phase 2, Phase 3, Windows release certification and final release binding remain
PENDING. Ubuntu/Linux, VM and cross-platform parity remain NOT_REQUIRED.

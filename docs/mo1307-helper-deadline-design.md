# MO-1307 whole-helper deadline contract correction design

**Decision: MORE_CHARACTERIZATION_REQUIRED.** The design is complete, but no numeric replacement bound is selected. **C1, changing only the finite per-helper whole-lifecycle ceiling, is conditionally preferred.** The existing 20000-ms aggregate, 30000-ms CLI admission, 10000-ms API/worker and 2000-ms cleanup limits remain coherent and should remain unchanged absent independent contrary evidence.

The minimal-observer campaign encountered a natural timeout after eight Case-C and two control executions. Product cleanup was unconfirmed, so the sealed stop rule ended the campaign with 15 planned samples unexecuted. Successful completion of the killed request remains unknown. A timeout's terminal/cleanup duration cannot become an upper successful-execution bound.

This task is design and bounded engineering characterization only. It does not change production, Freeze, constants, package metadata, versions, security guarantees or certification. It does not resume 3A-R, start 3D, push or tag. Phase 3A-R remains **BLOCKED**. Accepted 3B-R and 3C-R remain applicable to their exact C3RB bytes only.

## Existing normative facts and authority

The initial clean-main gate at **2026-09-29 17:35:52 UTC** matched characterization commit **6d444e323f8048712908eaff22712eeac8a4e6b3**, subject **docs(memoryos-1.3): characterize MO-1307 helper deadline**, sole parent C3RB **defe93989efc6501b1a730b82e79e705884b269b**. The workspace is C:/Users/melsa/Documents/Codex/cca-workspace. External r3a/r3b/r3c authorities were read only; their 37,396 files, 128 original input files and exact Git states/status were checked before and after.

The characterization report/evidence, Freeze 1, publication-inspection correction, finalization correction, READ_SET correction, Phase 2D integration, all required r3a blocker/localization/final-generation reports, and accepted 3B-R/3C-R reports/receipts were read and bound. Later corrections supersede only their expressly scoped text. See authority-binding.json and the pinned source references in each design analysis.

Model C authority is **RECHARACTERIZE_WHOLE_HELPER_BOUND**. Normative intent is **WHOLE_HELPER_LIFECYCLE**, explicitly covering process creation, PowerShell startup, helper initialization, request work, response transport, process settlement and required quiescence. Startup stays inside the clock; there is no proposed unbounded startup stage.

| Control | Current ms | Design disposition |
| --- | --- | --- |
| Helper | 5000 | Unchanged now; future H unselected |
| Aggregate helper-active | 20000 | Retain |
| CLI admission | 30000 | Retain |
| API | 10000 | Retain; API uses no native helper |
| Worker | 10000 | Retain |
| Cleanup | 2000 | Retain from original terminal failure |

For a later separately selected H, the effective helper deadline remains min(D, S+H, S+(20000-used)). Every helper shares the original CLI deadline D and cumulative helper-active budget; these limits are ceilings, not nine independently reserved H-sized slots. The private sequence clock begins earlier than the supervisor around framing, decoding and exit checks. A future successful envelope must account for that transfer rather than equating standalone helperUsedMs with a full CLI admission guarantee.

Historical 3A-R Step G remains post-tag-absent evaluate, request 3 READ_SET, 19 files, MO1307_TIMEOUT / ACQUISITION, exit 29, transport settlement **5063.5788 ms**, supervisor overrun **7.8233 ms**. Aggregate/CLI were not limiting; H–O were unexecuted. All prior failures and unconfirmed cleanup findings remain historical. The final-generation historical session/frame buffers were not retained; older diagnostic frames remain separately retained.

## Retained 25-observation characterization

The prior campaign remains exactly 25 observations, including its natural timeout. Case C's whole-settlement observations are **3369.0536, 3416.8165, 4442.3606, 5024.6567 TIMEOUT, 4845.0631 ms**. Its minimum successful margin is **154.9369 ms**, with another thin success at 557.6394 ms. No result is removed, relabeled or pooled into the new campaign.

Independent historical corroboration remains separate: corrected request-3 MO-1306 3129.6876 / 2945.6094 / 2783.4989 ms; localization 3659.7774 / 4322.5324; final certification primary MO-1306 2766.7818; final READY 1469.1991. Correction smoke wall time is not a substitute for missing per-helper charges.

Limitations remain five observations per case, right-censoring, fresh-process rather than cold-cache observations, uncontrolled ordinary host activity, possible observer perturbation, unobservable isolated bootstrap endpoint, and no population timeout probability or scheduler/Defender causation. A historical success or small median does not erase a failure.

## Method declared before new measurements

Bound-selection-method.json, design-plan.json and sample-plan.json were written before campaign execution. The plan timestamp is **2026-09-29T17:54:02.136Z**; campaign started **2026-09-29T17:55:52.807Z** and ended **2026-09-29T17:56:27.912Z**. All 89 production members were compared directly with C3RB Git blobs before launch, and runtime executable identities were checked against the retained pinned runtime.

The method critically rejects automatic adoption of the earlier U + max(1500,0.30×U) + uncertainty proposal. The observed maximum is not an established upper tolerance estimate U. Neither 1500 ms nor 30% has an independent measured safety basis; adding either to an observed or censored maximum would not establish sufficiency.

The conservative bounded selection rule is:

1. Establish a justified upper successful whole-lifecycle envelope **U**, including the earlier private-sequence transfer.
2. Independently justify ordinary-load/startup variability reserve **V** and measurement uncertainty **Q**, excluding effects already represented in U and avoiding double-counting.
3. Derive the raw requirement **R = U + V + Q** first.
4. Round upward deterministically: **H = 500 × ceil(R / 500)**, within the analysis domain 5000 < H <=20000 ms.
5. Accept a numeric proposal only after aggregate/CLI, input-bound, cleanup and DoS review supports that smallest scope. No value is selected first and rationalized afterward.

The domain's 20000-ms ceiling comes from the existing aggregate cap: a larger per-helper number would add no allowance to a fresh first call. It is not a proposed production limit or a declaration that 20000 ms is acceptable. **U, V, Q, R and proposed H remain NOT_ESTABLISHED.** No numeric correction can be authorized by this report.

The intended eventual claim is a finite engineering envelope for the certified native Windows environment under declared ordinary load, with fail-closed behavior outside it. It is not zero timeout probability, hard real time, a mathematical maximum or a worst-case scheduling guarantee.

For transparency, under continuous IID sampling only, a sample maximum has coverage-confidence relation 1−p^n. At p=0.95 and n=20 this is **64.1514%**, not 95%. A 95%/95% sample-maximum illustration needs at least **59 uncensored IID observations**. Even zero failures among 20 would have a one-sided 95% failure-probability upper bound about **13.9108%**. IID assumptions are not established here, and the actual run stopped at eight C observations with one failure; these calculations demonstrate a limitation, not achieved reliability.

## New minimal-observer measurements

The authorized sensitivity campaign was needed to assess whether the query-heavy observer plausibly shifted the envelope used for bound selection. It was not expected to guarantee a numeric result under the immutable censoring deadline.

The sealed maximum was 20 C plus five lightweight E observations, ordered ECCCC / CECCC / CCECC / CCCEC / CCCCE. The exact prior C/E request frames and original roots were reused. C is READ_SET, 65 files / 2,004,208 input bytes, request frame 7570 bytes; E is CHECK_OUTPUT with request frame 345 bytes. Successful response frames are 2,693,766 and 1905 bytes respectively. Request identity and exact successful response/input equality are retained.

The runner invokes the exact C3RB helper with the unchanged production PowerShell launch through the real production supervisor/transport. It uses pinned Node 24.21.0 win-x64 and PowerShell 5.1 executable identities. There is no helper copy, source instrumentation, clock scaling, deadline override, additional observer process, periodic process query, in-clock control-file write or live observer hashing/decoding. Parent event timestamps and chunk references are retained in memory; validation and raw serialization occur after settlement. CPU/memory context snapshots occur outside the helper clock. Native helper CPU, bootstrap readiness and attributable-console exit are NOT_OBSERVABLE in this minimal method.

Primary successful duration is the supervisor's own helperUsedMs through confirmed quiescence. Whole T0-to-transport settlement is retained separately for comparison with the prior campaign; it includes failure cleanup for a timeout. T0 is derived from the unchanged effective deadline minus 5000 and checked against the launch interval. Parent exit and pipe-close notifications are separate from attributable console proof.

| Sample | Result | Supervisor success active ms | Whole settlement ms | Supervisor terminal ms | Product cleanup confirmed |
| --- | --- | --- | --- | --- | --- |
| 01-E | SUCCESS | 1288.4044 | 1288.4605 | No terminal | true |
| 02-C | SUCCESS | 3760.0214 | 3760.1347 | No terminal | true |
| 03-C | SUCCESS | 3698.9053 | 3699.0466 | No terminal | true |
| 04-C | SUCCESS | 4176.5257 | 4176.5761 | No terminal | true |
| 05-C | SUCCESS | 3604.4082 | 3604.5311 | No terminal | true |
| 06-C | SUCCESS | 3221.3763 | 3221.4202 | No terminal | true |
| 07-E | SUCCESS | 1166.4922 | 1166.5549 | No terminal | true |
| 08-C | SUCCESS | 4015.4341 | 4015.4818 | No terminal | true |
| 09-C | SUCCESS | 4262.5466 | 4262.6647 | No terminal | true |
| 10-C | TIMEOUT | NOT_ESTABLISHED | 5031.6862 | 5007.5264 | false |

Actual executions: **10 = eight C + two E; nine successes and one timeout**. The remaining **12 C + three E =15** are NOT_EXECUTED. There were zero retries, replacement runs, discarded samples or adaptive expansion.

| Case | Successful active min / max / median | All settlement min / max / median | Timeouts |
| --- | --- | --- | --- |
| C | 3221.3763 / 4262.5466 / 3760.0214 | 3221.4202 / 5031.6862 / 3887.8083 | 1 |
| E | 1166.4922 / 1288.4044 / 1227.4483 | 1166.5549 / 1288.4605 / 1227.5077 | 0 |

The largest successful new C settlement was 4262.6647 ms, leaving 737.3353 ms; this does not account for the censored completion. Sample 10-C produced **zero response bytes**, reached supervisor terminal at **5007.5264 ms**, parent exit at **5030.8717 ms**, and whole settlement at **5031.6862 ms**. Exchange-call settlement was 5036.0367 ms. Its result remains MO1307_TIMEOUT / ACQUISITION, with **cleanupConfirmed:false**. Closed process/pipes do not establish the missing attributable-console proof. The predeclared conservative stop rule prohibited another helper; no external termination coverage or cleanup certification is claimed.

## Observer sensitivity and uncertainty

| Case | Prior successful active median | New successful active median | Difference ms | Prior / new timeouts |
| --- | --- | --- | --- | --- |
| C | 3929.5399 | 3760.0214 | -169.5185 | 1 / 1 |
| E | 1542.2981 | 1227.4483 | -314.8498 | 0 / 0 |

Prior C's successful-only median is 3929.5399 ms, distinct from its five-settlement median 4442.3606 ms that includes a timeout. The new successful C median is 3760.0214 ms, about 4.31% lower; E's median is about 20.41% lower, but only two new controls ran. These cohorts differ in time, host activity, order, count and censoring. Their successful-only distributions also have survivor selection. No paired/randomized test, causal effect, pooled percentile or guessed overhead subtraction is justified.

The new timeout shows that recurrence does not require the prior periodic query-heavy observer. It does not prove zero observer effect or identify scheduling/bootstrap/Defender causation. Unknown measurement and transfer uncertainty remains unknown; parent event differences do not bound every unobserved delay. The earlier observer's query wall time remains a limitation of its own separate cohort.

## Aggregate, CLI, API, worker and cleanup design

Actual retained nine-helper MO-1306 supervisor charges are:

| Run | Helper-active ms | Aggregate slack ms | Full observed lifecycle ms |
| --- | --- | --- | --- |
| localization-diagnostic-1 | 14644.9063 | 5355.0937 | 16200.7457 |
| localization-diagnostic-2 | 16073.7949 | 3926.2051 | 17614.7041 |
| final-generation-primary-mo1306 | 11815.2229 | 8184.7771 | 13145.2485 |

The bound records also preserve the final primary total **11815.2229 ms** and its full lifecycle **13145.2485 ms**. The localization lifecycles are 16200.7457 and 17614.7041 ms. Worker start-event-to-quiescent intervals are 1123.9882–1327.0646 ms; these are observations, not a new worker budget. Final READY's 10772.4147-ms helper aggregate is a separate workload. The correction MO-1306 nine-helper smoke exposed 11067.2351-ms CLI wall time but no exact helper-active total; it is not relabeled as such.

Retain **20000 ms**. The slowest observed other-eight helper total is 11752.5402 ms, leaving **8247.4598 ms** for a counterfactual replacement request 3 if those other durations were held fixed. This is arithmetic only, neither a proposed H nor a reservation; multiple slow helpers can exhaust the shared cap. Do not multiply H by nine.

Retain **30000 ms CLI admission**. Nine serial helpers surround one worker: acquisition requests 1–4, worker, then publication inspections 5–9. The aggregate20s and worker10s maxima add to30s and leave no separate overhead reservation, but maxima are clipped ceilings rather than simultaneous entitlements. The original CLI clock clips each helper/worker; this is internally coherent without promising success at all component maxima.

Preserve the finalization correction precisely: deadline/cancellation before rename admission prevents submission. Once the sole non-cancellable rename is timely submitted, actual settlement is awaited under the existing exception, followed by the shared bounded read-only confirmation/disposition. Therefore CLI30s is an admission limit, not a universal hard process-lifetime cap. A later helper numeric correction must not broaden that exception, restart disposition, repeat rename or alter late-commit truth/output handling.

API uses no native helper acquisition, so its **10000 ms** deadline is behaviorally unaffected. The worker retains **10000 ms**, clipped by CLI when applicable. Cleanup retains **2000 ms** from the original terminal event; a higher H can postpone the start of failure cleanup, but does not justify extending or resetting cleanup. Missing proof remains missing.

## Candidate and security comparison

| Alternative | Assessment | Reason |
| --- | --- | --- |
| C1: H only | Conditionally preferred | Smallest coherent change; cumulative and admission caps remain independent. |
| C2: H + aggregate | Not justified | No demonstrated independent aggregate insufficiency; enlarges cumulative native exposure. |
| C3: H + CLI | Not justified | No demonstrated admission inconsistency; enlarges prepublication occupancy. |
| C4: all related limits | Not justified | Broadens unrelated API/worker/cleanup controls without a dependency. |

For each candidate H, permitted non-clipped single-helper occupancy rises by H−5000; remaining aggregate/CLI can reduce that increase. Security-only examples in candidate-comparison.json evaluate H=6000/8000/10000/20000, giving increments1000/3000/5000/15000 ms. **None is a proposal or a sufficient bound.** Fail-closed terminal precedence, one fresh helper per slot, no overlap/retry/reset and original cleanup remain mandatory. No hard real-time process termination guarantee is inferred.

Caller-influenced work remains bounded: manifest/helper paths128; raw file2,097,152 bytes; envelope262,144; aggregate evidence8,388,608; relative path180 ASCII characters; full path240 UTF-16 units; inspection identity chain120; request frame65,536 bytes; response frame16,777,216; JSON depth16 and values131,072. Candidate524,288, manifest262,144, authority1,048,576 and configuration16,384-byte limits remain. Every exact source is bound in security-dos-analysis.json.

Untrusted content and caller-chosen bounded files/path depth/layout can consume work before semantic rejection. A larger H must not bypass count/cap+1 reads, framing/base64/JSON limits, regular-file/reparse/hardlink/volume/final-path checks or held/fresh identity checks. Private immutable roots remain an operator precondition. Worker heap limits128/16MiB remain; the512MiB RSS acceptance figure is an engineering observation, not a hard whole-process sandbox. API concurrency remains the embedding host's responsibility.

Persistent helpers, services, pools, PowerShell reuse/7 migration, native sidecars and additional product roles remain deferred. The proposed next engineering observation transport would not become product architecture.

## Exact conditional contract and implementation delta

No normative document is edited here. A future selected H would require explicit scoped correction authority:

| Authority | Exact affected location | Required conditional delta |
| --- | --- | --- |
| Freeze1 | §3 lines122–124; §18 line1202 and1228–1238 | Review version/correction authority; replace only helper5000 and S+5000 with H/S+H; preserve whole lifecycle and independent20000. Historical4×5000 derivation does not require4×H. |
| Publication-inspection correction | Deadlines/topology lines129–135; limit table148 | Targeted numerical supersession only; preserve nine/four topology and all inspection guarantees. |
| Finalization correction | Compatibility120–121; settlement57/61 | Cross-reference numeric supersession only; preserve30000 admission and existing non-cancellable settlement/disposition. |
| READ_SET correction | Limit table134 and historical scope251 | Keep C3R/C3RB records and5000 measurements historical. |
| Phase2D integration | Limit table196 | Keep B2 evidence historical; link new candidate-specific authority only. |

The authoritative generated production field is **contracts/definitions.json /limits/helperDeadlineMs**. Its authored initializer is **tools/mo1307-phase1/generate-contracts.mjs:96**. Change that single initializer only after authority; regenerate definitions, then constants via generate-runtime-data.mjs, then contract manifest/SPDX/distribution with the existing package generator. Both runtime.mjs and helper-protocol.mjs consume the shared definitions; no second live literal or ambient override is proposed.

A minimal numeric-only correction would change five shipped members: contracts/definitions.json, src/constants.mjs, contracts/contract.json, sbom.spdx.json and distribution-manifest.json. The other84, including helper PS and52schemas, should remain exact under that narrow assumption. Definitions/constants hashes, contract rows, SPDX checksums/verificationCode/documentNamespace, distribution rows, archive integrity and provenance bindings would change. Version/correction decisions must be reviewed explicitly under Freeze§3; no version is silently chosen here. No generator or package build was run in this task.

## Tests and recertification impact

Update exact H−1/H/H+1 tests, retaining strict equality rejection, late frame/exit failure, original clock origins and no rescue by late success. Direct affected tests are phase2c_correction C2C01/C2C17 and phase2c_runtime R07/R09. R09's old14010 expectation must become min(30000,9010+H,9010+20000−10), retaining its worker10010 and charged10 expectations.

Keep existing4999×4 aggregate controls; add remaining-aggregate<H and remaining-CLI<H cases. Retain C2C18/C2C19, R01–R16 overlap/cleanup/terminal precedence controls, native runtime supplements and finalization/publication-wait gates. The phase1 native runner reads the generated limit but its spawnSync timeout does not itself prove real supervisor enforcement. Do not blindly replace unrelated5000-byte fixtures or independent quick-refusal/confirmation test tolerances. New harnesses must bind their candidate and preserve all old executed tools/receipts.

After any actual correction, **3A-R requires a fresh separately authorized generation of its existing gate set**, including the formerly failing Step G and previously unexecuted H–O, installed CLI/API/evaluate/verify, semantic vectors, deadline/late-success/resource/process-console cleanup and publication controls. Current blocked generations remain historical.

Accepted **3B-R 5cb213eeab8a6deec39a8f8f93ea13a70e053231** would be **TARGETED_REFRESH_REQUIRED** for the new package:53-member contract closure, SPDX/distribution, two assemblies, archive integrity, offline install/import/smoke, exact89-member/source/provenance binding. Unchanged notices/dependencies/schemas may be reused only after exact dependency comparison.

Accepted **3C-R f4ed5873969ab6b627941dc20d5823c5e853b9fe** would be **TARGETED_REFRESH_REQUIRED** because the resource boundary changes: timeout/late-success, DoS, aggregate/admission minima, actual process/console cleanup, no extra roles/retries, finalization/release claims and new package binding. Unchanged semantic proofs may be reused only with explicit dependency analysis. Existing pending3D disclosures, provider/live limitations and security dispositions remain unchanged. None of these certifications is rerun here.

## Unresolved evidence and exact next task

The selected design outcome is **MORE_CHARACTERIZATION_REQUIRED**, not MODEL_C_NOT_COHERENT. C1 has a coherent finite security shape; the missing successful-completion envelope and justified margin prevent a numeric proposal. The observed timeout is not converted to6000, the largest success is not padded arbitrarily, and a new number is not selected simply to make current tests pass.

**Exact next task: obtain separate authority for MO-1307 BOUNDED UNCENSORED WHOLE-HELPER COMPLETION CHARACTERIZATION.** A concrete finite proposal is one sealed campaign of at most60 C plus10 controls, exact unchanged helper/requests, and a separately identified **20000-ms engineering observation guard** anchored before spawn plus the existing2000-ms cleanup allowance. The guard is justified as the C1 aggregate analysis ceiling; it is not a production helper limit or permission granted here. Product constants/supervisor semantics stay unchanged, and engineering completion beyond5000 must never be reported as a product deadline PASS or certification.

Before that future execution, fix sampling conditions, inference claim, counts, interleaving, source identities, U/V/Q criteria and observer costs. A conditional95/95 sample-maximum argument requires defensible IID assumptions and at least59 uncensored C observations; otherwise use a narrower engineering-envelope claim and independently justify variability reserve. Capture exact full frame/input equality and positively identified helper/attributable-console termination without heavyweight polling. Account for private-sequence transfer. Stop on outer-guard censoring, unconfirmed cleanup, protocol/integrity defects or budget exhaustion; no replacement runs, automatic expansion or automatic later campaign. If U/V/Q remain unresolved, that campaign also ends without a selected bound. Any later numeric proposal still requires separate contract/production correction and subsequent certification authority.

## Evidence and closure

The evidence directory is [helper-deadline-design](../repositories/cca-conformance/evidence/mo1307/helper-deadline-design/). It contains baseline/characterization binding and integrity receipts; authority binding/preservation; predeclared design/method/sample plan; exact raw request/response/sample receipts and campaign; statistics and observer sensitivity; candidate/aggregate/CLI/security analyses; contract/implementation/test/recertification plans; and the decision.

Closure verifies all89 shipped members against C3RB and all prior characterization/Freeze authorities unchanged, independently checks request/response identities, timing arithmetic and the exact stopped prefix, validates workspace/package/source syntax, and checks both staged and unstaged whitespace. The inventory/staged-blob gate permits only new design evidence/tools/report and narrow .gitattributes byte-preservation rules. Exactly one documentation/evidence commit is authorized, subject **docs(memoryos-1.3): design MO-1307 helper deadline correction**, sole parent **6d444e323f8048712908eaff22712eeac8a4e6b3**. No future commit hash is embedded. Postcommit checks write only ignored cache receipts and establish exact committed bytes and clean main.

No Linux/Ubuntu/WSL, VM or provider-account action occurred. No push/tag or production/Freeze/version/package-metadata change occurred. Time budget is45-minute target,60-minute normal ceiling and75-minute hard stop from17:35:52 UTC; final actual duration and commit identity are reported outside this commit after verification.

MO-1307 WHOLE-HELPER DEADLINE DESIGN COMPLETE
MORE CHARACTERIZATION REQUIRED

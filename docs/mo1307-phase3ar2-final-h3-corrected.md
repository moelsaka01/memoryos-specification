# MO-1307 Phase 3AR2 native Windows installed-runtime certification

**PHASE3AR2_CONCRETE_BLOCKER.**

Candidate: C3VB `17fa84efe46d30e6f4be85fd2427485677a222a3`; production commit C3V `98b766f9218b209f52251147213839b9775f6da3`; production tree `b9dabf54572e06c96bb5e48c4e20671f2cc24053`.
Authorities: preserved helper `PROSPECTIVE_HELPER_BOUND@2.0.0`; aggregate `PROSPECTIVE_HELPER_AGGREGATE_BOUND@2.0.0`. Worktree: `C:\Users\melsa\Documents\Codex\3ar2\`; branch: `codex/mo1307-phase3ar2-c3ub`.

## H harness correction

Exact H failure cause: the preserved generation artificially withheld helper stdin EOF for 8200 ms, leaving only 774.3405 ms after stdin settlement before the immutable 9000-ms product deadline; the real lifecycle reached 9036.9764 ms and correctly returned MO1307_TIMEOUT.
Classification: `H_HARNESS_MARGIN_DEFECT` (not a product-deadline defect and not an expectation/authority conflict).
Exact harness correction: only timely-helper changed from `{eofDelayMs:8200,minMs:8000,maxMs:9000}` to `{eofDelayMs:0,maxMs:5000}`. The <5000-ms value is an engineering envelope with 4000 ms of deadline headroom; the product authority remains strict success `<9000` and timeout `>=9000`.
Zero-execution harness validation: PASS; product/helper/worker/native-observer/certification runs 0/0/0/0/0. The exact 8000 PASS, 8999 PASS, 9000 TIMEOUT controls and all timeout/late/cancel/cleanup/no-overlap/no-retry controls were structurally preserved.
Preserved failed generation: A-B-C-D-E-F-G PASS, H FAIL, I-J-K-L-M-N-O NOT_RUN; resumed false, rewritten false, promoted false.

## H2 harness correction

Exact H2 failure cause: in the preserved H-corrected generation, aggregate-helper-exhaustion expected MO1307_TIMEOUT but returned MO1307_FILESYSTEM_BOUNDARY at 23579.1962 ms (five helpers, one worker, 23257.1216 ms charged). The harness had placed the absent-output CHECK_OUTPUT target beneath the live runtime-H evidence directory; harness evidence writes changed that parent directory byteLength from 16384 (slot 4) to 24576 (slot 5) with the same file ID, and the product correctly rejected the changed stable-identity chain.
Classifications: `H_AGGREGATE_FIXTURE_INPUT_ISOLATION_DEFECT` (harness; not product, not authority) and, for the independent PID 2124 `LIFETIME_CONTRADICTION`, `H_OBSERVER_EVENT_ORDERING_DEFECT` (the observer advanced lastSeenAt from a snapshot row after the held process object had already recorded its exit time).
Exact harness corrections: the absent-output parent and the READ_SET input root are pre-created, sealed, quiescent fixture roots outside every evidence, cache and report write path; the aggregate control uses a 5700-ms engineering EOF delay, at most five helpers, and no publication-state mutation, so the unchanged 28000-ms product aggregate deadline terminates the fifth (CHECK_OUTPUT) helper; the observer advances lastSeenAt only while the exact held object reports exitTime100ns == 0 (`MO1307_OBSERVER_EVENT_ORDERING@1.0.0`). Product code, identity policy, expectations and limits are unchanged.
Zero-product H2 validation: PASS; product/helper/worker/native-observer/certification runs 0/0/0/0/0 (sha256:c1bf0a503ef2c455123ad619f966482fbbe87c5c56273b10316872cec8adbcd6).
Preserved H-corrected generation: A-G PASS, H FAIL, I-O NOT_RUN; resumed false, rewritten false, promoted false.

## Topology-observer correction

Exact defect: the historical B observer re-queried already-authenticated helper PID 2540 (parent PID 2140) after signal activity; QueryFullProcessImageNameW returned Win32 error 31 and was incorrectly counted as a fresh unknown identity.
Correction: policy `MO1307_TOPOLOGY_IDENTITY_POLICY@1.0.0` preserves a same-session prior positive PID/role/parent/image/lifetime binding only when every no-reuse, timing, object-identity, and contradiction check passes. Initial unknown identity, parent/image contradiction, PID replacement, and unrelated errors remain fail-closed.
Synthetic observer validation: PASS; A-G 7/7, accepted exactly B/F, failed closed exactly A/C/D/E/G, product/helper/native-observer runs 0/0/0.
Preserved historical failed B: FAIL, exactly 1 semantic invocation (sha256:6236c0976bb13bc6a8705962b2729f1dbb581917f2556c85dc372ff0d42d34b5).
Corrected pre-certification B: PASS, READY, exit 0, 9/9 helpers, helper-active 15054.459499999999 ms, CLI lifecycle 15527.7212 ms, cleanup confirmed, publication COMMITTED, topology maxima 3 product roles / 1 helper / 1 console, RSS 211570688 bytes, unresolved identities 0. Exactly one invocation; no retry (sha256:73b9da2caa1786039d60035c783745ee3a56814f63e64bb047e19275402f0983).

Fresh offline package: `sha256:8796c7a5aac727868b7b122229d2c1c490da32f2f55670c7ed8f8ff02182bbca`, 113247 bytes. Exactly 89 installed members and zero external production dependencies verified byte-for-byte against C3VB before execution; post-run integrity PASS.
Runtime: Node 24.21.0 win-x64, SHA-256 ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32; native Windows PowerShell 5.1.26100.9444.
Mandatory inventory completed: 0/80 cases.

| Step | Result |
|---|---|
| A | FAIL |
| B | NOT_RUN |
| C | NOT_RUN |
| D | NOT_RUN |
| E | NOT_RUN |
| F | NOT_RUN |
| G | NOT_RUN |
| H | NOT_RUN |
| I | NOT_RUN |
| J | NOT_RUN |
| K | NOT_RUN |
| L | NOT_RUN |
| M | NOT_RUN |
| N | NOT_RUN |
| O | NOT_RUN |

Concrete blocker: {"step":"A","name":"mo1306-qualified","result":"FAIL","failure":{"name":"AssertionError","code":"ERR_ASSERTION","stage":null,"message":"{\"code\":\"MO1307_TIMEOUT\",\"kind\":\"MemoryOSReadinessError\",\"reference\":null,\"stage\":\"ACQUISITION\",\"version\":\"1.0.0\"}\n\n\n29 !== 2\n","stack":"AssertionError [ERR_ASSERTION]: {\"code\":\"MO1307_TIMEOUT\",\"kind\":\"MemoryOSReadinessError\",\"reference\":null,\"stage\":\"ACQUISITION\",\"version\":\"1.0.0\"}\n\n\n29 !== 2\n\n    at invoke (file:///C:/Users/melsa/Documents/Codex/3ar2/repositories/cca-conformance/tools/mo1307-phase3ar2-final-h3-corrected/core.mjs:23:9)\n    at file:///C:/Users/melsa/Documents/Codex/3ar2/repositories/cca-conformance/tools/mo1307-phase3ar2-final-h3-corrected/core.mjs:43:2\n    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)\n    at async node:internal/modules/esm/loader:647:26\n    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)"},"integrityError":null,"rows":[{"step":"A","name":"mo1306-qualified","operation":"evaluate","elapsedMs":23412.8641,"exit":29,"signal":null,"error":null,"stdout":{"path":"repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h3-corrected/semantics/A-mo1306-qualified/evaluate/stdout.data","byteLength":0,"sha256":"sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},"stderr":{"path":"repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h3-corrected/semantics/A-mo1306-qualified/evaluate/stderr.data","byteLength":115,"sha256":"sha256:b2a2279f168dfef0effe10ad966bda3871750a96ff46dcef570eb48ccf55dcb1"},"result":"FAIL","failure":{"name":"AssertionError","code":"ERR_ASSERTION","stage":null,"message":"{\"code\":\"MO1307_TIMEOUT\",\"kind\":\"MemoryOSReadinessError\",\"reference\":null,\"stage\":\"ACQUISITION\",\"version\":\"1.0.0\"}\n\n\n29 !== 2\n","stack":"AssertionError [ERR_ASSERTION]: {\"code\":\"MO1307_TIMEOUT\",\"kind\":\"MemoryOSReadinessError\",\"reference\":null,\"stage\":\"ACQUISITION\",\"version\":\"1.0.0\"}\n\n\n29 !== 2\n\n    at invoke (file:///C:/Users/melsa/Documents/Codex/3ar2/repositories/cca-conformance/tools/mo1307-phase3ar2-final-h3-corrected/core.mjs:23:9)\n    at file:///C:/Users/melsa/Documents/Codex/3ar2/repositories/cca-conformance/tools/mo1307-phase3ar2-final-h3-corrected/core.mjs:43:2\n    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)\n    at async node:internal/modules/esm/loader:647:26\n    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)"}}],"destination":"C:\\Users\\melsa\\Documents\\Codex\\3ar2\\.cache\\phase3ar2-final-h3-corrected\\v0\\p\\primary","installedUnchanged":true,"finishedAt":"2026-10-04T12:15:50.440Z","binding":{"path":"repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h3-corrected/steps/A.json","byteLength":3017,"sha256":"sha256:7ad50adccc975cd0c9339e51cfa27d25be93134769539b34377861c921c75762"},"scheduler":{"step":"A","exit":1,"error":null,"signal":null,"elapsedMs":26663.053499999998,"stdout":{"path":"repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h3-corrected/scheduler/A.stdout.data","byteLength":1052,"sha256":"sha256:9f6aab34b4e76acadd2ab95473471305c09f27c5d9969f7d3bf1aadc4c87dcce"},"stderr":{"path":"repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h3-corrected/scheduler/A.stderr.data","byteLength":0,"sha256":"sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},"result":"FAIL","binding":{"path":"repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h3-corrected/scheduler/A-receipt.json","byteLength":606,"sha256":"sha256:decb41eacb125f8a2f004c9b2f48e0b8bc91da06b9e4888af707803569253c45"}}}. Exact expected/actual case, errors, clocks, process state, integrity and cleanup state are retained in the receipt.
Phase 3A status: CONCRETE BLOCKER / INCOMPLETE; final A-O result PHASE3AR2_CONCRETE_BLOCKER.
Completed steps: none. Unexecuted steps: B, C, D, E, F, G, H, I, J, K, L, M, N, O. Remaining mandatory cases: 80.

Limits: whole-helper lifecycle success <9000 ms; timeout >=9000 ms; helper-active aggregate success <28000 ms and timeout >=28000 ms; CLI/rename admission ceiling 30000 ms; API/worker 10000 ms; cleanup 2000 ms. Historical H remains NOT_ESTABLISHED. No retry, grace, late-success recovery, helper/helper overlap, or helper/worker overlap.

Historical evidence: 5500 tracked baseline files checked, 0 changed; none promoted. The complete failed-B, topology-correction, corrected-B, failed full-generation, zero-product H-correction, failed H-corrected generation, and zero-product H2-correction tool/evidence trees and the sealed H2 fixture roots are sealed and rechecked through closure. No diagnostic campaign, production change, push, tag, Phase 3BR2 rerun, Phase 3CR2 rerun, or Phase 3D execution.
Repository status: tracked production diff clean; source snapshot unchanged; installed snapshot unchanged; local untracked harness/evidence/report artifacts are retained for the final evidence commit.
Preserved accepted Phase 3BR2 commit: `4d92f0f21c9c3aad8202f4558d61b9229c7214fc`; full rerun false; exact C3TB -> C3VB final binding delta NOT_CREATED_ON_BLOCKER.
Preserved accepted Phase 3CR2 commit: `7d2006c6e19bb50bffb6c710672be996e3c3590b`; full/unrelated-security rerun false; exact changed-dependency final delta NOT_CREATED_ON_BLOCKER.
CLI/API parity and cleanup claims are limited to retained completed observations. Byte determinism stage N: NOT_RUN.

Receipt: [certification-receipt.json](../repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h3-corrected/certification-receipt.json). Evidence commit is not self-embedded and is reported externally after these immutable receipt bytes exist.
Sealed inventory: [recovered-inventory.json](../repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h3-corrected/recovered-inventory.json).
Resource/cleanup: [resource-and-cleanup-observations.json](../repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h3-corrected/resource-and-cleanup-observations.json).

No Phase 3D handoff exists for this concrete-blocker Phase 3AR2 stream.

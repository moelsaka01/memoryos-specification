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

## Topology-observer correction

Exact defect: the historical B observer re-queried already-authenticated helper PID 2540 (parent PID 2140) after signal activity; QueryFullProcessImageNameW returned Win32 error 31 and was incorrectly counted as a fresh unknown identity.
Correction: policy `MO1307_TOPOLOGY_IDENTITY_POLICY@1.0.0` preserves a same-session prior positive PID/role/parent/image/lifetime binding only when every no-reuse, timing, object-identity, and contradiction check passes. Initial unknown identity, parent/image contradiction, PID replacement, and unrelated errors remain fail-closed.
Synthetic observer validation: PASS; A-G 7/7, accepted exactly B/F, failed closed exactly A/C/D/E/G, product/helper/native-observer runs 0/0/0.
Preserved historical failed B: FAIL, exactly 1 semantic invocation (sha256:6236c0976bb13bc6a8705962b2729f1dbb581917f2556c85dc372ff0d42d34b5).
Corrected pre-certification B: PASS, READY, exit 0, 9/9 helpers, helper-active 15054.459499999999 ms, CLI lifecycle 15527.7212 ms, cleanup confirmed, publication COMMITTED, topology maxima 3 product roles / 1 helper / 1 console, RSS 211570688 bytes, unresolved identities 0. Exactly one invocation; no retry (sha256:73b9da2caa1786039d60035c783745ee3a56814f63e64bb047e19275402f0983).

Fresh offline package: `sha256:8796c7a5aac727868b7b122229d2c1c490da32f2f55670c7ed8f8ff02182bbca`, 113247 bytes. Exactly 89 installed members and zero external production dependencies verified byte-for-byte against C3VB before execution; post-run integrity PASS.
Runtime: Node 24.21.0 win-x64, SHA-256 ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32; native Windows PowerShell 5.1.26100.9444.
Mandatory inventory completed: 25/80 cases.

| Step | Result |
|---|---|
| A | PASS |
| B | PASS |
| C | PASS |
| D | PASS |
| E | PASS |
| F | PASS |
| G | PASS |
| H | FAIL |
| I | NOT_RUN |
| J | NOT_RUN |
| K | NOT_RUN |
| L | NOT_RUN |
| M | NOT_RUN |
| N | NOT_RUN |
| O | NOT_RUN |

Concrete blocker: {"step":"H","result":"FAIL","failure":{"name":"AssertionError","code":"ERR_ASSERTION","message":"Expected values to be strictly equal:\n\n1 !== 0\n","stack":"AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:\n\n1 !== 0\n\n    at file:///C:/Users/melsa/Documents/Codex/3ar2/repositories/cca-conformance/tools/mo1307-phase3ar2-final-h-corrected/stage.mjs:17:80\n    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)\n    at async node:internal/modules/esm/loader:647:26\n    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)"},"exit":1,"signal":null,"error":null,"elapsedMs":48764.909,"receipt":{"path":"repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h-corrected/runtime-H/external-proof.json","byteLength":192039,"sha256":"sha256:97f73fd66095f14b412a6d59a9d6aaec528bab37bb55dd52417e78a62628c91d"},"stdout":{"path":"repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h-corrected/steps/H.stdout.data","byteLength":72,"sha256":"sha256:d17ee08b7c5c983aa85ae8fd2aa846d87856b80e6e129fdb5849a23d3108d635"},"stderr":{"path":"repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h-corrected/steps/H.stderr.data","byteLength":0,"sha256":"sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},"finishedAt":"2026-10-02T14:41:43.234Z","noRetry":true,"binding":{"path":"repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h-corrected/steps/H.json","byteLength":1491,"sha256":"sha256:0b2ee97592c66c77f36294093b0a8c00ea27a96a53b773e0523ec844a3723cdf"},"scheduler":{"step":"H","exit":1,"error":null,"signal":null,"elapsedMs":50759.081400000025,"stdout":{"path":"repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h-corrected/scheduler/H.stdout.data","byteLength":621,"sha256":"sha256:faa190589f43221bea715f41f2a98a1810f4373ee60aa04490891cc2aede7867"},"stderr":{"path":"repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h-corrected/scheduler/H.stderr.data","byteLength":0,"sha256":"sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},"result":"FAIL","binding":{"path":"repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h-corrected/scheduler/H-receipt.json","byteLength":603,"sha256":"sha256:da77a055af38bf9ae49795b9ab0da676b03077ae8d66edb5da9f9c5c03be2ed3"}}}. Exact expected/actual case, errors, clocks, process state, integrity and cleanup state are retained in the receipt.
Phase 3A status: CONCRETE BLOCKER / INCOMPLETE; final A-O result PHASE3AR2_CONCRETE_BLOCKER.
Completed steps: A, B, C, D, E, F, G. Unexecuted steps: I, J, K, L, M, N, O. Remaining mandatory cases: 55.

Limits: whole-helper lifecycle success <9000 ms; timeout >=9000 ms; helper-active aggregate success <28000 ms and timeout >=28000 ms; CLI/rename admission ceiling 30000 ms; API/worker 10000 ms; cleanup 2000 ms. Historical H remains NOT_ESTABLISHED. No retry, grace, late-success recovery, helper/helper overlap, or helper/worker overlap.

Historical evidence: 5500 tracked baseline files checked, 0 changed; none promoted. The complete failed-B, topology-correction, corrected-B, failed full-generation, and zero-product H-correction tool/evidence trees are sealed and rechecked through closure. No diagnostic campaign, production change, push, tag, Phase 3BR2 rerun, Phase 3CR2 rerun, or Phase 3D execution.
Repository status: tracked production diff clean; source snapshot unchanged; installed snapshot unchanged; local untracked harness/evidence/report artifacts are retained for the final evidence commit.
Preserved accepted Phase 3BR2 commit: `4d92f0f21c9c3aad8202f4558d61b9229c7214fc`; full rerun false; exact C3TB -> C3VB final binding delta NOT_CREATED_ON_BLOCKER.
Preserved accepted Phase 3CR2 commit: `7d2006c6e19bb50bffb6c710672be996e3c3590b`; full/unrelated-security rerun false; exact changed-dependency final delta NOT_CREATED_ON_BLOCKER.
CLI/API parity and cleanup claims are limited to retained completed observations. Byte determinism stage N: NOT_RUN.

Receipt: [certification-receipt.json](../repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h-corrected/certification-receipt.json). Evidence commit is not self-embedded and is reported externally after these immutable receipt bytes exist.
Sealed inventory: [recovered-inventory.json](../repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h-corrected/recovered-inventory.json).
Resource/cleanup: [resource-and-cleanup-observations.json](../repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h-corrected/resource-and-cleanup-observations.json).

No Phase 3D handoff exists for this concrete-blocker Phase 3AR2 stream.

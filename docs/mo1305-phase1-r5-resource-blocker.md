# MO-1305 Phase 1 R5 resource blocker

**MO-1305 RESOURCE CORRECTION REQUIRES AUTHORIZATION**

R5 stopped after a valid retained semantic duration required at least 37,200 ms under the frozen deadline methodology, above its 30,000 ms ceiling. No limits or runtime behavior were changed, no slow sample was excluded, and no I1/B1 was created.

The 66 completed cases contain 8,580 fully validated samples; a further 84 records belong to an incomplete case. Counts and maxima below describe the stopped attempt, not a completed campaign. The original progress file still says RUNNING because deliberate process termination prevented finalization; it is preserved unchanged. The separate FAIL record resolves the attempt state.

1. **Baseline:** Workspace `C:\Users\melsa\Documents\Codex\cca-workspace`; branch `main`; HEAD `c2e3835b852fd966046ac9e984538fdcaf8b26bf`; subject `docs(memoryos-1.3): correct MO-1305 platform policy`; parent `ce1780e2dac0afe31aeb947f0a7f78b953e17f6b`. I1/B1 absent; predecessor tags unchanged.
2. **R1 preservation:** FAIL, unchanged and revalidated. 58 complete cases, 7,557 recorded successful samples including 17 partial cold samples; original missing-native-sample failure retained.
3. **R4 preservation:** FAIL, unchanged and revalidated. 20 complete cases, 2,657 recorded successful samples, plus the failed warm attempt. Original candidate/source/input/raw/log/recovery evidence retained.
4. **R4 failure assertion:** `baselineReceivedUtcMs <= requestStartedUtcMs && requestStartedUtcMs <= responseCompletedUtcMs && responseCompletedUtcMs <= cleanupCutoffUtcMs`. Exact HTTP/status/body checks had passed. Actual comparison operands were not serialized; the particular failed inequality remains undetermined.
5. **R4 wall-clock adjustment:** Windows Kernel-General event 1 recorded a -1,243 ms adjustment at `2026-09-24T08:27:07.3698288Z`. This supports a clock-related explanation without recovering the missing operands.
6. **Clock-source audit:** PASS: 247 clock-bearing source lines classified A-E, zero unclassified uses. Auxiliary progress/launch/review helpers separately classified; recovery/report UTC is descriptive A only.
7. **Wall-clock uses:** UTC labels, campaign/audit metadata, OS clock events and descriptive wall-minus-monotonic observations. Process creation timestamps are identity equality fields. Existing certificate calendar validation is unchanged.
8. **Monotonic-clock uses:** Node `process.hrtime.bigint()` and Python `time.perf_counter_ns()`; same-process duration/order/freshness/deadlines. Python subprocess timeout implementation uses `time.monotonic`.
9. **Cross-process synchronization model:** Explicit capture tickets, persisted sequence acknowledgements, and process/candidate/archive/campaign/run identities. Independent monotonic epochs are never ordered against one another.
10. **Collector contract:** Ready identity plus fresh pre-operation ticket/sequence persisted before acknowledgement; strictly newer post-operation ticket/sequence and persisted native sample; cleanup/exit evidence. Fixed sleeps and READY alone do not prove capture.
11. **Timeout clock model:** Monotonic readiness, freshness, request, startup, cleanup, shutdown and orchestration deadlines; relative OS/runtime waits remain monotonic.
12. **Duration clock model:** Original runtime semantic metric retained. Exact start/end nanoseconds and domain are recorded; rounded microseconds must equal the original metric. Request round trip is separately measured.
13. **Failure-schema correction:** Protocol/schema 2.0.0 records assertion, relationship, actual named operands, units, clock domain, ticket, sequence, PID, candidate/run/campaign/case/phase/index and HTTP outcome. The R5 ceiling failure includes complete operands.
14. **Clock regression tests:** PASS: 28 deterministic tests, including UTC backward/forward steps, collector protocol faults, exits, monotonic timeouts, incompatible domains and real monotonic reversal.
15. **R4-condition reproduction test:** PASS: injected -1,243 ms wall step with 2,000 microseconds valid monotonic duration and valid capture causality. No Windows clock modification.
16. **Gateway runtime byte comparison:** PASS: all 47 gateway runtime/contract files match R4; rechecked after stop. No resource metric, runtime semantic, ceiling, headroom or worker configuration change.
17. **Harness changed files:** 25 tooling files plus 3 supporting files. Exact paths, byte lengths and SHA-256 values are listed below and in [harness-correction-gate-identity.json](C:/Users/melsa/Documents/Codex/cca-workspace/.cache/mo1305-resource-review/r5-clock-correction/harness-correction-gate-identity.json). These describe changes relative to the preserved correction baseline, not just tracked Git differences.
18. **Harness identity:** SHA-256 `4c10eea55b93f6c092df7859c0666a4cdb105ffa964776965bc381beaa4e53dc`; source-tree SHA-256 `ac1f30504a38a65761a158618762d52cf76d9c12afffa81d7eeafd66f4136530`; 289 source files. Protocol/schema hashes are in the identity appendix.
19. **R5 preflight result:** PASS: all seven stages, including fresh build/install, 28 clock tests, ordinary/adverse smoke and both native-validation layers.
20. **R5 preflight cases:** 105/105; 105 cold + 105 warm = 210 samples from 210 distinct server processes. Candidate/process/tickets/sequences/persistence/timing/HTTP/semantic/cleanup validated.
21. **R5 adverse smoke result:** PASS: 20/20 scenarios, one repetition each, at least 3 seconds. Smoke is not the full adverse campaign.
22. **R5 frozen input identity:** Full campaign `d847e5fd-9087-4c14-8f0e-cb1d07d5667f`. 390 repository inputs and 8 external inputs verified before execution and after stop; unchanged archive, source and installed files. Repository input SHA-256 `9aee0aca3f134ca1ea0e415d2c600013d6be2f99917a0c3ac14d55a309d1c50d`; external input SHA-256 `a7bdd5d08e51e9c49c838b342ca3a50667df5f9023f9692e510937e479da0c8c`. The unfinished run has no four-check completion receipt.
23. **R5 ordinary cases:** 66/105 complete; `max-output-without-regression` partial with 84 records. Fresh R5 counts; no R1/R4 counts reused and no outlier excluded.
24. **R5 cold count:** 2,010/3,150 recorded: 1,980 in complete cases and 30 in the partial case.
25. **R5 warm count:** 6,654/10,500 recorded: 6,600 in complete cases and 54 in the partial case.
26. **R5 ordinary total:** 8,664/13,650 recorded; 8,580 fully validated completed-case samples. The remaining 84 have validated request/capture evidence but belong to an incomplete case.
27. **R5 adverse scenarios:** 0/20 full scenarios executed. Blocked by ordinary resource-gate failure.
28. **R5 adverse repetitions:** 0/60 full repetitions executed; frozen requirement remains 3 x at least 60 seconds for each of 20 scenarios.
29. **Resource validator:** Retained-data validation PASS; overall resource gate FAIL. Complete cases: 8,580 samples/2,046 processes. Partial case: 30 cold process exits validated and 54 warm captures validated from the original persisted JSONL. Final warm collector JSON and process-exit metadata are missing after deliberate stop; no completion metadata was invented.
30. **Max young committed:** Observed in partial R5: 22,032,384 bytes. Worker configuration remains 24 MiB, frozen young-generation ceiling 128 MiB and memory headroom 1.5x.
31. **Max old generation:** Observed in partial R5: 78,401,536 bytes (partial case, warm 34). Not a final campaign maximum.
32. **Max external:** Observed worker external peak: 17,205,528 bytes. Not a final campaign maximum.
33. **Max parent attributable:** Observed parent absolute heap peak 29,663,232 bytes; external peak 10,906,064 bytes; aggregate process RSS peak 279,613,440 bytes. Frozen absolute-peak methodology retained.
34. **Max semantic monotonic duration:** 9,281,479 microseconds at `max-mip-policySet`, warm index 11. Start `155078630461100` ns; end `155087911939400` ns; process domain `MONOTONIC_PROCESS:16260:503e4550-192f-4502-800b-afa6fe0cea50`. Exact HTTP/semantic/capture checks passed.
35. **Final memory budgets:** NOT_DERIVED. Existing memory limits remain PRELIMINARY and unchanged.
36. **Final semantic deadline:** NOT_DERIVED. Frozen rule `ceil100ms(max(1000ms, 4 * maximumOperationMs))` gives a lower bound of 37,200 ms from the retained witness, exceeding the 30,000 ms absolute ceiling. This lower bound is failure proof, not an applied new deadline.
37. **Final request limits:** NOT_DERIVED. Existing preliminary request bounds and all fixed bounds remain unchanged.
38. **Final response limits:** NOT_DERIVED. Existing preliminary response bounds remain unchanged.
39. **Final limits identity:** No final identity. Unchanged PRELIMINARY limits: 1,530 bytes, SHA-256 `ea2a84c4d4375f242cc9d6de54a923e2fab39ed97659c0d6a47298fe525aa917`.
40. **Boundary results:** NOT_EXECUTED against final limits; resource success prerequisite failed. Historical preliminary checks are not final acceptance.
41. **Package tests:** Final Phase 1 package suite NOT_EXECUTED after R5; 28 new harness regressions and all preflight stages passed.
42. **Real HTTP/TLS:** Installed-candidate HTTP/TLS exercised by fresh R5 preflight and retained ordinary samples. Final dedicated acceptance gate NOT_EXECUTED.
43. **Node fetch:** Final dedicated Node-fetch gate NOT_EXECUTED. Earlier client results remain historical, not final R5 certification.
44. **curl:** Final dedicated curl gate NOT_EXECUTED. Earlier client results remain historical.
45. **raw TLS:** Final full raw-TLS acceptance gate NOT_EXECUTED. Earlier raw-TLS results remain historical.
46. **Semantic parity:** Exact oracle/status/body checks passed for fresh preflight and retained R5 request records. Complete final parity/acceptance gate NOT_EXECUTED.
47. **PASS:** Semantic PASS fixtures are covered by ordinary preflight; final whole-phase acceptance remains blocked.
48. **FAIL:** Semantic FAIL fixtures are covered by ordinary preflight; this outcome is distinct from R5 resource campaign FAIL.
49. **COULD_NOT_EVALUATE:** Semantic COULD_NOT_EVALUATE fixtures are covered by ordinary preflight; final whole-phase acceptance remains blocked.
50. **Adversarial result:** Fresh 20-scenario adverse smoke PASS. Full adverse campaign and final adversarial acceptance NOT_EXECUTED.
51. **Offline install:** R5 preflight PASS: npm ci --offline --ignore-scripts --no-audit --no-fund, initially empty cache, npm 11.19.0/Node 24.21.0, all 58 installed files match. No final package with derived limits exists.
52. **OpenAPI:** Frozen OpenAPI unchanged: 114,438 bytes, SHA-256 `cb84b400ceb9aef8c6883c67b8a17687cd62d530a83e436e908ef95a33321aca`. Final derived-limit consistency gate NOT_EXECUTED.
53. **SBOM/notices:** Existing frozen candidate SBOM/notices retained; final package completeness/licensing gate NOT_EXECUTED.
54. **Supply-chain review:** Primary upstream advisory recheck completed 2026-09-24 UTC, with no new disposition relative to the existing dated review. This is not an exhaustive CVE census or final package certification. Sources and scope are linked below.
55. **Predecessor regressions:** Final R5 prerequisite regression suite NOT_EXECUTED. Earlier 235 tests in six groups remain historical; predecessor tag objects and targets rechecked unchanged.
56. **Workspace verification:** PASS: `tools/verify_workspace.py --root C:\Users\melsa\Documents\Codex\cca-workspace`.
57. **git diff --check:** PASS.
58. **I1 hash:** ABSENT; no implementation commit created.
59. **I1 parent:** Not applicable; authorized baseline remains `c2e3835b852fd966046ac9e984538fdcaf8b26bf`.
60. **B1 hash:** ABSENT; no binding commit created.
61. **B1 parent:** Not applicable; I1 does not exist.
62. **Post-B1 result:** NOT_EXECUTED; B1 does not exist.
63. **Final Git status:** Expected dirty working tree: 4 tracked modifications, 493 untracked files; index empty. HEAD remains `c2e3835b852fd966046ac9e984538fdcaf8b26bf` on `main`. No reset/clean/staging/commit performed.
64. **No push confirmation:** No push performed.
65. **No tag confirmation:** `memoryos-1.3-mo1305` absent; no tag created.
66. **Ubuntu/Linux state:** NOT_REQUIRED.
67. **VM state:** NOT_REQUIRED. No additional VM required or used; host HypervisorPresent=true is recorded without claiming its absence.
68. **Cross-platform parity state:** NOT_REQUIRED.
69. **Phase 2 state:** PENDING; not ready because Phase 1 is blocked.
70. **Phase 3 state:** PENDING; Windows certification and final binding remain pending.
71. **Exact next task:** `MEMORYOS 1.3 MO-1305 REST GATEWAY PHASE 2 IMPLEMENTATION` — the requested subsequent task title; not authorized to start while Phase 1 is blocked.

## Evidence and preservation

- [R5 failed-attempt record](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/evidence/mo1305-phase1-measurement-attempt-r5.json)
- [Complete failure operands](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/evidence/mo1305-phase1-resource-r5/resource-gate-failure.json)
- [Retained sample validation](C:/Users/melsa/Documents/Codex/cca-workspace/.cache/mo1305-resource-review/recovery-r5-resource-gate/retained-validation.json)
- [Preservation result](C:/Users/melsa/Documents/Codex/cca-workspace/.cache/mo1305-resource-review/recovery-r5-resource-gate/preservation.json)
- [Preserved input manifest](C:/Users/melsa/Documents/Codex/cca-workspace/.cache/mo1305-resource-review/recovery-r5-resource-gate/preserved-input-manifest.json)
- [Preserved output manifest](C:/Users/melsa/Documents/Codex/cca-workspace/.cache/mo1305-resource-review/recovery-r5-resource-gate/preserved-output-manifest.json)
- [Post-stop input verification](C:/Users/melsa/Documents/Codex/cca-workspace/.cache/mo1305-resource-review/recovery-r5-resource-gate/post-stop-input-check.json)
- [Final workspace/Git checks](C:/Users/melsa/Documents/Codex/cca-workspace/.cache/mo1305-resource-review/recovery-r5-resource-gate/final-checks.json)

Preserved 401 input files and 4845 output files (311,685,689 bytes). Input manifest SHA-256 `69b1361a6cb2f211166697e9ae3f222c72f12bbb8313676e114baed453967459`; output manifest SHA-256 `2470785487a4e007c64f8a5b419f7bcd64c56278e322101bda01d27809e1a36b`. The archive remains a local build artifact; its identity is retained in repository evidence.

## Exact harness changes

| Path | Bytes | SHA-256 |
|---|---:|---|
| [repositories/cca-conformance/tools/mo1305-clock-audit.py](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1305-clock-audit.py) | 4007 | `1557fb7d4c26e1de7ce7669fc6f948a2954ba56132cae331f7421eb4c5fbae66` |
| [repositories/cca-conformance/tools/mo1305-evidence.mjs](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1305-evidence.mjs) | 52041 | `151c7d35561a9058105b894b1f2c4d53fa59d8557895cecf9984fabdb2cebb25` |
| [repositories/cca-conformance/tools/mo1305-finalize.py](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1305-finalize.py) | 7595 | `8bea4f4a2bf85a4f2a5957a42f59c3cb394fd556887db523c67f729f97bb3d15` |
| [repositories/cca-conformance/tools/mo1305-monitor-tests.mjs](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1305-monitor-tests.mjs) | 8536 | `2de5b12dc65f86eda1a309308e3c7ae4be86113a1e644c43f1672cbed9719237` |
| [repositories/cca-conformance/tools/mo1305-phase1/adverse.mjs](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1305-phase1/adverse.mjs) | 12350 | `883ac0f591c50bb8792f1de2750fcc48f63ced4087b7c2d807985409dbcaeb46` |
| [repositories/cca-conformance/tools/mo1305-phase1/campaign.mjs](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1305-phase1/campaign.mjs) | 9583 | `5dd9281cf51c7099ea11f3e433d77d7be3558ad884788f4589b1e28d6904d232` |
| [repositories/cca-conformance/tools/mo1305-phase1/clock-fixture.json](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1305-phase1/clock-fixture.json) | 79 | `a79d2095807e7ec29d15659f13f092498ac81d1ef8b98632dce07d2943a379bc` |
| [repositories/cca-conformance/tools/mo1305-phase1/clock.mjs](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1305-phase1/clock.mjs) | 4623 | `48e11d195ede348d000735335cdf70763f9feaff9914023e052f16b21336aa18` |
| [repositories/cca-conformance/tools/mo1305-phase1/failure-schema-2.0.0.json](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1305-phase1/failure-schema-2.0.0.json) | 1986 | `73dd70ab8fe51918c237e57d0303fc1ee15c0f9c7e68809a9b38021a2ee75aec` |
| [repositories/cca-conformance/tools/mo1305-phase1/faults.mjs](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1305-phase1/faults.mjs) | 1838 | `186d3ae7cb4f3b0beba3e62bacb5cf1776a4c4d0419c16d7033ec4410300df3f` |
| [repositories/cca-conformance/tools/mo1305-phase1/full_run.py](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1305-phase1/full_run.py) | 7131 | `d9e5dbe77bbbab1f9b7af15ce8740868a5df4630adac3d69a66ccd886c3f13d9` |
| [repositories/cca-conformance/tools/mo1305-phase1/handoff_probe.mjs](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1305-phase1/handoff_probe.mjs) | 2899 | `f4eeddf533a58b7baec7bc41ff5a25b134e39a68fc0b8cbd795b1e1386ab110d` |
| [repositories/cca-conformance/tools/mo1305-phase1/installed.mjs](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1305-phase1/installed.mjs) | 8329 | `2ce287d5af046f3e78043e53e8c1654fd43433c7046026a0a8fce6e2e7d4e6f7` |
| [repositories/cca-conformance/tools/mo1305-phase1/lifecycle.mjs](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1305-phase1/lifecycle.mjs) | 6782 | `b55dc34fcc92f11b6ac34500cad44f556ad3694f275a052c465d4ed303a2909e` |
| [repositories/cca-conformance/tools/mo1305-phase1/measure-server.mjs](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1305-phase1/measure-server.mjs) | 2560 | `8c2e66ae650471f42239245a8bee54f228fb00569bec67712777b0d3f70d76ca` |
| [repositories/cca-conformance/tools/mo1305-phase1/measurement-protocol-2.0.0.json](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1305-phase1/measurement-protocol-2.0.0.json) | 1994 | `0963548c7faf05bdc18dcfbf545382a6f8bb02d8a74df662a39939f36a5f5bd4` |
| [repositories/cca-conformance/tools/mo1305-phase1/monitor.mjs](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1305-phase1/monitor.mjs) | 7148 | `4ff321dd4a5b76d190b3f500bfd1d37cdfab669e127ee8aafda4e65ba518a5d3` |
| [repositories/cca-conformance/tools/mo1305-phase1/os_monitor.py](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1305-phase1/os_monitor.py) | 4217 | `4313dcf6a77fa2389deab4961d8ac417f70ff6dddd5fb4702bdac18c45694278` |
| [repositories/cca-conformance/tools/mo1305-phase1/preflight_r5.py](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1305-phase1/preflight_r5.py) | 3012 | `e483fffc5884387ebb17ec51f20395f493f44d3b6792824d63027e5fdc336c2a` |
| [repositories/cca-conformance/tools/mo1305-phase1/sample-proof.mjs](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1305-phase1/sample-proof.mjs) | 10512 | `67abd38e4fa73310a8dbbaa60e1c31a2f9a85c990daee7bb171a8a11d773862c` |
| [repositories/cca-conformance/tools/mo1305-phase1/signals.py](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1305-phase1/signals.py) | 2513 | `ab739504449e91c78eeddca36bea2ba33d82dc080df0c0c9b7fd60be250c22f3` |
| [repositories/cca-conformance/tools/mo1305-phase1/startup.mjs](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1305-phase1/startup.mjs) | 5951 | `1cf257239a3b8e808089996ab4ee2f6f8601fda46bcc5fe36d0fdf20c2e5b656` |
| [repositories/cca-conformance/tools/mo1305-phase1/validate-campaign.mjs](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1305-phase1/validate-campaign.mjs) | 3130 | `2d6c25b77871ab6873365c854dbd050a1a2c86d41f2c056fdb4bd2fbb243fed3` |
| [repositories/cca-conformance/tools/mo1305-receipts.py](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1305-receipts.py) | 14193 | `a222fb7d5203fd4104ecfc955bc8094498e2464b0aa405f40c85fd6f9dbce8d2` |
| [repositories/cca-conformance/tools/mo1305-report.py](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1305-report.py) | 15023 | `0e83748d6c6273666329dc923cacdec1a9af50a1b7c9ebb6a973a8008e6ebed1` |
| [repositories/cca-conformance/CMakeLists.txt](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/CMakeLists.txt) | 16958 | `53c1b8204a26350603e1dfeba29b87f98ca60a19a4d103b74484baf7c7feae85` |
| [repositories/cca-conformance/tests/mo1305_phase1_conformance_test.mjs](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tests/mo1305_phase1_conformance_test.mjs) | 5757 | `6e61c7894f672a09c696da70b79949a695c6e1b22e6a22aca1b4a980bbbf2c5b` |
| [docs/mo1305-phase1-clock-model.md](C:/Users/melsa/Documents/Codex/cca-workspace/docs/mo1305-phase1-clock-model.md) | 5944 | `559157616d945ad0524196cdebc84845f81d948ba709948412a387c1a3ef8de7` |

## Candidate and protocol identities

- R5 archive: 185948 bytes; SHA-256 `cb443ac6311080cc0ec10b49022b4b9b13ae9593875a0dda91078ae21a89c424`.
- Measurement protocol: 1994 bytes; SHA-256 `0963548c7faf05bdc18dcfbf545382a6f8bb02d8a74df662a39939f36a5f5bd4`.
- Failure schema: 1986 bytes; SHA-256 `73dd70ab8fe51918c237e57d0303fc1ee15c0f9c7e68809a9b38021a2ee75aec`.
- Clock audit: 123856 bytes; SHA-256 `74351edaf49022913bc1bc336a1ffe3f3cf5ab3692185e9e98622a8b19b2644e`.
- R4-condition reproduction: 2249 bytes; SHA-256 `d9514dbd64639d902af6633f560ca4eebcc69fd4ca73e23b7fb3c4593f99fd9b`.

## Supply-chain recheck scope

Pinned Node 24.21.0, OpenSSL 3.5.8, Undici 7.29.1, llhttp 9.4.3 and npm 11.19.0; recheck of the existing dated review, not an exhaustive component-CVE census.

- Release 2026-09-08 confirms OpenSSL 3.5.8 and Undici 7.29.1. [Primary source](https://nodejs.org/en/blog/release/v24.21.0).
- Latest listed security-release announcement remains July 29, 2026. [Primary source](https://nodejs.org/en/blog/vulnerability).
- Latest listed 3.5 advisories are August 25, 2026, fixed in 3.5.8. [Primary source](https://openssl-library.org/news/vulnerabilities-3.5/).
- Latest listed advisories remain September 4, 2026; the existing review identifies patched 7.29.1 and inapplicable 8.x-only range. [Primary source](https://github.com/nodejs/undici/security/advisories).
- Latest listed npm CLI advisory remains GHSA-hj9c-8jmm-8c52, June 1, 2022; no newer entry visible. [Primary source](https://github.com/npm/cli/security/advisories).
- Latest listed parser release remains 9.4.3, fixing empty Transfer-Encoding. [Primary source](https://github.com/nodejs/llhttp/releases).

No follow-on campaign, limit correction, I1, B1, push, tag or Phase 2 work was started after the failure.

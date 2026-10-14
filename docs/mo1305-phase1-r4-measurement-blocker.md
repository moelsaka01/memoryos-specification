# MO-1305 Phase 1 R4 measurement blocker

Recorded after the 2026-09-24 resume. This report supersedes the older running/ready status, while preserving all original evidence.

1. **Baseline** — Workspace `C:\Users\melsa\Documents\Codex\cca-workspace`; branch `main`; HEAD `c2e3835b852fd966046ac9e984538fdcaf8b26bf`; subject `docs(memoryos-1.3): correct MO-1305 platform policy`. Parent and predecessor tags verified unchanged.

2. **Initial dirty-tree scope** — At this resume: four modified tracked registration/attribute files and 412 untracked Phase 1 files. All untracked paths recorded; 401 first-party inputs copied and hash-recorded before changes.

3. **Interrupted-process discovery** — Read-only Win32_Process inspection recorded PID, parent PID, executable, command line and creation time. No matching full_run.py, campaign, installed gateway or collector process remained. Working directory was not exposed by this interface.

4. **Whether previous corrected run was still active** — NO. R4 had exited with campaign status FAIL and process exit code 1 at 2026-09-24T08:27:56Z.

5. **Recovery action** — Preserved R4 as FAIL. Copied 1,335 output files (32,659,659 bytes) and 401 source/input files under [recovery snapshot](C:/Users/melsa/Documents/Codex/cca-workspace/.cache/mo1305-resource-review/recovery-r4-failure-20260924). No duplicate campaign, process termination or runtime/harness modification.

6. **Original failed campaign preservation** — PASS on revalidation: original R1 remains FAIL, with 58 complete cases, 7,540 records, 17 additional successful cold records and the failed cold record. All 285 preserved input files reproduce its source digest.

7. **Original failed campaign identity** — R1 archive 185,948 bytes; SHA-256 `ef87a3e004a1171d035e28b56cb00e1cdd17fd60197c16d467b379f203c06f34`; source `389855821307e03aefaf9f614635468e83c56361023698c93d2fbd72718fca1e`.

8. **Sampler defect** — R1 lacked a usable pre-request native sample. R4 failed a separate wall-clock ordering assertion in evaluate-policySet-pass, warm index 27. Windows recorded a -1,243 ms time correction shortly beforehand. Exact compared values were omitted from the failure record, so the specific failed inequality is undetermined.

9. **Sampler correction** — Existing R4 capture tickets, sequence numbers and process/candidate/run bindings remain preserved. No further correction was applied after this full-campaign failure. The remaining wall-clock assertion and incomplete failure-context capture require investigation before a new campaign.

10. **Synchronization regression tests** — Five existing tests PASS on this resume. They cover delayed readiness, stale capture, timeout, collector exit and malformed/wrong-process data; they did not prevent this wall-clock failure.

11. **Corrected candidate identity** — R4 source `47dc5279fef922e4af42d71ea5ca874d802b54bf87d0857e2322a475188c55d8`; archive 185,949 bytes; SHA-256 `79b96b4067008bd0fef252c659333ef09341afa047b52164b92ce8e11150fd81`. Full closure, Node, contracts, schemas, OpenAPI, limits, harness and provenance identities: [candidate identity](C:/Users/melsa/Documents/Codex/cca-workspace/.cache/mo1305-resource-review/r4-candidate-identity.json).

12. **Whether gateway runtime bytes changed during sampler correction** — NO. Recompared all 47 bin/src/runtime/contract files with the preserved original failed candidate; every byte matches.

13. **Resource blocker review** — Diagnostic review revalidated PASS and remains DIAGNOSTIC_RESOLUTION. Original 139,472,896 bytes derived 200 MiB above 128 MiB. Configuration diagnostics are preserved separately; this incomplete campaign establishes no final ceiling conclusion.

14. **Worker configured young-generation value** — 24 MiB; unchanged.

15. **Frozen young-generation ceiling** — 128 MiB; unchanged.

16. **Headroom rule** — 3/2 (1.5x), upward MiB rounding; unchanged.

17. **Whether resource freeze changed** — NO. No resource-correction commit.

18. **Corrected preflight result** — R4 preflight PASS. Retained ordinary native/provenance evidence revalidated this resume. Existing preflight validation also records all 20 adverse smoke scenarios PASS.

19. **Corrected preflight case count** — 105/105; 210 ordinary smoke records from 210 distinct server processes. Excluded from final campaign counts.

20. **Frozen final-campaign input identity** — 71,845 bytes; SHA-256 `5382256767b39d5dbb18a2cfa639f122d20eb00f98197eee2c9869e0851081c6`; 379 repository files verified unchanged. External manifest 1,599 bytes; SHA-256 `0b50e0ed40084ac7e9c88fe18ff2dc78fb153ee832a56284d116ae77c0ff3f52`; all eight identities match. This post-failure check is not the unproduced full-campaign four-check PASS receipt.

21. **Ordinary campaign case count** — 20/105 complete; case 21 has 57 successful records followed by one failed warm record.

22. **Cold sample total** — 630 successful / 3,150 required: 600 in completed cases plus 30 in the partial case.

23. **Warm sample total** — 2,027 successful / 10,500 required: 2,000 in completed cases plus 27 in the partial case; warm index 27 failed.

24. **Ordinary sample total** — 2,657 successful / 13,650 required, plus one failed attempt. The campaign remains FAIL; none establishes final certification.

25. **Adverse campaign result** — NOT STARTED: ordinary campaign failed first.

26. **Adverse repetitions/durations** — 0/60 completed. Required: 20 scenarios, three repetitions each, at least 60 seconds per repetition.

27. **Resource validator result** — Final gate BLOCKED. All 2,600 records from 20 complete cases validate fully, including 620 distinct server processes and raw native summaries. The partial 57 records pass shape/window checks; warm-process exit metadata was not persisted. No partial-to-PASS conversion.

28. **Maximum young-generation committed value** — Incomplete-run diagnostic only: 8,388,608 bytes among successful records. Final maximum unavailable.

29. **Maximum old-generation value** — Incomplete-run diagnostic only: 16,818,176 bytes. Final maximum unavailable.

30. **Maximum external value** — Incomplete-run diagnostic only: 7,662,875 bytes. Final maximum unavailable.

31. **Maximum parent attributable memory** — Incomplete-run recorded metric peaks only: parent heap 29,663,232 bytes; parent external 8,681,367 bytes; process RSS 115,961,856 bytes. These are not certified all-campaign maxima.

32. **Maximum semantic duration** — Incomplete-run diagnostic only: 4,832,579 microseconds. Final maximum unavailable.

33. **Final memory budgets** — NOT DERIVED; preliminary values preserved.

34. **Final semantic deadline** — NOT DERIVED.

35. **Final request limits** — NOT DERIVED.

36. **Final response limits** — NOT DERIVED.

37. **Final limits identity** — No FINAL artifact. Preserved PRELIMINARY limits: 1,530 bytes; SHA-256 `ea2a84c4d4375f242cc9d6de54a923e2fab39ed97659c0d6a47298fe525aa917`.

38. **N-1/N/N+1 result** — Final-limit boundary gate NOT RUN; final limits are unavailable.

39. **Phase 1 implementation completion** — INCOMPLETE: measurement gate failed; final validation and binding gates remain pending.

40. **Real HTTP/TLS result** — Earlier installed preflight PASS. R4 failed request reached the timestamp assertion after exact HTTP status/body checks. No final installed-budget certification.

41. **Node fetch result** — Prior preflight: 12 cases PASS. Final confirmation pending.

42. **curl result** — Prior preflight: 12 cases PASS. Final confirmation pending.

43. **Raw TLS result** — Prior preflight: 174 cases PASS. Final confirmation pending.

44. **Semantic parity** — Prior preflight: 73 independent SDK vectors PASS. R4 full campaign incomplete.

45. **PASS vector** — evaluate-policy-pass completed 30 cold/100 warm. evaluate-policySet-pass is the failed measurement case; exact response checks preceded the timestamp failure.

46. **FAIL vector** — evaluate-policy-fail and evaluate-policySet-fail each completed 30 cold/100 warm with expected semantic FAIL results.

47. **COULD_NOT_EVALUATE vector** — Both policy and policy-set CNE cases completed 30 cold/100 warm.

48. **Adversarial result** — Earlier adversarial preflight retained. Required full adverse resource campaign not started; final certification pending.

49. **Offline install** — Prior genuine offline, scripts-disabled, empty-cache isolated installation retained. Final post-derivation installation gate not reached.

50. **OpenAPI identity** — Current candidate only: 114,438 bytes; SHA-256 `cb84b400ceb9aef8c6883c67b8a17687cd62d530a83e436e908ef95a33321aca`. Final-budget projection not produced.

51. **SBOM/notices** — Existing SPDX SBOM and exact upstream notice preserved; final package receipt not created.

52. **Supply-chain findings** — Existing dated primary-source review and signed Node provenance preserved. No new review in this resume; no exhaustive zero-vulnerability claim.

53. **Conformance inventory** — Final Phase 1 inventory not created.

54. **Phase 1 receipts** — No successful final receipts created. New failure record: [R4 failed attempt](C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/evidence/mo1305-phase1-measurement-attempt-r4.json). Historical failed/interrupted evidence unchanged.

55. **Package test result** — Prior 27 package unit tests PASS; five sampler tests rerun PASS. Final installed suite not run.

56. **Predecessor regressions** — Prior 235 regression tests retained. Not rerun at the blocked final gate; predecessor tag objects and targets verified unchanged.

57. **Workspace verification** — tools/verify_workspace.py --root . PASS on this resume.

58. **git diff --check** — PASS on this resume; repeated after the failure report was recorded.

59. **I1 diff summary** — NOT CREATED; no staging.

60. **I1 hash** — ABSENT.

61. **I1 parent** — Not applicable; required parent remains c2e3835b852fd966046ac9e984538fdcaf8b26bf.

62. **B1 diff summary** — NOT CREATED.

63. **B1 hash** — ABSENT.

64. **B1 parent** — Not applicable; I1 does not exist.

65. **Post-B1 graph-aware result** — NOT RUN; no B1.

66. **Final Git status** — Dirty main retained: four modified tracked registration/attribute files plus existing and newly preserved untracked Phase 1 evidence/documentation. HEAD unchanged; nothing staged.

67. **Confirmation no push** — No push performed.

68. **Confirmation no tag** — No tag created; memoryos-1.3-mo1305 absent.

69. **Ubuntu/Linux state** — NOT_REQUIRED; not used.

70. **VM state** — NOT_REQUIRED; no VM campaign run.

71. **Cross-platform parity state** — NOT_REQUIRED; not run.

72. **Phase 2 state** — PENDING.

73. **Phase 3 state** — PENDING; Windows release certification and final binding also pending.

74. **Exact next task** — MEMORYOS 1.3 MO-1305 REST GATEWAY PHASE 2 IMPLEMENTATION. Not ready: Phase 1 measurement blocker must first be resolved.

MO-1305 PHASE 1 MEASUREMENT BLOCKED

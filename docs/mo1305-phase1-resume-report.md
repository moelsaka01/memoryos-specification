> Historical report of the preserved early candidate and its failed diagnostic.
> The authorized resource review and current campaign are tracked in
> [the resource review](mo1305-phase1-resource-review.md) and
> [the current checklist](mo1305-phase1-implementation-checklist.md).

# MO-1305 platform correction and Phase 1 resume report

**Platform correction committed; Phase 1 stopped at the frozen measurement gate.**

The valid maximum-MIP evaluation required a derived **200 MiB** young-generation
budget against a **128 MiB** ceiling. Freeze §8 requires a phase block and reviewed
correction when headroom exceeds a ceiling; the resume request §§9/47 prohibits
B1 if a release-critical measured value cannot be established within the ceiling.
No I1/B1 was created and no release limit was claimed final. The candidate and
all uncommitted work remain available for review. This finding applies to the
current candidate; it is not proof that every possible implementation is infeasible.

The measurement candidate archive is a local build artifact (not Git-tracked):
`.cache/mo1305-resume/build/memoryos-rest-0.1.0.tgz`, 179,548 bytes, SHA-256
`6e3c55fa19c898b0c7b4c0f47694c4bf2196401724e0743a67eaeacfc3036a22`.
Executed source-tree digest:
`948c1db2e5ec0179cdd5b7af435588f17829642829181d20226c818c31dbbd6e`.
Every recorded source input was rechecked unchanged after the probe. The gateway
shut down with exit code 0. No 30/100 campaign or future-phase PASS was fabricated.

1. **Baseline** — Exact workspace `C:\Users\melsa\Documents\Codex\cca-workspace`; branch `main`; initial HEAD `ce1780e2dac0afe31aeb947f0a7f78b953e17f6b`, subject `docs(memoryos-1.3): freeze MO-1305 REST Gateway contract`, parent `d15b578dd757e928273d4548348b085e58ed5df5`. All four predecessor tag objects and peeled commits matched; MO-1304 remains `ce7b001d911239fa50d904f5f336bb1bd7858ba3`.

2. **Initial dirty-tree audit** — Only 37 package files plus the checklist were untracked; nothing staged; no unrelated changes. All classified as valid partial Phase 1 work, with completeness unclaimed.

3. **Partial work preservation** — All 38 files were hash-recorded and verified byte-identical after the correction commit, still untracked. Resumption added modules and fixed audited defects; nothing was discarded.

4. **Previous platform policy** — Windows 11 x64 plus Ubuntu 24.04 LTS x64; two-platform measurements/certification and equality.

5. **Corrected platform policy** — Existing physical Windows 11 x64 host only for development, measurements, all phases and release certification. Actual edition/release/build evidence remains mandatory.

6. **Correction rationale** — Explicit owner direction excludes installing or maintaining another OS or VM. Existing MO-1304 historical evidence remains untouched.

7. **Actual Windows edition** — Microsoft Windows 11 Home, detected through CIM.

8. **Actual Windows release** — 25H2, detected from the CurrentVersion registry; not a universal support floor.

9. **Actual Windows build** — 26200.9457, detected CurrentBuild plus UBR; CIM OS version 10.0.26200.

10. **Windows architecture** — x64; CIM 64-bit OS and x64-based Dell Inspiron 5406 2n1.

11. **Node version** — 24.21.0 exactly, isolated Windows executable.

12. **Node SHA-256** — `ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32`.

13. **npm version** — 11.19.0 exactly, invoked with the pinned Node.

14. **Ubuntu/Linux state** — NOT_REQUIRED for MO-1305 v1. Historical predecessor records unchanged; no connection attempted.

15. **VM state** — NOT_REQUIRED. No VM/WSL download, creation, installation or access attempted.

16. **Cross-platform parity state** — NOT_REQUIRED. SDK semantic parity remains REQUIRED.

17. **Correction files** — Seven files: ROADMAP.md; freeze, authority and focused correction docs; support-policy.json, support_contract.py and support_contract_test.py under conformance/tools/mo1305-platforms. No production or checklist progress entered C.

18. **Correction tests** — 49 negative witnesses PASS; actual Windows identity, exact pins, semantic/HTTP/security/resource gates retained. Workspace verification and staged diff checks PASS.

19. **Correction commit hash** — `c2e3835b852fd966046ac9e984538fdcaf8b26bf`, exact requested subject.

20. **Correction parent** — `ce1780e2dac0afe31aeb947f0a7f78b953e17f6b`.

21. **Package path/name/version** — `repositories/memoryos-rest`; memoryos-rest 0.1.0; bin/memoryos-rest.mjs. Uncommitted prototype.

22. **Production dependency count** — 0 external production and 0 declared development npm dependencies.

23. **Runtime closure** — 25 authoritative files verified against original source; runtime manifest 5,566 bytes; SHA-256 `6cbe6bd5b164eb032e00645da06fb90f3e57d15ead33d7e9defa4d1538366705`.

24. **Contract identity** — 933 bytes; SHA-256 `d81c0b8aece4a106324131d4d356c7d0aac0e8618fac080c6b8b5e3a2381ee65`. Exact original bytes preserved, including their existing formatting.

25. **Semantic delegation** — Public SDK 1.1.0, independent verified closure, fresh workers and request-owned SDK objects. No MCP/CLI/shell/private bridge delegation.

26. **Semantic catalog** — Identities; prepare Policy; prepare Policy Set; evaluate either kind; verify Evaluation Identity; verify Policy Outcome.

27. **Operational catalog** — Health, readiness and version implemented in the parent prototype.

28. **Routes** — Exactly GET /v1/contract-identities, /v1/health, /v1/readiness, /v1/version; POST /v1/policies/prepare, /v1/policy-sets/prepare, /v1/evaluations, /v1/evaluation-identities/verify, /v1/policy-outcomes/verify.

29. **API identity** — Namespace /v1; memoryos.rest.v1; API 1.0.0; package 0.1.0.

30. **HTTP/TLS behavior** — Real native TLS 1.3 and HTTP/1.1 installed process tested; unchanged raw-gate handoff and strict Node parser; no plaintext product listener. Full certification pending.

31. **Binding/remote mode** — Local 127.0.0.1:13050 tested. RFC1918 assigned-interface validation implemented and unit-tested; remote startup refused until Phase 2.

32. **Authentication** — Single 64-lowercase-hex bearer token, decoded constant-time comparison; all nine routes exercised. Exhaustive startup matrix pending.

33. **Authorization** — Closed route/Host/header authority; proxy, Host alias and acquisition tests passed in focused suite.

34. **Browser exclusion** — Origin/Cookie rejection and no CORS; focused real HTTP tests passed. No browser client contract.

35. **State/admission** — One semantic owner, zero queue, four request and write slots; ownership units pass. Full stress matrix pending.

36. **Rate limits** — Two integer-nanosecond 20/sec burst-20 buckets; exact refill/backward-time boundaries PASS. Full flood campaign pending.

37. **Connections** — 32-socket configured cap and one request per connection. Pipeline rejection and 40 repeated successful connection-cleanup requests PASS; exhaustion campaign pending.

38. **Cancellation** — Ownership, cancellation, worker termination/reaping and publication guards implemented; complete real race matrix pending.

39. **Filesystem boundary** — Checked local operator reads and installed-file integrity implemented; client path strings rejected by schema. Full mutation/reparse/hardlink matrix pending.

40. **URL/SSRF boundary** — No URL acquisition; URL/UNC/path strings rejected in focused HTTP tests.

41. **Outbound-network mechanism/result** — Worker builtin/global denial hooks tested at 20 entry points (network/DNS/process/worker/native/file-write groups), PASS. No Windows OS-level denial proof was executed; hooks are not an OS sandbox.

42. **JSON parser** — Bounded strict UTF-8, duplicate decoded keys, surrogate/number/trailing-data rules and null-prototype objects; unit and focused real HTTP tests PASS.

43. **Schema validation** — Restricted first-party dialect and shared API contract; closed input/Base64 tests PASS. Complete dialect/adversarial review pending.

44. **Deterministic output** — J compact UTF-8 serialization; tested sorting and sparse-array rejection. Normative SDK bytes remain opaque.

45. **Normative bytes** — Canonical padded Base64 with exact decoded bounds; independent SDK byte/digest projection comparisons passed on the preceding candidate.

46. **Success/error model** — HTTP 200 for all three decisions; 23-code catalog. Focused stable semantic/gateway error comparisons pass; exhaustive error triggers pending.

47. **Observability** — Four-field bounded stderr JSONL and queue implemented. Normal service stdout empty and no bearer/body leakage in focused tests; blocked-writer/log-pressure campaign pending.

48. **Environment hardening** — Clean launcher environment, pinned executable/hash and prototype runtime rejection; prelaunch ACL/environment validator exists. Direct outer Codex environment was correctly refused for a NODE_* variable; sanitized launcher passed. Exhaustive injection matrix pending.

49. **OpenAPI identity** — Generated OpenAPI 3.1.1, 110,610 bytes; SHA-256 `829a31a40ac093d0755ac8bd89c4fc2605e1115909004d5c6849113626192d2f`. API source 14,343 bytes; SHA-256 `f93f5d4a107d2a5ce75c7ff417409b62831180d53d3e551467732419a74a6868`. Full consistency validator pending.

50. **Lockfile identity** — Root-only v3, 214 bytes; SHA-256 `a318c151d58954b5151fff808b983d958cc211b7c0521713b140c9bad14aa945`.

51. **Offline install result** — npm ci NOT_EXECUTED before the resource stop. The probe used an independently materialized deterministic package outside the checkout, not an npm-install PASS claim.

52. **SBOM/notices** — Preliminary SPDX 2.3 and complete upstream Node LICENSE copied; no blanket license grant. SBOM 21,525 bytes; SHA-256 `53b4b843222ddf8823ef1608d7c56f430d46d05d941bbcc68a4b3ebfd9cef27f`. Final license/component review pending.

53. **Supply-chain findings** — Official Windows ZIP hash matched `158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541`; Node release-key signature verified (fingerprint 5BE8A3F6C8A5C01D106C0AD820B1A390B168D356); signed plaintext and extracted executable matched pins. Fresh Node/OpenSSL primary feeds inspected; full recorded advisory dispositions remain incomplete. No zero-vulnerability claim.

54. **Windows measurement methodology** — Frozen 30 cold + 100 warm per required case, no discarded outliers, three 60-second adverse repetitions, committed generation memory, 1.5x headroom, rounding and boundary checks remain mandatory.

55. **Measurement sample counts** — Only the final early diagnostic ran: one new installed-server process, identities then maximum-MIP Policy (two observations; producer labels 0 cold / 2 warm). No complete per-case 30/100 campaign or adverse-scenario repetitions. This probe cannot certify those counts.

56. **Final per-operation wire limits** — NOT_FROZEN; PRELIMINARY artifact unchanged. Diagnostic maximum-MIP request 699,393 bytes, response 4,349 bytes.

57. **Final memory budgets** — BLOCKED: young committed peak 139,472,896 bytes; ceilMiB(1.5x)=200 MiB >128 MiB frozen ceiling. Live counter 16,173,336 bytes is not the required committed counter. No ceiling raised or result clamped.

58. **Final semantic deadline** — NOT_FROZEN. Observed maximum-MIP operation 1,397,386 microseconds is a diagnostic sample, not the required campaign maximum.

59. **Final limits identity** — No final limits. Existing PRELIMINARY 1,530 bytes; SHA-256 `ea2a84c4d4375f242cc9d6de54a923e2fab39ed97659c0d6a47298fe525aa917`.

60. **Boundary-test result** — Eight boundary/security unit groups PASS, covering rate, slots, ownership, raw syntax/count/target/value, auth/media, remote binding, serialization and four byte envelopes. Full release-critical boundary catalog incomplete.

61. **Real HTTP result** — Preceding development candidate: 65 SDK vectors +29 other recorded checks, HEAD/duplicate/pipeline checks and 40 cleanup requests PASS. Final measured candidate: identities and valid maximum-MIP Policy match SDK; then resource gate blocks. Full final-candidate integration not repeated after stop.

62. **Client interoperability** — Raw TLS client executed. Required Node fetch and curl interoperability NOT_EXECUTED.

63. **Adversarial result** — Focused framing/auth/Host/proxy/JSON/schema/acquisition and 20 worker-denial checks PASS. Full frozen adverse/lifecycle/package catalog incomplete.

64. **Semantic parity** — 65 independently generated SDK vectors matched preceding installed candidate, including Policy/Set PASS/FAIL/CNE, six rules, digest/tamper errors, normative golden verifications and 4,060-byte outcome. Final probe matched two vectors. No release certification claim.

65. **MCP witness** — NOT_EXECUTED. Existing MCP fixture construction was inspected as background; oracle imports authoritative SDK/source only; MCP package unchanged.

66. **Conformance inventory** — NOT_CREATED. Phase1-bound state is prohibited by the failed memory gate.

67. **Phase 1 receipts** — No formal Phase 1 PASS receipt. Exact early BLOCKED diagnostic copied to repositories/cca-conformance/evidence/mo1305-phase1-early-measurement-blocker.json; 2,529 bytes, SHA-256 a270bfd3bdc768772a6cd0f10ce6f26918b570c4cad6a18ebf648a3f33574117. This is not a completed resource receipt.

68. **Phase 1 package tests** — 19 focused unit tests PASS on final uncommitted modules. Full Phase 1 package suite is not complete.

69. **MO-1305 Phase 1 conformance** — NOT_EXECUTED / BLOCKED; 49 platform-policy negative witnesses separately PASS.

70. **Predecessor regressions** — Required full selected regression run NOT_EXECUTED after stop. Released code/evidence/tag objects were not modified.

71. **Workspace verification** — tools/verify_workspace.py --root . PASS with expected Python. This verifies current registration, not completion of missing REST conformance registration.

72. **git diff --check** — PASS. Correction staged diff checks passed; final untracked first-party whitespace scan PASS (unchanged authoritative/upstream copies excluded).

73. **I1 diff summary** — No I1 staged or committed. Untracked prototype includes server/worker/security modules, contracts/OpenAPI, build/notices/SBOM foundation, focused tests, tooling and checklist.

74. **I1 hash** — ABSENT.

75. **I1 parent** — Required parent remains C=`c2e3835b852fd966046ac9e984538fdcaf8b26bf`; no I1 exists.

76. **B1 diff summary** — None; B1 preparation prohibited by the failed measurement gate.

77. **B1 hash** — ABSENT.

78. **B1 parent** — Would require a successful existing I1; absent.

79. **Post-B1 graph-aware result** — NOT_EXECUTED; no B1 exists.

80. **Final Git status** — Intentionally dirty with preserved untracked Phase 1 implementation, tools, checklist/report and diagnostic. No staged changes; tracked tree unchanged after C. A clean successful B1 state was not reached.

81. **Confirmation no push** — No push performed.

82. **Confirmation no tag** — No tag created; memoryos-1.3-mo1305 absent, predecessors unchanged.

83. **Phase 2 pending values** — All Phase 2 gates remain PENDING, including enabled remote mode, complete lifecycle/security/interoperability, deterministic/offline distribution certification and B2 identities.

84. **Phase 3 pending values** — All Windows release certification, full real-client/adverse campaign, resource confirmation, final binding and release tag remain PENDING. Ubuntu/Linux, VM and cross-platform parity remain NOT_REQUIRED.

85. **Exact next task** — Requested next milestone: MEMORYOS 1.3 MO-1305 REST GATEWAY PHASE 2 IMPLEMENTATION — NOT_READY. Immediate prerequisite: review the measured young-generation/headroom failure and authorize the required correction/resolution, then resume Phase 1 and complete I1/B1 before Phase 2.

MO-1305 PHASE 1 MEASUREMENT BLOCKED

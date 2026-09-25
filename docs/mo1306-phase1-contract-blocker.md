# MO-1306 Phase 1 — contract blocker and preserved work

**MO-1306 PHASE 1 CONTRACT BLOCKER**

Implementation stopped under section 2 of the Phase 1 request. The frozen
whole-process-tree ceiling conflicts with the required Windows PowerShell
path-check mechanism as actually observed on this native Windows host.
This report makes no general claim that every possible Windows hosting
arrangement is impossible; it records the concrete frozen-profile failure.
A reviewed process-accounting/launch correction is needed before certification.
No OS-owned process has been silently excluded from the count.

## Exact evidence

Contract Freeze 1 section 11, lines 525–542, requires the fixed
scripts/check-paths.ps1 helper, executed by absolute Windows PowerShell with
-NoProfile -NonInteractive -EncodedCommand and a bounded private stdin/stdout
protocol. Section 13, lines 627–630, requires at most the supervisor plus one
direct child in the **whole product process tree**. Section 14, line 707,
fixes processCount=2; changes require a contract correction.

The first externally observed real generic run returned semantic PASS and a
complete bundle, but resource conformance failed. At elapsed 1620 ms:

| PID | Parent PID | Process |
|---|---|---|
| 26300 | 6688 | node.exe supervisor |
| 7660 | 26300 | conhost.exe |
| 15228 | 26300 | powershell.exe path helper |
| 25716 | 15228 | conhost.exe |

The run had 292 samples, a 50 ms requested interval, maximum observed gap 77 ms,
20,549 ms total observed duration, 4,678 ms total sampling overhead, observed
peak aggregate RSS 201,007,104 bytes, and peak process count **4**.
RSS is sampled characterization, not an OS-enforced or exact in-call peak.
The resource failure was retained; semantic PASS does not make this a
conformance PASS.

The narrower helper probe starts a detached supervisor to remove its console
host and uses the exact frozen helper argv and private request:

| Helper launch | Helper exit | Protocol response | Observed process count |
|---|---:|---|---:|
| ordinary hidden child, shell=false, anonymous pipes | 0 | Exact valid safe=true response | **3** |
| detached hidden child, same argv/request | 0 | **Empty stdout: protocol failure** | 2 |

The functional helper probe observed node.exe PID 13888, powershell.exe PID
27944 (parent 13888), and conhost.exe PID 10168 (parent 27944). Detaching the
PowerShell helper did not supply a valid alternative. The experimental
detached product options were reverted; experimental launch restrictions were
not added to the frozen contract.

Relevant retained files:

- [First measured run](../repositories/cca-conformance/evidence/mo1306/phase1/real-evaluate-policy-pass.json)
- [Functional helper probe](../repositories/cca-conformance/evidence/mo1306/phase1/helper-probe-attached.json)
- [Detached helper protocol failure](../repositories/cca-conformance/evidence/mo1306/phase1/helper-probe-detached.json)
- [Probe driver](../repositories/cca-conformance/tools/mo1306/helper_probe.py)
- [Exact helper probe](../repositories/cca-conformance/tools/mo1306/helper-probe.mjs)
- [Native Win32 observer](../repositories/cca-conformance/tools/mo1306/observe.py)
- [152 passing contract tests](../repositories/cca-conformance/evidence/mo1306/phase1/contracts-test.txt)
- [Original execution harness bytes](../repositories/cca-conformance/evidence/mo1306/phase1/execution-harness-initial.py)

A separate diagnostic confirmed that Node/libuv copies a fixed Windows
environment-variable list from the parent when omitted from spawn's env.
Names only were collected, never inherited values. The partial implementation
now deletes those fixed non-allowlisted parent names without reading them.
That change is not claimed as complete environment certification.
The pinned upstream implementation documents the environment insertion and
Windows process creation behavior:
[Node 24.21.0 libuv process.c](https://github.com/nodejs/node/blob/v24.21.0/deps/uv/src/win/process.c).
These observations do not justify relaxing the freeze.

## Required numbered report

1. **Baseline:** Exact workspace C:\Users\melsa\Documents\Codex\cca-workspace,
   main, initially clean. Starting HEAD
   3537b037e4ea70a726a249d7397f1df15daa2167, expected subject and parent verified.
2. **Freeze commit:** 3537b037e4ea70a726a249d7397f1df15daa2167; unchanged.
3. **Package:** memoryos-ci@0.1.0, incomplete uncommitted foundation.
4. **Production dependencies:** Zero external npm dependencies; Node built-ins.
5. **SDK/runtime closure:** All 25 exact released source files copied and
   mechanically verified; SDK version 1.1.0.
6. **Contract identity:** memoryos.cicd/1.0.0. Current partial contract digest
   sha256:a0a42701669d703414a6d54c5a548c77a1ee18290aa29300e1e1b5f1ad01650d.
7. **Configuration schema:** Closed schema materialized; defaults, selection,
   path syntax and negative contract tests pass.
8. **Result schema:** Materialized and independently schema-checked; result
   cross-field and normative-identity checks implemented, full conformance pending.
9. **Evidence schema:** Materialized and independently schema-checked; full
   publication/tamper campaign pending.
10. **Error catalog:** Exact 28 machine errors plus diagnostic-only truncation
    code; all mapping rows tested.
11. **Metadata:** All 14 classifications materialized: 8 operational,
    4 diagnostic, 2 forbidden, zero semantic.
12. **Generic runner:** Partial actual Windows implementation; an earlier
    candidate returned PASS. Resource certification blocked.
13. **Trusted runtime:** Node 24.21.0 win-x64 length/hash verified. Current
    implementation verifies runtime/distribution; substitution campaign pending.
14. **Supervisor:** Direct SDK worker, bounded protocol, deadlines and
    cancellation code implemented; full lifecycle conformance pending.
15. **Exit codes:** All 11 classification mappings tested, including 0/6/7
    and operational 10–17. Complete real-exit corpus not executed.
16. **Semantic delegation:** Production uses the copied SDK only; no CLI,
    MCP or REST production fallback.
17. **Policy/Policy Set:** Exclusive model and preparation code implemented;
    only real Policy PASS completed before the resource stop.
18. **Regression:** Owner-bound baseline/candidate acquisition implemented;
    real Regression witness not executed.
19. **Context:** Fresh-facade SDK acquisition implemented; independent
    authority-boundary campaign incomplete.
20. **Filesystem:** Lexical checks, bounded stable snapshots and Windows
    attribute helper implemented. The helper/process ceiling is the blocker.
    Complete real reparse/hardlink/swap corpus not executed.
21. **Network:** Denial hooks implemented. Comprehensive route/constructor
    and offline isolation witnesses remain pending; no OS-wide denial claim.
22. **Environment:** Fixed child allowlist and preload checks implemented;
    libuv inheritance diagnosed. Complete poisoning/leak campaign pending.
23. **Limits:** All 44 frozen fixed fields materialized unchanged.
    State remains PRELIMINARY; engineering RSS ceiling remains 768 MiB.
24. **Measurement:** FAIL on process count: 4 in the runner, 3 for the
    functional isolated helper. Limits were not finalized.
25. **Result determinism:** Operational J golden test passes. Complete
    result-byte permutation corpus pending.
26. **Evidence determinism:** Canonical evidence implementation exists;
    full independent goldens/permutation witnesses pending.
27. **Provider IR:** Pure generic generation and provider interface foundation
    exists; Phase 2 readiness is not established.
28. **Generator:** Generic in-memory output ordering/determinism tests pass;
    real no-overwrite/publication campaign not executed.
29. **Injection defenses:** Common lexical/JSON/metadata/label negative tests
    pass; provider grammar work remains out of Phase 1 scope.
30. **Generic equivalence vectors:** Eight immutable predecessor vectors
    extracted with source hashes, including PASS/FAIL/CNE and maximum inputs.
31. **Real Windows execution:** Earlier Policy PASS returned exit 0 and a
    complete bundle; overall foundation conformance failed resource accounting.
32. **PASS vector:** Both normative files from the smoke run matched released
    golden bytes exactly.
33. **FAIL vector:** Materialized; real generic execution not reached.
34. **COULD_NOT_EVALUATE vector:** Materialized; real generic execution not reached.
35. **SDK parity:** Released golden-byte PASS comparison completed. Independent
    live source-SDK corpus prepared but not completed.
36. **CLI oracle:** Engineering-only oracle harness prepared; no CLI parity
    execution completed. Product has no CLI invocation.
37. **Package identity:** Current partial distribution manifest digest
    sha256:aa95ae7e8bda579f6ac095c646a279553c207cf44a55d14c9afd9e0a0f5fd9c5.
    No archive identity or release claim exists.
38. **Package file count:** 80 inventoried files including the distribution
    manifest. This is an incomplete package, not a certified archive.
39. **Offline install:** NOT EXECUTED.
40. **Source independence:** Closure/source equality verified; installed-package
    source-independence execution NOT EXECUTED.
41. **Supply-chain baseline:** Node hash verified; seven engineering wheels
    acquired from official PyPI, hashed, licensed and retained locally.
    PyYAML 6.0.3 and jsonschema 4.26.0 import successfully offline. npm closure,
    complete provenance/advisory review and reproducible packaging pending.
    No zero-vulnerability claim.
42. **Structural validators:** PASS for 11 schemas using full offline Draft
    2020-12 validation, catalog, limits, package inventory, closure and wheel pins.
43. **Negative witnesses:** 152 bounded contract tests include negative
    JSON/config/path/metadata/injection cases. Full process/filesystem/package/
    evidence negative corpus remains incomplete.
44. **Phase 1 conformance test count:** 152 unit/contract cases pass. They are
    not a complete Phase 1 conformance count; execution stopped on its first
    measured product resource failure.
45. **Phase 1 conformance result:** BLOCKED / INCOMPLETE, not PASS.
46. **Predecessors:** All five release tag objects and peeled commits match
    baseline; tracked and staged diffs are empty; copied SDK bytes match.
    Selected executable predecessor regressions were not reached.
47. **Phase 2 interface manifest:** Not created; readiness gate not met.
48. **Provider labels:** Generic is incomplete / validation blocked, not
    FOUNDATION_IMPLEMENTED or final certified. GitHub/GitLab/Jenkins/Azure remain
    NOT_IMPLEMENTED under MO-1306.
49. **Files changed:** New untracked package, engineering tools/fixtures,
    diagnostic evidence and this report only. No existing tracked file changed.
    Exact paths/hashes are retained in the [work inventory](../repositories/cca-conformance/evidence/mo1306/phase1/work-inventory.json).
50. **Workspace verification:** PASS.
51. **git diff --check:** PASS; tracked diff is empty. New files remain unstaged.
52. **I1 diff summary:** None; I1 gate failed and no staging occurred.
53. **I1 hash:** Not created.
54. **I1 parent:** Not applicable; HEAD remains the freeze commit.
55. **B1 diff summary:** None.
56. **B1 hash:** Not created.
57. **B1 parent:** Not applicable.
58. **Post-B1 validation:** Not applicable.
59. **Final Git status:** main with new untracked work; no tracked modification,
    no staged change. HEAD unchanged.
60. **Push:** None.
61. **Tags:** No creation/modification; five predecessor tags mechanically unchanged.
62. **Linux/Ubuntu/WSL:** Not used or required.
63. **VM:** None used or provisioned.
64. **External provider accounts:** None used, created or required.
65. **Task duration:** Approximately 47 minutes from 18:54:58 UTC, including
    bounded diagnosis and preservation; final timestamp recorded in closeout.json.
66. **Hard stop:** Respected; stopped on the explicit contract-blocker rule
    before 90 minutes.
67. **Exact next task:** Phase 2 is not authorized or ready. Required next action:
    reviewed MO-1306 Contract Freeze 1 correction resolving Windows console-host
    process accounting and a conforming helper launch mechanism. The requested
    successful-B1 Phase 2 task is not reached.

No implementation or binding commit was manufactured from partial evidence.
Resume only after the process accounting/launch conflict has an authoritative
disposition. Preserve the failed attempts and refresh all affected identities
and witnesses after any approved correction.

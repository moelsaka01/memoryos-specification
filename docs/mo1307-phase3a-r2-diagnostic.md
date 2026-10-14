# MO-1307 Phase 3A-R2 — one bounded engineering diagnostic

**Disposition: D — no defensible production correction selected from this observation.**

Exactly one authorized D-workload engineering helper execution occurred. It returned a valid `ERROR / MO1307_FILESYSTEM_BOUNDARY` response after **2091.8942 ms** of supervisor-origin-to-transport-settlement time. The helper exited 0, all three pipes closed, and the unchanged supervisor/transport reported `cleanupConfirmed:true`. This is a semantic refusal, not successful READ_SET completion. No second execution, warm-up, replacement or retry occurred.

This is **R2 DIAGNOSTIC EVIDENCE ONLY**. It is not certification evidence, a Phase 3A retry, production behavior, deadline characterization, reliability evidence, or evidence of the historical Step G cause. Phase 3A-R remains BLOCKED/incomplete; Phase 3D remains gated. H remains NOT_ESTABLISHED.

**Identity and baseline verification**

Main was clean at `4a1de6f00788e3c52a647d6f25aa1dbd2d5d5d97` before new tooling/evidence creation. Production remains exact C3RB `defe93989efc6501b1a730b82e79e705884b269b`. All 89 current production members matched the authoritative inventory and exact C3RB Git blobs. The accepted 3B-R and 3C-R commits exist and remain unchanged. The r3a worktree stays at C3RB with its pre-existing dirty status preserved; it was neither cleaned nor reset.

| Item | Exact bound identity |
|---|---|
| Production helper | 30210 bytes; SHA-256 `35381850f1ef8c322e528156ebd8779071ad3288cdccd4d0ebab51ce6f9c6ac8` |
| Engineering helper copy | 35097 bytes; SHA-256 `91b1c99a65876c5910a358e01115777ec720ae0f0abbcd6b41aae1dcef741b82` |
| Node | v24.21.0 win-x64; 93580104 bytes; SHA-256 `ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32` |
| PowerShell | Retained 5.1.26100.9444 executable identity; 495616 bytes; SHA-256 `8bb6fa8c283b4d92120b1ef249a9b311b0f804d4cabbe9981159976c8be76a5e` |
| Exact retained D.request.bin | 2128 bytes; SHA-256 `0767b86a4750d2b031c8d923824beb26bc0c7e89f05cf11ba2a21379b755a08e` |
| Raw response | 253 bytes; SHA-256 `7a3f3c864e04852a37da4c47cb698a85b5245d95dbf601f81d50e7e7de0d775b` |

The retained request names READ_SET sequence 3 and session `b8805276479cdf63559e29f779d9fe51fc1668b5cbd6ffed9be9cb778b977139`. Its 19 requested files total 19711 bytes. The request, manifest, requested files and complete 27-file relevant input-root inventory matched their available authority digests before execution and remained unchanged afterward. The existing D frame is a declared new-session workload surrogate at the original root; the missing original Step G frame was not reconstructed or claimed as replayed.

The [plan](../repositories/cca-conformance/evidence/mo1307/phase3a-r2-diagnostic/plan.json) binds production, runtime, input, historical-authority and tooling records. The [static preexecution review](../repositories/cca-conformance/evidence/mo1307/phase3a-r2-diagnostic/preexecution-review.json) records zero helper executions during preparation. Independent post-run review rehashed 163 descriptors with zero mismatches.

**Tooling and exact execution**

Existing minimal-observation tooling was inspected before creating this runner. It reuses the unchanged production `createSupervisor` and `createHelperTransportForTesting`; their existing process ownership, response validation, deadlines and cleanup remain in control. The spawn-forwarding wrapper checks the exact production executable, flags, cwd, environment and pipe options, then changes only the final fixed script argument to the bound engineering copy. It returns the real child without intervening assertions. There is no second transport/security implementation, external process observer, clock injection or private-sequence execution.

From the workspace root, the sole execution was:

```powershell
& '.\.cache\mo1304-phase3-toolchain\node-v24.21.0-win-x64\node.exe' '.\repositories\cca-conformance\tools\mo1307-phase3a-r2\profile-once.mjs' --request 'repositories/cca-conformance/evidence/mo1307/helper-deadline-characterization/requests/D.request.bin' --executions 1 --helper-limit-ms 5000 --cleanup-limit-ms 2000
```

The original supervisor enforces the limits; the command arguments assert the authorized values and do not override the product clock. Configured limits remain helper 5000 ms, aggregate helper-active 20000 ms, CLI admission 30000 ms, API/worker 10000 ms and failure cleanup 2000 ms. A create-new [execution claim](../repositories/cca-conformance/evidence/mo1307/phase3a-r2-diagnostic/execution-claimed.json) prevents reentry, including after failure. No C, E or Control-E execution occurred.

The diagnostic began at `2026-09-29T20:24:31.353Z`; the receipt closed after offline validation at `2026-09-29T20:24:34.692Z`. PID 18832 was the sole observed helper launch. The actual helper lifecycle is reported separately from orchestration and post-run hashing.

**Observation method and raw result**

The [engineering copy](../repositories/cca-conformance/evidence/mo1307/phase3a-r2-diagnostic/windows-inspect.instrumented.ps1) adds 25 observation blocks. Removing the hash-bound blocks recovers all original C3RB bytes exactly, without removed/reordered statements or split expressions. Native-call/error-capture adjacency, held/reopened handles, final-path checks, identity comparisons, resource checks and response construction remain unchanged.

Observation uses a saved redirected stderr byte stream opened before the original console detachment. Rows contain fixed phase labels, cumulative monotonic timestamps and counters only. No file paths, payloads or exception messages are emitted. The cap is 50 rows and 4096 bytes; actual output was **14 rows / 422 bytes**. Stdout contains only the original framed response. The unchanged transport received the same stderr chunks as the observational listener.

The [raw markers](../repositories/cca-conformance/evidence/mo1307/phase3a-r2-diagnostic/markers.stderr.bin), [raw response](../repositories/cca-conformance/evidence/mo1307/phase3a-r2-diagnostic/response.bin), [receipt](../repositories/cca-conformance/evidence/mo1307/phase3a-r2-diagnostic/receipt.json) and [mechanical analysis](../repositories/cca-conformance/evidence/mo1307/phase3a-r2-diagnostic/analysis.json) retain the observed values. Child Stopwatch frequency was 10000000 ticks/second. Child ticks and parent Node timestamps remain separate clock domains.

| Observed instrumented interval | Milliseconds | Scope |
|---|---:|---|
| First script timestamp to ENTRY | 20.9881 | Added observation setup; not production startup |
| ENTRY to declarations complete | 26.7803 | Includes marker overhead and original initial statements/function definitions |
| Native initialization, inclusive | 157.1226 | Includes the following console-proof interval |
| Console proof, nested | 86.0458 | Do not add again to native initialization |
| Request frame acquisition and EOF | 20.5009 | Includes waiting and observation overhead |
| Request parsing and validation | 872.0058 | UTF-8, depth, canonical JSON, schema, paths and caps together |
| Completed root-chain acquisition | NOT_OBSERVED | ROOT_END absent |
| ROOT_BEGIN to error-serialization entry | 119.3160 | Refusal, unwind, catch and error-envelope preparation; not pure native cost |
| Error serialization and UTF-8 | 13.1542 | Only the 253-byte framed empty ERROR response |
| PREWRITE to FLUSHED | 6.6676 | Includes marker overhead and response write/flush |

Parent observations, measured in the separate Node clock:

| Parent interval | Milliseconds |
|---|---:|
| Spawn call return | 18.9531 |
| Helper origin to first received stderr marker | 814.2959 |
| Helper origin to first response byte | 2057.5698 |
| First to last response byte | 0.4930 |
| First response byte to transport settlement | 34.3244 |
| Supervisor helper-active charge | 2091.8279 |
| Helper origin to transport settlement | 2091.8942 |
| Full transport.exchange interval | 2093.6728 |

The first-marker receipt interval is not an isolated PowerShell-startup measurement: it includes creation, engine/script processing, marker setup, pipe delivery and parent scheduling. The exchange starts before the supervisor's helper origin and includes preliminary parent request decoding/copying. These intervals are not an exhaustive additive decomposition, and no assumed observation overhead is subtracted.

Observed labels were ENTRY, DEFINITIONS, NATIVE_BEGIN, CONSOLE_BEGIN, CONSOLE_END, NATIVE_END, REQUEST_BEGIN, REQUEST_READ, REQUEST_VALID, ROOT_BEGIN, ENCODE_BEGIN, ENCODE_END, PREWRITE and FLUSHED. Missing labels were ROOT_END, FILE, FINAL_ROOT_BEGIN, FINAL_ROOT_END and ALGORITHM_END. Successful D processing would have emitted 19 FILE rows and 18 milestones, totaling 37 rows. No completed-file cumulative counter row was observed; missing phase measurements are unknown, not zero.

**Failure attribution and cleanup**

ROOT_BEGIN followed by error serialization without ROOT_END localizes the refusal to the initial root-chain acquisition, before the file loop. Later markers continued; the low marker count/byte total excludes marker-cap exhaustion, and the marker writer's persistent failure flag would have suppressed those later rows. The FILESYSTEM_BOUNDARY code is consistent with original root/path/native identity checks. The exact ancestor, native operation, predicate and Win32 cause were not instrumented and remain unknown.

The unchanged transport accepted a matching canonical ERROR frame, observed exit 0/no signal and all three pipe closures, and confirmed quiescence using the source-bound native-console proof preceding any valid response. No independent external console-handle observation was collected. There was no timeout, cancellation or supervisor terminal event. Consequently the configured 2000-ms failure-cleanup allowance was not exercised; normal settlement completed with `cleanupConfirmed:true`.

**Candidate interpretation and limitations**

Selection is **D: no defensible production correction selected from this observation**. File-buffer allocation/read/post-read validation and successful READ_SET response serialization were not reached. The small error-response encode interval cannot rank specialized response serialization against request-local buffer reuse. The sizeable completed parsing/validation interval does not identify a specific removable implementation cost. The two earlier static candidates remain candidates, without new benefit or equivalence evidence.

Instrumentation adds script bytes/parsing, Stopwatch calls, counter arithmetic, synchronous bounded stderr writes and parent listeners. Its overhead is uncalibrated and may perturb execution. Execution-token/access-policy parity with accepted native runs has not been measured. Neither an environment cause nor a production defect is established. This observation does not establish why historical Step G timed out, does not establish production timing or reliability, and supplies no new H.

No production correction is recommended from this observation alone. Any further diagnosis or production correction requires separate human authorization. There is no authorization here for another execution, 3A certification, 3B/3C refresh or Phase 3D.

**Created files and repository status**

Only this report and the following new diagnostic tooling/evidence were created. No pre-existing tracked file was modified. Main remains at `4a1de6f00788e3c52a647d6f25aa1dbd2d5d5d97`; these new files remain untracked. There is no commit, production change, push or tag. The r3a status and bound historical/input bytes remain unchanged.

| Location | New files |
|---|---|
| `docs/` | `mo1307-phase3a-r2-diagnostic.md` |
| `repositories/cca-conformance/tools/mo1307-phase3a-r2/` | `instrument.mjs`, `profile-once.mjs`, `summarize.mjs` |
| `repositories/cca-conformance/evidence/mo1307/phase3a-r2-diagnostic/` | `plan.json`, `instrumentation.json`, `windows-inspect.instrumented.ps1`, `preexecution-review.json`, `execution-claimed.json`, `markers.stderr.bin`, `response.bin`, `receipt.json`, `analysis.json`, `offline-validation.json`, `artifact-inventory.json` |

The [offline validation](../repositories/cca-conformance/evidence/mo1307/phase3a-r2-diagnostic/offline-validation.json) checks bindings, exact source recovery, limits, marker syntax/monotonicity and evidence classification without launching any helper. The artifact inventory binds the final report, tools and evidence and excludes itself to avoid self-reference. No further execution was performed.

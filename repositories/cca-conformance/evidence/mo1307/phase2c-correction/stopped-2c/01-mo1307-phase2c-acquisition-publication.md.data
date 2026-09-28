# MO-1307 Phase 2C acquisition/publication: blocked at frozen inspection seam

Status: **STOPPED - PHASE 2C NOT COMPLETE; NOT READY FOR PHASE 2D INTEGRATION.**

The requested baseline is correct and the trusted Windows runtimes are available. Implementation stopped under task section 55, which expressly requires STOP and a focused blocker report when the Phase 1 protocol is normatively insufficient. No product file, shared schema, protocol byte, limit or acceptance expectation was changed. No Phase 2C completion commit, push or tag was created.

The blocker is the connection between the closed Phase 1 helper protocol and the required native publication inspection hook. It is not a claim that Windows cannot perform the required checks, or that atomic publication under the frozen private-root precondition is inherently impossible. Two independent read-only reviews challenged the finding and reached the same conclusion.

Baseline and environment:

| Item | Verified observation |
|---|---|
| Worktree | `C:\Users\melsa\Documents\Codex\cca-mo1307-2c` |
| Branch | `codex/mo1307-phase2c-acquisition-publication` |
| B1 / HEAD | `3883ca889911fcc5a6f46c24e569478a8c32648e`; initially clean |
| I1 / B1 parent | `7aa5ede6ec52b36d0428273d78c8ca7aa37a39ee` |
| Freeze / I1 parent | `e0cb8e9cc6aa73e26945db30756a6667a8d9e322` |
| B1 change set | Exactly `ROADMAP.md` and the Phase 1 `binding.json`; conformance-only subject verified |
| Node | `v24.21.0`, `win32`, `x64`; 93,580,104 bytes; SHA-256 `ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32` |
| Node executable | `C:\Users\melsa\Documents\Codex\cca-workspace\.cache\mo1304-phase3-toolchain\node-v24.21.0-win-x64\node.exe`; absolute retained runtime, no PATH substitution |
| PowerShell | `5.1.26100.9444`, Desktop, 64-bit; `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`; 495,616 bytes; SHA-256 `8bb6fa8c283b4d92120b1ef249a9b311b0f804d4cabbe9981159976c8be76a5e` |
| Native OS observation | `10.0.26200.0`; no Linux, Ubuntu, WSL, VM or Docker used |

The full [Freeze](mo1307-contract-freeze-1.md), [foundation report](mo1307-phase1-foundation.md), helper protocol/artifact/README, Windows paths, publication primitive, CLI/API interfaces, limits and Phase 1 acceptance/characterization receipts were reviewed. The retained runtime was read and executed from its established installation; all new artifacts are confined to the requested worktree.

The exact contract conflict is:

| Authority or implementation | Required or permitted behavior |
|---|---|
| Freeze section 17, lines 1093-1108 | The same helper validates output destination identities. At most four ordered requests; the evaluate fourth operation is CHECK_OUTPUT. |
| [helper-protocol.mjs](../repositories/memoryos-readiness/src/helper-protocol.mjs), lines 53-57 | CHECK_OUTPUT accepts sequence 4, exactly one output root and zero files. |
| Same module, lines 108-121 | Successful CHECK_OUTPUT is ABSENT, with zero files and exactly one output-parent identity. Its finalPath must be the destination parent, not the new output directory. |
| Same module, lines 17-19, 74-96, 162-187 | Records and framing are closed. Additional fields, trailing frames, fifth requests, overlapping requests and retries are not an established extension channel. |
| [publication.mjs](../repositories/memoryos-readiness/src/publication.mjs), lines 43-59 | The trusted inspect hook must return complete native chains before mkdir and for the newly created directory after mkdir. |
| Same module, lines 78, 96-99 | Staging checks the root again and binds the newly created pending-file chain. |
| Same module, lines 110-135 | Finalization checks root and pending chains again, verifies exact pending bytes, checks absence and deadline/cancellation, then renames once. |
| [windows-paths.mjs](../repositories/memoryos-readiness/src/windows-paths.mjs), lines 93-106 | Component chains require each drive/ancestor/root/descendant identity; these are supplied by the trusted native helper, not inferred from lstat. |
| Freeze section 21, lines 1362-1365 | New architectural gaps require correction before dependent work, not an invented interpretation. |

An ABSENT observation cannot supply checked identities for an output directory and pending file created afterward. Consuming all four slots before evaluation leaves no permitted helper request for those checks. Delaying slot 4 until after worker termination avoids overlap but does not change its absence-only, parent-only response. Holding the helper open does not create an additional allowed request/response or publication-control channel.

Alternatives considered, without implementing any of them:

| Alternative | Why it does not fill the existing seam |
|---|---|
| Create/stage before CHECK_OUTPUT | The output directory is then present, contradicting the successful ABSENT result. Creation/staging already require native inspection. |
| Add root/pending/chain fields or a new status | The current decoder rejects them. They widen closed accepted bytes or change operation meaning and need interface review. |
| Use READ_SET or a fifth call for output | READ_SET rejects output capabilities; the sequence rejects a fifth call and requires CHECK_OUTPUT for evaluate slot 4. |
| Use another response, pipe or helper mode | Introduces protocol/architecture outside the existing one-frame allowlist model. |
| Reuse parent identity or use Node stat/lstat | Does not establish native identities and all-reparse checks of the new objects; cannot satisfy the required fresh chains. |
| Assume private immutable roots make checks unnecessary | The precondition bounds namespace races; it does not remove explicit identity checks or create missing observations. |
| Add a first-party native addon | An in-process addon need not add an OS process or external npm dependency, and Freeze has no blanket addon ban. However, replacing the mandated same-helper observation model with another native acquisition path requires architectural and supply-chain reconciliation; Phase 1 establishes no such alternative. |

Missing ancestor arrays in READ_SET alone are not treated as a blocker: a trusted helper could check them internally before returning a checked terminal identity and immutable bytes. The blocker is the required publication hook and its fresh observations at multiple lifecycle points.

The frozen sequence remains:

| Slot | Operation | Scope and decoded caps |
|---|---|---|
| 1 | READ_SET | Sorted authority/config under input; 1,048,576 / 16,384 bytes |
| 2 | READ_SET | Sorted candidate/manifest under input, learned from validated config; 524,288 / 262,144 bytes |
| 3 | READ_SET | Explicit manifest files in ID order; at most 128, at most 2,097,152 bytes each and 8,388,608 aggregate; envelope cap remains 262,144 |
| 4 evaluate | CHECK_OUTPUT | One output root, zero files; ABSENT and one parent identity |
| 4 verify | READ_SET | result, or decision/result; result under result-root (4,194,304 bytes), decision under input-root (8,192 bytes) |

Framing is unchanged: four-byte big-endian length, canonical J body, one LF, total request/response ceilings 65,536 / 16,777,216 bytes; canonical base64 chunks at most 4096 characters. No working acquisition implementation is claimed.

Contract clarifications for the eventual implementation:

- Physical roots are the frozen input/result/output roots; config and authority reside under input-root. Runtime/tool installation is explicit. No invented root flags or cwd discovery are authorized.
- Topology is one supervisor, one active PowerShell helper plus console host, and one Node evaluation worker **thread**, with no helper/worker overlap. Old/young heap limits remain 128/16 MiB. The current diagnostic does not certify this topology or worker permissions.
- API/CLI/helper deadlines remain 10,000/30,000/5,000 ms, with the CLI evaluation sub-budget of 10,000 ms and separate 2,000 ms failed-call cleanup. Absolute monotonic checks, strict-before-deadline success and terminal cancellation remain required. Post-rename stdout failure retains the committed file and returns OUTPUT.
- Tags are authorized supplied observations (Freeze section 12), and product Git subprocesses are explicitly excluded (section 17). The task's conditional live-Git requirements do not activate. Engineering Git below only reads baseline/ancestry/status.
- Decision transport remains downstream of exact recomputation, with actor authenticity NOT_VERIFIED_BY_MEMORYOS. Authority/readiness semantics stay with 2B/2A; current production INTERNAL guards are preserved.
- Node Windows rename retains the documented limitation: no kernel no-replace claim against excluded concurrent adversarial namespace mutation. The private-root precondition does not justify skipping native inspection.
- stdout/stderr, fixed error/exit mappings, deterministic bytes, no-network operation, sanitized environments and retained pending failures remain unimplemented Phase 2C acceptance obligations, rather than inferred passes.

The predeclared [blocker campaign](../repositories/cca-conformance/evidence/mo1307/phase2c/blocker-campaign.json) was executed once with the [engineering reproducer](../repositories/cca-conformance/tools/mo1307-phase2c/blocker-probe.mjs). Its [receipt](../repositories/cca-conformance/evidence/mo1307/phase2c/blocker-receipt.json) records exact runtime identities, commands, monotonic elapsed times, baseline checks, source hashes and probe results. All 12 in-memory contract probes passed, reproducing the insufficiency. Synthetic identities are explicitly test doubles, not native filesystem witnesses. No product output directory or pending file was created.

The existing Phase 1 inventory verifier passed in --inventory mode: 821 bound artifacts, 75 package members, 53 contract members and all three retained characterization cases were checked. Historical --bound mode additionally hard-codes main and a clean tree, so it was not mislabeled as run on this task branch; exact B1 identity, parent, subject, change set and ancestry were checked separately. Full Phase 1 regression and characterization were not rerun after the stop condition. Their historical PASS is not promoted into a Phase 2C PASS. Workspace verification passed. git diff --check passed with no tracked changes; final evidence separately checks whitespace in new artifacts.

Only this report, the finite campaign, reproducer, receipt and final-checks receipt are added. No existing shared file changed, so there are no implementation overlaps with 2A/2B. New artifacts remain uncommitted for review. A feature completion commit would misrepresent the unmet acceptance criteria.

Required final-report accounting (NOT RUN below means not run in this stopped Phase 2C attempt):

| # | Requested field | Status |
|---|---|---|
| 1 | Baseline | Exact requested branch/HEAD; initially clean; verified above. |
| 2 | B1 | Exact identity, I1 parent, Freeze ancestry and retained bindings verified. |
| 3 | Scope | Focused protocol/publication blocker diagnosis only. |
| 4 | Runtime | Exact pinned Node 24.21.0 win-x64; hash/length PASS. |
| 5 | PowerShell | Trusted absolute system 5.1.26100.9444, 64-bit; identity recorded. |
| 6 | Helper request sequence | Frozen four-slot sequence documented; no operational implementation. |
| 7 | Helper operations | READ_SET/CHECK_OUTPUT unchanged; publication capability gap reproduced. |
| 8 | Helper framing | Unchanged closed Phase 1 framing; contract probes PASS. |
| 9 | Native identity | Production acquisition NOT IMPLEMENTED; no native-witness claim. |
| 10 | Filesystem policy | Frozen policy retained; native negative campaign NOT RUN. |
| 11 | Root separation | Existing input/result/output model retained. |
| 12 | Immutable snapshots | Existing foundation only; complete acquisition NOT IMPLEMENTED. |
| 13 | Supervisor | NOT IMPLEMENTED. |
| 14 | Process topology | At most three attributable OS processes, with a non-overlapping worker thread; NOT TESTED. |
| 15 | Helper/worker overlap | NOT TESTED. |
| 16 | Worker | NOT IMPLEMENTED; 128/16 MiB requirements retained. |
| 17 | Worker restrictions | NOT IMPLEMENTED/TESTED. |
| 18 | API deadline | 10,000 ms requirement retained; orchestration NOT IMPLEMENTED. |
| 19 | CLI deadline | 30,000 ms requirement retained; orchestration NOT IMPLEMENTED. |
| 20 | Helper deadline | 5,000 ms requirement retained; orchestration NOT IMPLEMENTED. |
| 21 | Cancellation | NOT IMPLEMENTED/TESTED. |
| 22 | Cleanup | 2,000 ms requirement retained; no product child campaign run. |
| 23 | Environment | PS identity query used only SystemRoot/WINDIR; product poison tests NOT RUN. |
| 24 | Network | No network/provider access performed; product runtime-denial tests NOT RUN. |
| 25 | CLI commands | Existing evaluate/verify guard preserved. |
| 26 | CLI dispatch negatives | Existing own-property-safe parser preserved; full campaign NOT RUN. |
| 27 | API | Existing two byte-snapshot functions and INTERNAL guards preserved. |
| 28 | 2A seam | Unchanged; full result computation remains integration-pending. |
| 29 | 2B seam | Unchanged; full authority/recomputation remains integration-pending. |
| 30 | Decision transport | Existing foundation unchanged; complete transport NOT IMPLEMENTED. |
| 31 | PRE_TAG | Supplied authorized ABSENT observation model retained; NOT TESTED here. |
| 32 | POST_TAG | Supplied annotated/name/target model retained; NOT TESTED here. |
| 33 | Git boundary | No product Git; engineering read-only baseline checks only. |
| 34 | Publication | BLOCKED by frozen inspection seam. |
| 35 | Pending file | No product pending file created. |
| 36 | Finalization | No product finalization attempted. |
| 37 | Rename limitation | Explicit private immutable-root limitation retained. |
| 38 | Failed-attempt behavior | First diagnostic receipt retained; no pending attempt to delete. |
| 39 | stdout | Frozen projections unchanged; product transport NOT IMPLEMENTED. |
| 40 | stderr | 4,096-byte requirement unchanged; product transport NOT IMPLEMENTED. |
| 41 | Exit mapping | Frozen evaluate 0/2/3/4, verify 0, errors 10-30 unchanged; transport NOT TESTED. |
| 42 | Filesystem negative count/result | 0 native negatives; NOT RUN. |
| 43 | Process negative count/result | 0; NOT RUN. |
| 44 | Environment negative count/result | 0; NOT RUN. |
| 45 | Publication negative count/result | 12 focused seam probes PASS in total; full publication negatives NOT RUN. |
| 46 | Tag negative count/result | 0; NOT RUN; live Git does not apply. |
| 47 | Decision negative count/result | 0; NOT RUN. |
| 48 | API negative count/result | 0; NOT RUN. |
| 49 | CLI negative count/result | 0; NOT RUN. |
| 50 | Determinism | Full product deterministic-publication campaign NOT RUN. |
| 51 | Phase 1 regression | Historical receipt/inventory/package/characterization bindings PASS; full regression NOT RERUN. |
| 52 | Native Windows test count/result | 12 contract probes executed on pinned Windows Node, PASS; 0 native filesystem/topology acceptance tests. |
| 53 | Runtime/process observations | Runtime/PS hashes and bounded diagnostic child durations recorded; no product topology certification. |
| 54 | Shared files changed | None. |
| 55 | Shared overlaps | None; prospective correction must centrally reconcile helper/publication/path seams. |
| 56 | Evidence | repositories/cca-conformance/evidence/mo1307/phase2c/. |
| 57 | Report | This file. |
| 58 | Workspace verification | PASS; exact output in receipt. |
| 59 | git diff --check | PASS; tracked tree unchanged; new-file whitespace checked separately. |
| 60 | Commit hash | No Phase 2C commit; HEAD remains B1. |
| 61 | Commit parent | No new parent; existing B1 parent is I1 as recorded above. |
| 62 | Final Git status | Existing tracked files unchanged; only five new untracked diagnosis/report files. |
| 63 | Push state | No push. |
| 64 | Tag state | No creation, mutation or deletion; retained tag binding verified by inventory checker. |
| 65 | Linux/Ubuntu/WSL | Not used. |
| 66 | VM | Not used. |
| 67 | Provider accounts | Not accessed or required. |
| 68 | Duration | About 10 minutes; exact diagnostic run 4,947.980 ms; final timestamp in final-checks receipt. |
| 69 | >90-minute checkpoint | Not applicable. |
| 70 | >2-hour checkpoint | Not applicable. |
| 71 | 3-hour hard-stop compliance | Compliant; stopped on the earlier contract condition. |
| 72 | Exact Phase 2D handoff | NOT READY; resolve the inspection lifecycle below before resumed 2C implementation. |

The required next authority decision is a reviewed correction defining how the fixed helper supplies native output-root, ancestor and pending-file observations after creation and immediately before finalization, while retaining or explicitly reconciling the four-request limit, closed wire representation, helper lifetime/deadline, no-overlap topology and publication token lifecycle. This report selects no replacement protocol and weakens no checks.

After that correction is bound, resume 2C from an explicitly authorized baseline; implement the operational surfaces; execute native filesystem/process/deadline/cancellation/publication tests and complete Phase 1 regression; then reconcile 2A/2B result and authority seams, shared packaging and byte identities in 2D. There is no executable Phase 2C implementation to integrate from this stopped attempt.

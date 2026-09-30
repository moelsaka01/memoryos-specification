# MO-1307 Phase 2C finalization boundary correction

This is the authoritative, targeted correction to [Contract Freeze 1](mo1307-contract-freeze-1.md) sections 15, 16, 18, 19 and V16, and to the finalization/deadline statements in the [publication inspection correction](mo1307-phase2c-publication-inspection-correction.md). It resolves the interval between submitting a non-cancellable native rename and learning its actual result. Actual successful rename remains the sole publication commit point. Submission is admission, not commitment.

The exact clean implementation baseline is `main` at C2CB `0d68ac211b3b204635e7af252cd693dce5bd70b1`, subject `conformance(memoryos-1.3): bind MO-1307 publication inspection correction`. Its C2C parent is `904908245483d3c64fb21d63aa5a6ebfd22102cb`. This document embeds neither a future implementation hash nor its own future binding hash. The [correction evidence](../repositories/cca-conformance/evidence/mo1307/phase2c-finalization-correction) separately records exact source, diagnostic, test and commit bindings.

## Demonstrated defect and preserved history

The dirty, stopped worktree `C:\Users\melsa\Documents\Codex\cca-mo1307-2c-resumed` is read-only evidence for this task. Its original `docs/mo1307-phase2c-resumed.md` remains **STOPPED / ENVIRONMENT_BLOCKER / NOT_PHASE2C_COMPLETE**. The later `docs/mo1307-phase2c-continuation.md` remains **STOPPED / CONTRACT_DEFECT / NOT_PHASE2C_COMPLETE**. Neither report becomes PASS. The latter's changed-file inventory binds 592 tracked/untracked files, including inert preservation snapshots; it does not certify the unfinished implementation.

The earlier script-policy blocker was resolved by explicit authorization for the exact fixed child-process arguments `-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File <fixed packaged helper>`, with the trusted system Windows PowerShell 5.1 executable and sanitized environment. A real READ_SET and confirmed quiescence passed in 1455.1296 ms; 13 launch-security tests passed. No persistent policy change occurred. Those historical results and the separate owned-console cleanup authorization remain intact; this correction does not reimplement or expand that launch authority.

The retained native diagnostic submitted one actual `fs.promises.rename` behind four finite engineering PBKDF2 jobs on the existing libuv pool. On pinned Node 24.21.0 win-x64, submission occurred at 2.8909 ms, terminal TIMEOUT at 62.8369 ms, and completion of that same rename at 805.8029 ms. At timeout, the final file was absent and pending present; afterward, final was present and pending absent. These are namespace observations, not merely a delayed callback. The 805.8029 ms value is elapsed from diagnostic start. The injected contention is engineering evidence, not a new product workload or a claim about ordinary rename latency. Original receipt SHA-256 is `91a6362dc7878e2d4fa618fd121b79215843a10cf462c955df89f0c99c0039d3`.

The prior contracts allowed timeout/cancellation to become terminal before actual commit while promising bounded cleanup and no later publication. A race around the submitted operation could satisfy the return deadline while leaving a real mutation outstanding. Suppressing its callback does not cancel it.

## Impossibility boundary and alternatives

The following cannot all hold for an already-submitted operation that cannot be cancelled and has no proven finite completion bound:

| Requirement | Disposition |
|---|---|
| A: actual successful rename is the sole commit point | Preserved. |
| B: timeout/cancellation can become terminal after submission but before settlement | Superseded for this one admitted rename. Observations are recorded, not returned as terminal TIMEOUT/CANCELLED. |
| C: every failed invocation returns within a fixed cleanup bound | Preserved before submission; not claimed while the admitted rename is unresolved. Bounded disposition resumes after settlement. |
| D: no mutation after terminal timeout/cancellation | Preserved by refusing to report that terminal outcome while rename is outstanding. |
| E: the submitted rename cannot be cancelled | Treated as the demonstrated fixed-platform limitation; no fictitious AbortSignal guarantee. |

If B and C allow return while E leaves a rename outstanding, that rename may later succeed and violate D; A prevents declaring it committed while final is still absent. This is a conditional impossibility for the fixed operation and authority, not a theorem that every Windows architecture is impossible.

| Alternative | Decision and concrete reason |
|---|---|
| `Promise.race` around rename | Rejected as a cancellation mechanism. A timer can settle the wrapper while the same native operation later mutates the namespace. Races are permitted only for bounded read-only post-settlement observations, whose late completion cannot publish. |
| Synchronous rename | Rejected. Blocking the event loop prevents timely same-thread timeout/cancellation observation and gives no finite OS-operation bound. It changes responsiveness without solving the cancellation guarantee. |
| Move rename to a worker thread | Rejected. Thread placement is not proof that termination cancels an already-submitted native operation. It also repurposes the sole, already-terminated evaluation worker and introduces unsupported publication authority. |
| Move rename to a child process | Rejected. Killing a process is not proof that an already-accepted filesystem operation did not commit. A new publisher process changes the fixed topology and still requires actual settlement/namespace reconciliation. |
| Add a native Win32 component | Rejected for this correction. No bounded, contract-compatible cancellation proof is established; an additional native component expands execution and supply-chain authority. The smaller settlement model is coherent. |
| Treat submission as commit | Rejected. The diagnostic had no final file at submission/timeout, and rename may fail. This would fabricate publication and violate the retained sole commit point. |
| Await the single admitted rename's settlement | Selected. Admission remains strictly deadline/cancellation checked; the actual operation decides COMMITTED versus FAILED. Availability can be unbounded during that one non-cancellable interval. |

No new helper, process, service, daemon, alternate native executable, publication worker or thread is introduced to hide the wait. No finite settlement deadline is claimed without an actual cancellation guarantee.

## Exact publication state and admission

The operational states are `PRE_SUBMISSION`, `COMMIT_IN_PROGRESS`, `COMMITTED` and `FAILED`. They are private operational state, not readiness states, result schema fields or normative digest inputs.

Before submission, all existing checkpoints, native inspections, exact-byte rereads, helper/worker termination, path rules and byte limits remain effective. The last checkpoint must observe no prior cancellation and a monotonic time strictly before the applicable absolute deadline. Equality is too late. No asynchronous gap or caller callback is permitted between successful final admission, setting COMMIT_IN_PROGRESS, and submitting the fixed same-directory rename. The token has already been consumed, so another caller cannot submit a second rename.

Admission requires the exact staged bytes reread and closed; slot 9's stable full pending/root chain and native final absence; the immutable captured root and fixed basenames; and completion of every previous helper and the sole worker. The pending and final names remain `memoryos-readiness-result.json.pending` and `memoryos-readiness-result.json`. There is exactly one rename attempt, no replacement, retry, alternate name or second publication.

After submission, COMMIT_IN_PROGRESS means an irreversible operation is outstanding. Deadline/cancellation observations set operational flags; they do not reject the finalization wait with TIMEOUT/CANCELLED, report cleanup complete, delete pending, retract a later result, or start other product work. The supervisor must await this exact promise. A native success immediately establishes COMMITTED. A native rejection establishes FAILED and OUTPUT. Existence alone never promotes a rejected rename to COMMITTED.

Cancellation observed strictly before admission remains CANCELLED and suppresses rename. At a checkpoint where deadline and cancellation are first observed together, now at/after deadline selects TIMEOUT; an earlier observed cancellation remains CANCELLED. After admission neither is a terminal publication outcome. A failed finalization/token remains consumed.

## Settlement, bounded observations and transport

The CLI's unchanged 30,000 ms deadline becomes the final rename's **admission deadline**. This exception does not increase acquisition, worker, helper, parser, staging or stdout budgets. The byte-only public API remains subject to its unchanged 10,000 ms deadline and performs no filesystem publication.

There is no hard upper bound on an admitted rename's settlement. An indefinitely stalled rename can keep that invocation pending indefinitely. This is the explicit availability cost of retaining actual commit truth without allowing mutation after a reported terminal timeout. External process termination is not a certified cancellation or cleanup result and cannot manufacture either success or a claim that no mutation occurred.

Ordinary failed-call cleanup before submission retains the 2,000 ms allowance. While COMMIT_IN_PROGRESS, no ordinary failure cleanup runs against the publication namespace and no cleanup-complete result is returned. After settlement, a single **2,000 ms read-only verification and operational-disposition allowance** starts, using the existing `cleanupAllowanceMs` number. This is a bounded post-settlement disposition interval, not a success grace period or another rename budget. It does not admit a helper, worker, write, deletion, retry or new publication. If finalization fails or has an overrun/cancellation, its error transport/cleanup shares this remaining allowance; it cannot restart a fresh two-second timer after verification. Timely successful finalization may enter ordinary stdout transport under the original CLI deadline; a later transport failure retains the original single failed-transport cleanup allowance from that first failure.

After successful rename, verify final bytes equal the detached staged snapshot and pending is absent. After rejected rename, verify retained pending bytes and final absence where safely observable; the outcome remains OUTPUT regardless. These bounded read-only observations supplement the actual rename outcome and slot 9's native authority under the private immutable-root precondition. They do not replace native reparse/identity checks, add a tenth helper, or claim a kernel no-replace guarantee. Failed, ambiguous or timed-out verification yields OUTPUT with `namespaceVerified:false`; actual COMMITTED/FAILED remains intact. A read-only observation still outstanding at its bound may later complete/close, but cannot mutate or change the terminal disposition.

Success remains eligible only after exact namespace confirmation and a final deadline/cancellation checkpoint strictly before the original CLI deadline. A rename admitted before the deadline but completed at/after it is an on-time admission with an operational overrun, not a late-admitted operation. Its publication is COMMITTED; its CLI outcome is **OUTPUT / exit 21**, final retained, with no newly attempted success stdout. Cancellation observed after admission similarly yields OUTPUT after successful settlement. Rename failure always yields OUTPUT and preserves owned evidence. No new error is introduced.

If successful settlement/verification remains timely and uncancelled, the existing stdout transport may proceed within the remaining original CLI budget. Only one complete LF-terminated summary is success; readiness exits remain 0/2/3/4. Timeout, cancellation, backpressure or another stdout failure after commit is OUTPUT, with the final file retained and no rollback. A partial summary is not success. Its failed-transport disposition has the original single 2,000 ms allowance from the first transport failure; neither transport nor cleanup may reset it or wait indefinitely. This is distinct from finalization already disposed as failed/overrun, which cannot enter a success transport attempt.

The former universal CLI 32,000 ms failed-return statement is superseded only for the admitted final rename's settlement plus the bounded post-settlement disposition described here. The API 12,000 ms failed-cleanup ceiling and all pre-submission numerical limits remain unchanged. No generalized deadline extension is authorized.

## Minimal shared foundation interface

The existing branded publication capability and opaque single-use token remain. `createPublication`, `stagePublication` and `finalizePublication` retain their call shapes; successful finalization retains `{path,byteLength}`. The foundation adds only these private module exports, with no package-root API change:

```text
publicationStatus(token) -> frozen {
 phase:PRE_SUBMISSION|COMMIT_IN_PROGRESS|COMMITTED|FAILED,
 admitted:boolean,
 deadlineExpiredAfterAdmission:boolean,
 cancelledAfterAdmission:boolean,
 namespaceVerified:boolean,
 dispositionDeadline:number|null
}
recordPublicationInterruption(token,code) -> publicationStatus(token)
publicationTransportCheckpoint(token) -> no value, or MO1307_OUTPUT
```

`recordPublicationInterruption` accepts only MO1307_TIMEOUT or MO1307_CANCELLED. Before admission it preserves the first observed interruption for the next checkpoint; the trusted supervisor supplies the existing simultaneous-observation precedence. After admission it records the applicable flags without settling an outstanding rename. Observing status never grants authority, admits an operation or resets a deadline. Foreign tokens reject. No flag can be cleared by the caller.

`dispositionDeadline` is null until the actual rename outcome is observed; it is then fixed once to that observation's `performance.now()` plus 2,000 ms. Read-only verification and failed/overrun finalization's error disposition use this same absolute monotonic deadline. The trusted supervisor uses the same clock domain; it cannot restart that allowance after `finalizePublication` returns or rejects. The value is operational only and never enters result/proof identity.

`publicationTransportCheckpoint` requires COMMITTED and verified namespace, observes the existing mandatory checkpoint, and maps any late/cancelled transport attempt to OUTPUT. It is used before and during stdout. Finalization itself awaits the single rename without a timer race, records checkpoint observations after settlement without misclassifying actual commitment, and bounds only the subsequent read-only checks. Full supervisor/CLI integration remains the targeted resumed-2C responsibility. The main foundation's helper remains guarded; engineering synthetic exchanges are not native acquisition certification.

## N24 operational timer clarification

Bounded per-operation and supervisor deadline timers are permitted. The Freeze already requires timer initialization and external deadline enforcement; an unconditional `setInterval` token ban is a test overconstraint. A timer must belong to one invocation/operation, have a finite purpose and deadline, and be cleared/disposed on success, failure, cancellation or terminal disposition. No persistent server, watcher, cross-run timer, background scheduler or recurring work survives a completed invocation.

The admitted unresolved rename does not authorize an indefinite polling loop. A one-shot deadline timer may record an overrun once and cease; cancellation may be recorded without starting periodic work. Timer cleanup must be tested through actual lifetime observations, including repeated calls, rather than inferred solely from the presence of a `finally` whose awaited operation might never settle. The foundation uses one bounded read-only confirmation timer; no persistent timer or new process topology is authorized.

## Security obligations

| Threat | Required control and targeted witness |
|---|---|
| Deadline bypass | Strict final pre-submission checkpoint; equality/expired time prevents the sole rename. |
| Cancellation bypass | Pre-admission cancellation prevents rename; post-admission cancellation is retained and blocks success transport without fabricating cancellation of native work. |
| Double commit | One opaque token and one irreversible transition; concurrent/repeated finalization rejects. |
| Second rename | Exactly one fixed native rename submission; no retry after success, failure or interruption. |
| Cleanup race | No cleanup disposition or mutation while COMMIT_IN_PROGRESS; await the exact operation. |
| Pending deletion race | Never delete pending/final as failed-call cleanup; preserve diagnostic bytes. |
| Namespace mutation during settlement | No additional product mutation after admission; private immutable roots remain an explicit operator precondition, not a hostile-OS sandbox. |
| Token reuse | Token consumed before asynchronous finalization; foreign/reused tokens cannot admit another publication. |
| Result substitution | Detached staged snapshot, exact pre-rename reread, stable slot-9 native chain and bounded post-settlement exact-byte verification. |
| False timeout | No TIMEOUT/CANCELLED terminal return for an admitted unresolved rename; actual queued-mutation regression must remain pending until settlement. |
| False success | Only actual successful rename establishes COMMITTED; verified namespace and timely complete stdout are additionally required for CLI success. |
| Post-commit rollback | Every later transport/verification error retains committed final; OUTPUT never retracts it. |
| Indefinitely stalled admitted rename | Explicit unbounded availability exposure limited to that one operation; no hidden helper/thread, retry or timer polling used to disguise it. |

## Compatibility, evidence and continuation authority

No public error, schema, readiness state, profile, provider classification, normalized result byte, readiness/proof digest, source-history disposition, grant or trust boundary changes. Private helper wire stays 2.0.0; nine evaluate/four verify requests, 5,000 ms per helper, 20,000 ms aggregate helper-active time, three maximum attributable process roles and no helper/worker overlap remain unchanged. All byte, heap, RSS and path ceilings remain unchanged. Network/provider/Git execution remains absent.

2A `b628349b4e678a8f71086b1b5c807ffe2edf9a5d` and 2B `b2877ab32c317bb67896414ba9cec64f6f436ca5` must remain **UNCHANGED_REUSABLE**, as checked by the new mechanical compatibility record. The prior C2CB is **SUPERSEDED_ONLY_FOR_FINALIZATION_BOUNDARY**. The dirty resumed implementation is **TARGETED_CONTINUATION_REQUIRED**, not completed and not generally discarded. Its accepted raw-source-lineage handoff and all prior failed/stopped evidence remain intact.

Required evidence includes the original diagnostic binding, A–E analysis, all seven alternatives, focused boundary/security/N24 tests, a finite actual queued-rename regression, unchanged semantic compatibility, package/workspace checks, changed-file inventory and existing-parent binding. Synthetic inspection frames and controlled clock/rename tests are labeled engineering; the actual queued rename is separately identified as native Windows evidence. Neither is a fresh full nine/four-request native 2C campaign. Failed development attempts are retained.

C2F must have parent exactly `0d68ac211b3b204635e7af252cd693dce5bd70b1` and subject `fix(memoryos-1.3): correct MO-1307 publication finalization boundary`. Its direct binding-only C2FB child has subject `conformance(memoryos-1.3): bind MO-1307 finalization correction`. C2FB binds only already-existing C2F bytes and contains no production change. No push or tag is authorized.

Only after exact C2FB and all required checks exist may a separately authorized final continuation reconcile the existing dirty resumed worktree onto that exact baseline. Preserve its bytes and historical evidence; no automatic reset, clean, stash, rebase, branch recreation or full semantic integration is authorized here. That continuation must connect corrected admission/settlement/disposition to its supervisor and CLI, preserve the authorized launch, complete outstanding current-source/native acceptance and only then seek the normal accepted 2C handoff. Phase 2D and release/tag approval remain unauthorized.

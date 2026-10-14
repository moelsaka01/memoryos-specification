# MO-1307 final headless correction addendum

Status: PROSPECTIVE AUTHORITY / VALIDATION_PENDING. This addendum defines the
newly authorized implementation and validation requirements. It records no
smoke, security, regression, package, installation or certification PASS and
assigns no new candidate identity.

## Controlling authorization and preserved authority

The user's "AUTHORIZED FINAL HEADLESS CORRECTION - IMPLEMENT -> VALIDATE ->
CERTIFY" request supplies `POST_DETACH_WITNESS_CORRECTION_AUTHORIZED` as the
controlling prospective authority. The request is preserved in
[authorization.txt](../repositories/cca-conformance/evidence/mo1307/final-headless/authorization.txt),
from attachment `82065378-137f-4746-b698-2f97ff92f5bd/Pasted text.txt`, SHA-256
`31442e397007ead68da717088a502d4b0d860580bb34518b19d83097a89cbd66`.
This authority is explicit; this addendum does not reinterpret the previous
request as having authorized removal of its sealed predicate.

The preparation baseline is `cb1e1428e40b99312cc167096d890285f5b9b220`.
Production authority remains C3RB
`defe93989efc6501b1a730b82e79e705884b269b` until a new candidate completes the
required gates. Accepted C3RB Phase 3B
`702c1b6381f6112a50ac844831d195275dac3350` and Phase 3C
`b02fc0226a1a2d800185a02071674ca80bdf4a1d` remain preserved acceptance evidence;
neither stream is executed in this task.

The [sealed headless correction](mo1307-headless-cleanup-correction.md), SHA-256
`dbca55d6094ec6bbfaa51cf85b850cc2b01ca0a3b0d80e56f9c29ad1c4930da0`, remains
unchanged. Its implementation, failed minimum smoke, T018 diagnostic, cached
0/error203 observation and [startup resolution](mo1307-startup-resolution.md)
remain historical evidence. Earlier J/G failures, ownership attempts, detached
launch and GetConsoleWindow failures are neither rewritten nor promoted.

## Exact prospective overrides and initial-zero authority check

Only the following requirements and their dependent wording are superseded for
the new candidate:

| Preserved text at the preparation baseline | Prospective disposition |
|---|---|
| Sealed correction, required behavior 3, lines 84-88: initial zero/error6 is admitted as absence | Replaced by authorization section 4: every initial zero return fails closed, including error6 and every other error. No initial-zero success path remains. |
| Sealed correction, required behavior 4, lines 89-93: FreeConsole success followed by a second membership query yielding zero/error6 | Replaced by authorization section 2: after positive sole-self membership, require successful self-only FreeConsole and make no second membership query. The entire post-detach zero/error6 predicate is removed. |
| Sealed correction, lines 50-61 and implementation descriptions: initial absence alternative or a separately queried post-detach absence witness | For this candidate, successful startup follows positive sole-self membership and the documented successful detachment transition only. A valid response and supervisor quiescence remain separate mandatory observations. |
| Dependent helper/transport documentation, observation labels and obsolete controls | Describe the actual revised predicate; do not require the removed query, error6, initial-zero acceptance or unidentified host death. Preserve the obsolete records historically. |

The authority check used immutable records at the preparation baseline: Contract
Freeze 1 sections 17-18; the Phase 2C owned-console authorization; the Phase 2C
finalization correction; the earlier console-ownership correction; the sealed
headless correction and its dependent helper README. No explicit higher-priority
requirement absolutely mandating acceptance of initial zero/error6 was found.
The initial-zero allowance appears in the sealed headless correction and its
implementation description. The new request section 4 expressly replaces it.
The older owned-console authorization requires sole-helper membership; it does
not mandate accepting initial zero. Freeze sections 17-18 contain no such API
return/error acceptance rule. There is therefore no initial-zero authority
conflict requiring implementation to stop.

The original Freeze remains unchanged, SHA-256
`831899163c36595ee38291eb6dd3fcff0ea0c6cc041a99f16933a11a6cdc17f8`.
The sealed correction's existing prospective replacement of the literal
helper/console termination observation in Freeze section 17 lines 1164-1165 and
the corresponding section 18 accounting language remains in effect only for the
supported headless path. This addendum changes neither the process ceiling nor
serialization and does not restore any host-termination claim.

## Required helper behavior

1. Retain the fixed trusted PowerShell executable and arguments, sanitized
   environment, working directory, `shell:false`, `windowsHide:true`,
   `detached:false` and three redirected product pipes. Do not add a helper,
   native API, alternate executable, command, module or fallback launch.
2. Before request processing, preserve the managed byte streams and validate all
   three actual standard handles. Each must be nonzero, not
   INVALID_HANDLE_VALUE, and report FILE_TYPE_PIPE. Borrowed standard handles
   are not closed or replaced by this check.
3. Allocate the existing fixed four-byte membership buffer, capacity one. Make
   the initial GetConsoleProcessList call. Only return count exactly one with
   that member equal to the current helper PID admits the next step. Return
   zero always fails closed, independently of cached last-error. Extra clients,
   overflow, mismatched sole PID, native failure or exception remain silent
   startup exit 22. No larger buffer, retry or alternative absence API is added.
4. After the positive sole-self observation, invoke FreeConsole on the caller
   only and require a nonzero result. A false return or startup exception is
   silent exit 22. Successful FreeConsole establishes the documented helper
   detachment transition; its last-error value is not a success predicate.
5. Do not call GetConsoleProcessList after detachment. Do not substitute error
   203, another error, a preset LastError value or any other undocumented absence
   witness. Do not allocate or attach a console afterward and do not introduce
   a console-creating fallback. Free the membership buffer on every applicable
   exit. No console-host handle is opened or owned by this path.
6. Continue the unchanged request parsing, filesystem/native acquisition and
   response framing after startup. Keep wire 2.0.0, schemas, session/sequence,
   request/response caps, readiness/tag/decision semantics, TOCTOU controls and
   human authority separation unchanged. Product startup refusal stays silent;
   no engineering diagnostic code is shipped as part of this correction.

No Toolhelp/PPID ownership, HWND ownership, host PID guessing, host-image lookup,
OpenProcess, host wait or speculative host termination is authorized. Membership
is a bounded topology admission check, not authority over another process.

## Supervisor obligations and unchanged limits

Detachment alone never permits a transition. Within the existing budgets, the
supervisor must establish a valid framed response, helper process termination,
stdout and stderr EOF, stdin completion and closure, all three stream closures,
closure of known owned resources and no active helper role. No helper/helper or
helper/worker overlap is allowed. Cancellation, timeout, crash, malformed or late
output and incomplete settlement remain fail-closed; later output cannot clear
a terminal failure. Owned-helper cleanup may act only on that known helper.

These observations establish the authorized helper/transport quiescence
predicate. They do not identify a console-host object or establish an independent
console-host process-exit observation. No unidentified host death is claimed.
The existing process ceiling remains one supervisor, at most one active helper
and at most one optional console host; the evaluation worker remains a thread.
Fresh certification J must assess the unchanged ceiling and lifecycle controls
under this corrected authority.

Limits remain helper 5000 ms, aggregate helper 20000 ms, CLI 30000 ms,
API/worker 10000 ms and terminal cleanup 2000 ms. All applicable cleanup time
counts against the existing allowances; no new grace, sleep, polling or retry
is introduced. The closed J arithmetic rule is exactly
`cleanupDeadline === terminalAt + 2000`, with zero epsilon, tolerance or slack.
The older 1000 ms native owned-object wait remains unchanged where applicable;
it is inapplicable to this path because no host handle or host wait exists.
H remains NOT_ESTABLISHED.

## Required progression and evidence boundaries

The first native smoke is exactly one invocation against the new implementation.
It must establish a successful positive sole-helper startup and self-detachment,
absence of a second membership call, request-read/consumption, valid expected
response bytes, expected stderr and exit, every process/stream settlement gate
and required quiescence. Bind the exact production bytes and fixed launch before
execution. Internal startup facts derived from successful-frame control-flow
must be described as such; do not invent telemetry or replay the smoke for it.
On failure, stop with PHASE3A_CONCRETE_IMPLEMENTATION_BLOCKER.

Only after the smoke passes may the corrected finite security matrix A-S run:
normal startup; sole membership; invalid pipes; extra client; every initial-zero
failure including the prior error6 route; overflow; PID mismatch; no host lookup;
no host termination; no post-detach allocation/attachment; crash; FreeConsole
failure with silent exit22; timeout; refusal aggregation; late output; complete
closure; no active helper; worker non-overlap; and unchanged deadlines. Keep
native observations, exact-function doubles and supervisor simulations explicit.
No obsolete post-detach error predicate or host-exit oracle is carried forward.
Stop at the first mandatory failure, without retries or replacement cases.

Then run the required 107-test regression campaign, native filesystem controls,
two TOCTOU controls, protocol, deadline/cancellation, cleanup/topology and package
integrity checks. Stop at the first mandatory failure. Recompute the helper,
README, any changed transport wording/observation label, distribution manifest,
SBOM, all 89 package members and authority/validation bindings. Create a new
candidate identity only after correction validation passes.

Only then perform a fresh short isolated worktree, fresh package and offline
installation, exact installed-member verification, complete sealed A-O inventory
and one ordered A-O certification generation. No historical PASS promotion,
retry or replacement execution is authorized. At the first mandatory failure,
stop. A completed mandatory A-O campaign is required for
PHASE3A_ACCEPTED_NEW_CANDIDATE and an immutable certification receipt, evidence,
acceptance commit, candidate binding and Phase 3D handoff input.

Do not execute Phase 3B, Phase 3C or Phase 3D, push or tag in this task. Any future
3B/3C refresh is scoped against the final candidate's exact dependency changes;
unchanged evidence requires individual dependency closure. Preserve this
addendum once bound into the smoke seal; record outcomes and implementation
identities in separate evidence rather than retroactively editing authority.

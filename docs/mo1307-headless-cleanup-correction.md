# MO-1307 headless cleanup correction

Status: IMPLEMENTED / VALIDATION_PENDING. The scoped implementation is present;
no test, security, regression or certification PASS is claimed.
Production authority remains C3RB `defe93989efc6501b1a730b82e79e705884b269b`.
The preparation baseline is `02d96d07b0ba926f7464f49ffa975273e8fed5c2`.
No new accepted candidate identity is assigned.

## Authority and exact scope

The user's "FINAL CONSOLE CLEANUP CORRECTION THEN VALIDATE AND CERTIFY" request
explicitly authorizes this amendment, including correction of the earlier exact
cleanup authorization where necessary. Its supplied attachment is
`56ef17e5-2855-4cca-92bc-c6047ed6371c/Pasted text.txt`, SHA-256
`5004889233a79a94e5c2a8c96fa5e8d70d6d364aece301551b528102cde08f5a`.

The controlling local text is reconciled as follows. Line numbers identify the
unchanged files at the preparation baseline.

| Authority | Existing requirement | Scoped disposition |
|---|---|---|
| [Contract Freeze 1](mo1307-contract-freeze-1.md), section 17, lines 1082-1109 | Fixed trusted PowerShell helper, sanitized launch, bounded native acquisition and no secret/request logging | Preserved. |
| Contract Freeze 1, section 17, lines 1110-1118 and 1139-1149 | One wire-2.0 request and response per invocation; exact sequence; no repeated/skipped slots or retries | Preserved. |
| Contract Freeze 1, section 17, lines 1161-1165 | Process ceiling, no helper/helper or helper/worker overlap, confirmed helper/console termination and bounded EOF before transition | Process ceiling, serialization and bounded transition remain mandatory. The literal host-termination predicate is explicitly replaced for the supported headless path by the observable quiescence rule below. |
| Contract Freeze 1, section 18, lines 1200-1206 and 1228-1247 | Overall, per-helper, aggregate, worker/API and cleanup budgets; quiescence included in active time; no success grace | Preserved, with the same scoped headless quiescence predicate used in accounting. |
| [Historical owned-console authorization](../repositories/cca-conformance/evidence/mo1307/phase2c-resumed/console-cleanup-authorization.json), scope entries at lines 7-12 | Sole-helper membership, parent/self attribution, trusted held host identity, self-detach, owned-host termination and bounded host wait | Historical authority and results remain unchanged. For this new path, host discovery, attribution, handle acquisition, termination and host wait are removed. Membership and self-detachment remain topology checks, not host ownership evidence. |
| [Previous console ownership correction](mo1307-console-ownership-correction.md), sections "Defect and scope" and "Unchanged production boundary" | HWND/owner/held-object proof, natural host exit and detached launch | Superseded for this new path. Neither an HWND nor historical numeric PPID is required or used; fixed detached:false is retained. |
| [Phase 2C finalization correction](mo1307-phase2c-finalization-boundary-correction.md), paragraph preserving launch and owned-console authorization | Earlier launch authorization remains separate from publication/finalization correction | Only the console-cleanup method is amended here; publication, rename admission/settlement and human authority are unchanged. |

Freeze section 17 literally requires confirmed helper/console termination.
This document does not claim that helper/pipe observations already proved host
process death under that wording. The new user authority supplies the explicit
scoped amendment. It changes the accepted observation method for this headless
path and prohibits a stronger host-death claim. It does not modify unrelated
Freeze semantics or retrospectively accept any failed candidate.

For binding, the baseline Freeze SHA-256 is
`831899163c36595ee38291eb6dd3fcff0ea0c6cc041a99f16933a11a6cdc17f8`;
the historical authorization SHA-256 is
`5a6cb53bb92cf8267c8c5ad0a90b7f9a2987c9206e2fe47a04e24f007100cb14`;
the prior console-correction document SHA-256 is
`9dbe2a81f373f57175ee51867dffd3d762bdf162a96e9212f728dcc63ffae2d8`.
The Freeze's last change is `a61a8ff6fe01028fd21f8abe7208d5ffbe9c5152`;
the preserved authorization entered the integrated history at
`198da12a6b67da0104e54f98d2c8fbecbbf4a840`; the previous console correction is
bound to unaccepted candidate `865978ff56229b60cca77bdb797987fc7d49aa4e`.

## Normative scoped replacement

For an invocation of the fixed supported headless helper, when no positively
attributed console-host object is available, no host process action is
authorized. The helper must establish valid product stdin, stdout and stderr
pipes and bounded current console membership. It may proceed only from
confirmed console absence or sole-helper membership followed by successful
self-detachment and confirmed absence. The supervisor may transition only after
a valid production response, helper process termination, complete stdout and
stderr EOF, stdin completion/closure, all three stream closures, no active
helper role and closure of known owned resources within the existing budgets.
No helper/helper or helper/worker overlap is permitted. These observations
establish bounded helper/transport quiescence and the helper's console absence;
they do not establish independently observed console-host process termination.

For this path, that rule replaces the demand for a positive host-object exit
observation in Freeze section 17 lines 1164-1165 and the corresponding
helper/console-termination phrase in section 18 active-time accounting.
All applicable time spent reaching this predicate counts against the existing
helper and aggregate budgets. A response alone remains insufficient.

The process ceiling remains one supervisor, at most one active helper and at
most one optional console host; the evaluation worker remains a thread.
The correction neither raises that ceiling nor grants overlapping invocations.
Fresh topology and lifecycle validation remains required before acceptance.

## Required helper and supervisor behavior

1. Keep the trusted fixed PowerShell executable, argument array, working
   directory, sanitized environment, shell:false, windowsHide:true,
   detached:false and three product pipes. No alternate executable, command,
   module, process-discovery mechanism or fallback launch is introduced.
2. Before request parsing, check the actual standard handles for stdin, stdout
   and stderr. Each must be non-null, not INVALID_HANDLE_VALUE and report
   FILE_TYPE_PIPE. Preserve the redirected byte streams across self-detachment;
   do not close or replace a standard handle as part of this check.
3. Allocate a fixed four-byte membership buffer with capacity one. A successful
   count of one must name the current helper PID. Count greater than one,
   overflow, a different sole PID or an ambiguous API failure is silent startup
   exit 22. Count zero with ERROR_INVALID_HANDLE is the specifically admitted
   absence observation; every other zero/error combination rejects.
4. For sole-helper membership, call FreeConsole only on the current helper.
   Require success and a subsequent GetConsoleProcessList result of zero with
   ERROR_INVALID_HANDLE. Reject any other post-detach observation before a
   response can be emitted. Free the membership buffer on every applicable exit.
   The absence branch requires no detach operation.
5. Membership does not identify a conhost owner. Do not use Toolhelp/PPID,
   GetConsoleWindow, GetWindowThreadProcessId, OpenProcess, host-image lookup,
   host waits or TerminateProcess to authorize this path. No host handle or
   host termination right is acquired. Ambiguity never authorizes destructive
   process action.
6. Preserve silent production exit 22 for actual startup-security failure.
   Emit no diagnostic stdout or stderr. Wire 2.0.0, frame boundaries, byte caps,
   session/sequence/operation validation, native filesystem checks and result
   serialization remain unchanged.
7. The supervisor still owns the helper process and its pipes. Cancellation or
   timeout may act only on that known owned helper under the existing cleanup
   policy. Reject malformed/missing/late responses, incomplete EOF/closure,
   unconfirmed helper exit or incomplete cleanup. A terminal failure never
   becomes success because later bytes arrive. No next helper or worker starts
   while the owned helper role remains active.
8. Observation labels, comments, receipts and assertions must describe the
   actual predicate. They must not say "conhost termination confirmed" or
   equivalent when no host object was identified. Helper console detachment,
   helper process exit and pipe closure are distinct observations.

Self-FreeConsole is permitted because it detaches only the caller. It removes
the helper's attachment without acquiring authority over another process.
Even when the console closes after its last client detaches, that is not a
held-object certificate of host process exit. No such certificate is claimed.
No successful membership sample is treated as authorization to terminate a host
if another client attaches later.

## Implementation binding before validation

The reviewed working implementation changes five package files. These identities
bind the implementation at this status update, not a future accepted candidate.

| File | SHA-256 |
|---|---|
| `helpers/windows-inspect.ps1` | `158a4008131ede42458ba60a8166e63abad180443031ea05bf75c3180a2ad846` |
| `helpers/README.md` | `4aa54a773ce9fd6ac63ab93ae7b55c6949f0796b8b30ffb37d5c16c85b7de2c2` |
| `src/helper-transport.mjs` | `edf285c39d8310a9e110a9264835581a234af91d67fe21bf864484867aab5cbd` |
| `distribution-manifest.json` | `c6f955d17f5546465a45fdc92d24510f569f56e1de36e9d21f30239595cd2c10` |
| `sbom.spdx.json` | `758777d238d164a3f73252b22480a3ee2fb990d7dae9fc665e525e87d99625f2` |

In the [helper](../repositories/memoryos-readiness/helpers/windows-inspect.ps1),
lines 95-103 retain the SafeFileHandle acquisition signature and add a separate
IntPtr GetFileType overload plus fixed GetStdHandle. Lines 124-147 implement the
three pipe checks, bounded membership, self-only detach and final absence;
lines 320-331 preserve silent startup refusal and check all three managed streams.
The native acquisition region beginning at Open-Native and the request-parser/
response suffix are unchanged from the preparation baseline.

In the [transport](../repositories/memoryos-readiness/src/helper-transport.mjs),
lines 15-20 retain the fixed non-detached launch. Executable control flow is
unchanged apart from the observation policy label at line 97; comments now name
helper console absence instead of unidentified host exit. Lines 52-70 and 88-101
retain frame, deadline, process, stream settlement and owned-helper cleanup gates.
No host-discovery, host-handle or host-termination primitive remains in the helper.

Static byte comparison and read-only checksum reconciliation found the current
88 distribution-manifest entries and 87 SBOM file entries consistent with the
working files. These checks do not replace the native smoke, security controls,
regressions, archive/install verification or Phase 3A certification required below.
Keep this specification and its implementation bindings stable once sealed;
record subsequent validation outcomes in separate evidence and final reports.

## Bounds and validation gates

Helper 5000 ms, aggregate helper 20000 ms, CLI 30000 ms, API/worker 10000 ms
and terminal cleanup 2000 ms remain unchanged. The previous 1000 ms native host
wait remains unchanged where a separately authorized owned-object wait applies;
it is not applicable to this path because no host handle or wait exists.
No substitute sleep, polling loop, retry or new allowance is introduced.
H remains NOT_ESTABLISHED.

Implementation must update only affected helper/transport documentation and
source plus derived package metadata. A transport observation label may change
to prevent an unsupported host-exit claim; lifecycle settlement checks must
remain effective. Recompute distribution-manifest and SBOM identities for
changed bytes and bind all package members. This document assigns no future
candidate or evidence commit hash.

First run one fresh minimum successful native wire smoke. On failure, stop.
Only after it passes may the finite headless/startup security matrix run,
including sole membership, extra client, overflow, API error, absent speculative
host termination, helper crash/timeout/late output, pipe closure, final quiescence,
worker non-overlap and real startup exit-22 behavior. Then run the required
107-test regression campaign, native filesystem and TOCTOU controls, protocol,
deadline/cleanup and package-integrity checks. Stop at the first mandatory
failure; simulated controls are not native host observations.

Only after those gates pass may a new candidate, fresh worktree/package/offline
installation, exact installed-member verification and freshly sealed A-O Phase
3A generation proceed once. J must validate the unchanged topology and lifecycle
requirements under this scoped rule; no historical PASS is promoted.
Do not run Phase 3B, Phase 3C or Phase 3D in this task. Existing accepted evidence
remains preserved. No push or tag is authorized.

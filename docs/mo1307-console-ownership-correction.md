# MO-1307 console ownership correction candidate

Status: IMPLEMENTED / VALIDATION PENDING. This is a new candidate based on C3RB
`defe93989efc6501b1a730b82e79e705884b269b`, not an acceptance or a rewrite of C3RB.
The user's final engineering request is the authority for selecting, implementing,
validating and conditionally certifying this minimal correction. All failed 3A
generations and accepted C3RB 3B/3C evidence remain unchanged.

## Defect and scope

Numeric Toolhelp parent PID cannot bind historical process lifetimes under
ordinary PID reuse. Historical parent-lifetime proof is not explicitly frozen.
GetConsoleProcessList enumerates clients and cannot identify their console host.
Neither previously rejected inference is retained. No cause is assigned to the
historical G startup failure. The corrected J harness remains the certification
basis; no old certification outcome is reused.

The existing windowsHide/pipe launch already requests CREATE_NO_WINDOW in pinned
Node 24.21.0/libuv, which does not guarantee console absence throughout PowerShell
initialization. The correction instead uses fixed detached:true/windowsHide:true
launch (DETACHED_PROCESS, with hidden startup window settings). It has the same
trusted executable, fixed argument array, sanitized environment and bounded pipes.
It does not promise PowerShell will allocate a console or produce an HWND: an
attached console without a usable window fails closed.

The attached-console branch binds current GetConsoleWindow ownership through
GetWindowThreadProcessId, OpenProcess(0x101000), GetProcessId and exact system
conhost.exe image. It repeats window/owner and sole-helper client observations,
then requires the retained process to be live after those observations. This
binds a current object without asserting historical ancestry. All operations
remain on that held handle. FreeConsole detaches only self; natural host exit
must be signaled within 1000 ms, then helper console absence is checked.

No host termination API or PROCESS_TERMINATE right remains. This prevents a client
joining between membership verification and detach from authorizing destruction
of that client's console. Missing identity, access denial, late attachment with
persistent host, wait failure or timeout remains silent startup exit 22, without
a frame or diagnostic. An invalid frame cannot assert console quiescence.

The parent=self condition in the previously exact cleanup authorization is
replaced explicitly by current console-window/object attribution and removal of
forced host termination. This is a scoped implementation/cleanup-authorization
correction under the user's new authority, not a relaxation of the Freeze's
process topology, attributable ownership, confirmed termination, EOF or deadlines.
Detached launch also removes libuv's parent-exit job association; finite parent
interruption validation is required. Normal child references and supervisor
cancellation/termination/EOF checks remain. No job-based ownership claim is made.

## Unchanged production boundary

Wire 2.0.0, schemas, readiness and 22 gates, tag/decision/publication semantics,
fixed PowerShell arguments, filesystem native checks, serializer, request/response
bounds, 5000 ms helper and 20000 ms aggregate limits, 2000 ms terminal cleanup,
1000 ms native host wait and human authority separation are unchanged. No extra
production executable, module, dependency, retry, loop or command input is added.
The 89-member package manifest and SBOM are regenerated for changed bytes only.

## Validation and certification gates

Run the finite new console security suite once, stopping at the first unexpected
failure. Native startup must pass before simulated native-call faults are counted.
Fault doubles are engineering checks, not native process-identity evidence.
Validate parent interruption and affected protocol, acquisition, filesystem,
TOCTOU, lifecycle, deadline and package-integrity regressions. Any failure stops
this task with a concrete implementation blocker; no architecture or timing loop.
Only after all correction validation passes may a fresh isolated new-candidate
3A package/offline install and full sealed A-O run start. Run it once and stop at
the first mandatory failure. No 3B/3C campaign or 3D runs in this task.

## Primary implementation references

- https://raw.githubusercontent.com/nodejs/node/v24.21.0/deps/uv/src/win/process.c
- https://learn.microsoft.com/en-us/windows/win32/procthread/process-creation-flags
- https://learn.microsoft.com/en-us/windows/console/creation-of-a-console
- https://learn.microsoft.com/en-us/windows/console/getconsolewindow
- https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowthreadprocessid
- https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocessid
- https://learn.microsoft.com/en-us/windows/console/freeconsole
- https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-waitforsingleobject

These references support the selected semantics; actual pinned-host behavior and
security/regression results are recorded separately and are not presumed here.

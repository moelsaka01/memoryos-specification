# Fixed checked Windows helper

`windows-inspect.ps1` is the same fixed Windows PowerShell 5.1 helper. The
[authoritative Phase 2C publication inspection correction](../../../docs/mo1307-phase2c-publication-inspection-correction.md)
updates its private protocol to `2.0.0`. The script implements checked native
acquisition and complete publication chains through fixed Win32 signatures
emitted in memory with Reflection.Emit. It launches no compiler, imports no
external assembly/module, creates no temporary file and writes no product file.
No caller-selected executable, native symbol, script or expression is accepted.

The trusted caller uses the installation's verified absolute Windows directory
followed by `System32/WindowsPowerShell/v1.0/powershell.exe`, with fixed
`-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File <absolute-packaged-script>` arguments.
Only verified `SystemRoot` and `WINDIR` are passed as environment entries.
There is no PATH lookup, selectable script/executable/expression, module import,
network, credential access, discovery or additional writable root.

Each invocation receives one frame and stdin EOF, returns one frame and stdout
EOF, then terminates. A frame has four unsigned big-endian length bytes and an
exact canonical J JSON body with one LF. Request/response ceilings including
the prefix remain 65,536 / 16,777,216 bytes. Unknown fields, operations, versions,
wrong sequence/session, extra frames, trailing data, noncanonical bodies and
unbounded transport reject. Private wire 1.0.0 is not a fallback.

Requests and responses carry the same fresh assessment `session` of exactly
64 lowercase hex characters, global `sequence` and operation. The session is
an operational correlation value supplied by the trusted wrapper, not native
authority or a readiness input. Root/file fields remain explicit and closed;
the correction document gives their exact shapes.

| Slot | Operation and observation |
|---|---|
| 1 | READ_SET authority/config with original caps. |
| 2 | READ_SET candidate/manifest paths from validated config. |
| 3 | READ_SET exact manifest files, bounded per-file and aggregate snapshots. |
| 4 evaluate | CHECK_OUTPUT: ABSENT with complete drive-through-parent chain. |
| 4 verify | READ_SET fixed result and optional decision. |
| 5 evaluate | CHECK_OUTPUT after worker termination, immediately before mkdir; parent stable against slot 4. |
| 6 evaluate | INSPECT_OUTPUT_ROOT after mkdir; created-root chain and stable parent prefix. |
| 7 evaluate | CHECK_STAGE_ROOT before exclusive pending creation; stable root chain. |
| 8 evaluate | INSPECT_PENDING after write/flush/verify/close; stable root prefix and exact pending length. |
| 9 evaluate | CHECK_FINALIZATION after final exact-byte reread/close; stable full pending/root chain and native final absence. |

Successful evaluate uses nine fresh helper invocations; verify uses four. Every
invocation has one request. They are serial, without skipped/repeated slots or
automatic retry. The helper and its possible console host must be confirmed
gone and transports closed before any next helper or evaluation worker. One
supervisor, at most one helper and its possible console host preserve the three
attributable OS-role ceiling. Evaluation is one worker thread, never a second
process, with no helper/worker overlap.

READ_SET retains checked terminal root/file identities and canonical base64
snapshot chunks of at most 4096 characters. Encoded and decoded caps remain
separate, including the 8,388,608-byte aggregate evidence ceiling. Output-root
is never a READ_SET capability. Inspection requests carry only the captured
output-root and `files:[]`; pending/final names are compiled constants.

Inspection response roots are `{id,chain}`: `output-parent` for CHECK_OUTPUT,
`output` for root checks, and `pending` for pending/finalization checks. Status
is ABSENT, OK or FINAL_ABSENT respectively. Chains contain exactly every native
drive/ancestor/root/leaf identity, with at most 120 records. The seven identity
fields and all reparse, link-count, type, path and stability checks are unchanged.
Errors have empty roots/files and no paths, contents or exception details.

The private `createHelperSequence(command,{session,now?})` is branded admission
state with begin/complete/helperExited, beginWorker/endWorker, checkpoint and
abort. A response does not permit the next transition before confirmed exit.
Invalid admission, failed response, timeout or cancellation terminally prevents
retry. The optional monotonic clock is a trusted internal supervisor/test seam,
never a public clock override or normative readiness input.

Each helper has 5,000 ms, with a new explicit **20,000 ms aggregate helper-active
ceiling** preserving the original four-times-five-second upper bound. Active
time starts before launch and includes startup, native work, framing/EOF waits
and confirmed process/console termination. The CLI's 30,000 ms deadline remains
absolute for helper acquisition and final rename admission; each helper deadline is the earliest of its own five seconds, remaining
aggregate budget and overall deadline. Equality is TIMEOUT. The API deadline
remains 10,000 ms; cleanup is at most 2,000 ms after failure, never success grace.
The supervisor enforces process/worker deadlines and confirms helper and transport termination.

`createPublicationInspection(sequence,root,{exchange,checkpoint})` creates a
branded single-use capability after worker termination. Its mandatory checkpoint
enforces deadline/cancellation; exchange is only trusted fixed-helper byte
transport returning `{responseBytes,exitConfirmed:true}` after actual quiescence.
`createPublication(root,{inspection})` accepts that capability,
followed by `stagePublication(token,bytes)` and `finalizePublication(token)`.
No arbitrary identity callback or Node-lstat fallback supplies native authority.
The opaque token binds one root/capability, exact detached bytes and checked
chains. Finalization consumes it exactly once.

Native final absence and the last checkpoint precede same-directory rename;
actual successful rename is the sole commit point. Node Windows rename can replace at kernel level, so
nonreplacement retains Freeze's explicit private immutable-root precondition
and exclusion of concurrent adversarial namespace mutation. No stronger syscall
guarantee is claimed. Failures retain owned pending bytes. Abort/deadline before
rename submission prevents publication. The authoritative
[finalization boundary correction](../../../docs/mo1307-phase2c-finalization-boundary-correction.md)
requires the single admitted non-cancellable rename to settle before terminal
disposition, even after deadline/cancellation. Submission is COMMIT_IN_PROGRESS,
not commitment. No finite settlement bound is claimed; no cleanup mutation,
second rename or extra helper is permitted. The unchanged 2,000 ms number bounds
subsequent read-only verification and failed/overrun finalization disposition.
Late successful rename remains COMMITTED but yields OUTPUT/21 with no success
stdout attempt. Timely successful finalization retains the original stdout
deadline; a later stdout failure returns OUTPUT and retains the committed file.
Verify creates no directory/file or publication
capability and never republishes a normative result.

The targeted continuation explicitly authorizes the exact fixed process-only
`-ExecutionPolicy Bypass` arguments for this packaged helper in production. The
launcher constructs the entire argv internally. No caller can select the policy,
script, executable or switches. This changes no persistent machine, user or
enterprise policy and introduces no caller launch override. Earlier engineering
Bypass receipts remain historical; fresh production launch evidence is required.
Synthetic protocol/identity tests establish only their engineering properties.
The resumed Phase 2C evidence separately records actual native helper, filesystem,
process and deadline witnesses; it does not claim integrated 2A/2B certification.

Native `CreateFileW` opens every drive/ancestor/leaf with
`FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS`. Ordinary file
handles request read access and allow only read sharing, denying write/delete
sharing. Directory handles use read-attributes access. The same file handle
supplies `GetFileInformationByHandle` identity, bounded sequential snapshot
bytes and after-read identity. `GetFileType` requires a disk object and
`GetFinalPathNameByHandleW` establishes the exact ordinary local handle path.
Attributes, type, relevant length, link count, volume serial and 64-bit file ID
are native values. Every chain component must share its checked drive volume.
Every held handle is rechecked and its path is reopened for all-seven-field
identity comparison before success. All handles close before the response.

Native absence admits only `ERROR_FILE_NOT_FOUND` for the exact leaf beneath
an already checked parent chain. Missing ancestors, access denial, sharing
failures and ambiguous native failures never become absence. Existing output
or final destinations produce a closed error; the supervisor maps publication
errors to OUTPUT. No identity is invented for an absent file/directory.

The fixed hidden PowerShell launch uses `detached: true` with redirected pipes.
On the pinned Node/libuv Windows implementation this requests `DETACHED_PROCESS`,
so the helper does not inherit another process's console. It does not claim that
PowerShell cannot allocate a console. The supervisor retains the child reference,
process-exit checks, transport EOF requirements, cancellation and fixed deadlines.
Detached launch does not inherit libuv's parent-exit job coupling; that changed
boundary requires explicit validation and is not an added cleanup guarantee.

Startup captures the byte transports and accepts either native no-console absence
or sole-helper console membership. For an attached console it requires a nonzero
`GetConsoleWindow`, obtains its owner with `GetWindowThreadProcessId`, and opens
that process with query/synchronize rights only. It verifies the handle PID and
exact system conhost.exe image, repeats current window/owner and sole-membership
observations, then confirms that the retained object is still live. A missing
window, changed association, access failure or ambiguity fails closed. No
historical parent-process lifetime is claimed or used.

The helper then calls `FreeConsole` and waits at most 1,000 ms for natural exit
of the SAME retained host object, followed by native helper console absence.
It never calls `TerminateProcess` on a host. A client joining after the last
membership observation cannot authorize termination of that client's console;
a host that remains alive instead produces silent exit 22. All native handles
and the fixed four-byte membership buffer are released. This replaces the old
numeric-parent Toolhelp assumption under the final engineering authorization;
the higher-level attribution, quiescence and resource requirements are unchanged.

Every valid frame, including an ERROR frame, is emitted only after this startup
console proof. A proof failure exits 22 without a frame or diagnostic. The
supervisor still must confirm helper termination and complete transport EOF.
Failure before a validated frame cannot assert console quiescence and remains
terminal. Bounded external observation records any remaining owned process;
no next phase is admitted from an unconfirmed cleanup observation.
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
automatic retry. The helper must establish sole-helper membership and successful self-detachment, then its
process and all transports must close before any next helper or evaluation worker.
The headless path does not claim termination of an unidentified console host. One
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

Each helper has the prospective `PROSPECTIVE_HELPER_BOUND@1.0.0` whole-lifecycle
bound of 8,000 ms. Success requires completion strictly before 8,000 ms;
equality or later is TIMEOUT. The independent **20,000 ms aggregate helper-active
ceiling** remains unchanged. Active
time starts before launch and includes startup, native work, framing/EOF waits
and confirmed helper termination, prior self-detachment and transport closure. The CLI's 30,000 ms deadline remains
absolute for helper acquisition and final rename admission; each helper deadline is the earliest of its own eight seconds, remaining
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

Every path admitted to native chain acquisition is lexically checked once at
the closed request boundary: a root passes `Assert-Root`; a file path also passes
`Assert-Relative` and the combined-length bound; inspection derives only a
shorter parent or appends the fixed pending name under its existing bound.
`Open-Chain` therefore consumes only those already checked, request-local paths
and does not repeat the pure normalization and segment scan. All native opens,
initial identities, held-handle rechecks, fresh reopens, final-path comparisons
and seven-field equality checks remain fresh and unchanged.

The [N15 native absence correction](../../../docs/mo1307-n15-correction.md)
emits `CreateFileW` with one authoritative `DllImportAttribute` on `DefineMethod`,
so its `SetLastError=true` takes effect on Windows PowerShell 5.1. The fixed
entry point, Unicode/Winapi signature and safe-handle return are retained;
the declared exact-spelling flag now takes effect. The other native bindings
and all boundary predicates are unchanged.

Native absence admits only `ERROR_FILE_NOT_FOUND` for the exact leaf beneath
an already checked parent chain. Missing ancestors, access denial, sharing
failures and ambiguous native failures never become absence. Existing output
or final destinations produce a closed error; the supervisor maps publication
errors to OUTPUT. No identity is invented for an absent file/directory.

The fixed hidden PowerShell launch retains `detached: false`, `shell: false` and
three redirected binary pipes. The fixed executable, argv, package cwd and two
trusted environment entries remain unchanged. The supervisor retains the child
reference, process-exit checks, complete transport settlement, cancellation and
fixed deadlines. No host exit is inferred from the launch mode.

The [scoped headless cleanup correction](../../../docs/mo1307-headless-cleanup-correction.md),
as prospectively amended by the [final headless correction addendum](../../../docs/mo1307-final-headless-correction-addendum.md),
replaces the prior mandatory host-attribution/termination predicate for this
supported path. Startup saves all three standard streams and requires non-null,
readable stdin and writable stdout/stderr. Fixed `GetStdHandle` selectors and
`GetFileType` require three actual pipe handles; borrowed standard handles are
not independently closed or promoted to host authority.

Bounded `GetConsoleProcessList` checking requires exactly one client whose PID
is the helper itself. Initial count zero always fails closed, including error 6;
no error value proves successful absence. Extra clients, overflow, unrelated
membership and API failures reject. Membership is topology evidence only.
`FreeConsole` must successfully detach only the helper. Its success establishes
that detachment transition; there is no second membership query or post-detach
error predicate. No subsequent console allocation, attachment or console-creating
fallback is permitted. The fixed four-byte buffer is always released. No HWND, numeric ancestry, guessed
PID, process-handle lookup or host termination is used. No host process is opened,
waited on or terminated. The former 1,000 ms host-wait limit is inapplicable
without an identified host; no replacement wait or larger allowance is added.

Every valid response, including an ERROR frame, follows the startup pipe,
sole-helper membership and successful self-detachment checks. The unchanged supervisor then
requires helper process termination, stdin finish/closure, stdout/stderr EOF
and closure, no active helper role, and no helper/helper or helper/worker overlap
before a transition. All of this remains inside the existing helper/aggregate/
overall bounds; terminal cleanup remains at most 2,000 ms and is never success
grace. A response alone never admits the next operation.

This establishes bounded quiescence of the helper and its owned transports; it
does not claim that an unidentified conhost process terminated. A client joining
after an observed membership check cannot authorize any destructive host action.
The existing optional-host/process ceiling still requires native certification.
Actual startup-security failures remain silent exit 22 with no response frame or
diagnostic. A missing valid frame cannot establish the startup proof or permit
retry/transition. No debug output, wire/schema change or extra capability exists.

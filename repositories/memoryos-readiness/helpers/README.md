# Fixed Windows helper foundation

`windows-inspect.ps1` is the same fixed Windows PowerShell 5.1 helper. The
[authoritative Phase 2C publication inspection correction](../../../docs/mo1307-phase2c-publication-inspection-correction.md)
updates its private protocol to `2.0.0` and represents the native observations
missing from the original four-slot foundation. The script remains fail-closed:
valid requests return `ERROR/MO1307_INTERNAL` until separately authorized Phase
2C implements checked native handles. It does not fabricate successful native
inspection, acquire product inputs, write files or perform publication.

The trusted caller uses the installation's verified absolute Windows directory
followed by `System32/WindowsPowerShell/v1.0/powershell.exe`, with fixed
`-NoLogo -NoProfile -NonInteractive -File <absolute-packaged-script>` arguments.
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
Actual native process enforcement and the worker budget belong to resumed 2C.

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

Engineering native tests may add the fixed process-only `-ExecutionPolicy Bypass`
option under the retained Phase 1 harness policy. This changes no persistent
machine, user or enterprise policy and introduces no product launch override.
Synthetic protocol/identity tests are foundation tests, not native acquisition,
topology or installed-execution certification. Full orchestration remains
outside this correction task.

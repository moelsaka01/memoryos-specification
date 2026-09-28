# MO-1307 Phase 2C publication inspection correction

This is the authoritative, targeted correction to [Contract Freeze 1](mo1307-contract-freeze-1.md) sections 3, 17, 18 and 19. It resolves the demonstrated native publication-inspection interface defect. All other Freeze semantics remain in force. The readiness contract, profiles, records, result bytes, errors and public interfaces retain version `1.0.0`; only the private helper wire protocol becomes `2.0.0`.

The implementation baseline is clean `main` at B1 `3883ca889911fcc5a6f46c24e569478a8c32648e`, subject `conformance(memoryos-1.3): bind MO-1307 phase 1 foundation`. Its parent is I1 `7aa5ede6ec52b36d0428273d78c8ca7aa37a39ee`, whose parent is Freeze `e0cb8e9cc6aa73e26945db30756a6667a8d9e322`. Correction implementation and conformance identities are bound separately after their commits exist; this document embeds no future/self commit.

## Original rule, blocker and retained history

Original Freeze section 17 allowed at most four helper requests per CLI invocation: config/authority, candidate/manifest, manifest files, then result/decision for verify or `CHECK_OUTPUT` for evaluate. The Phase 1 script consumed exactly one length-prefixed frame and EOF per process invocation. Successful `CHECK_OUTPUT` returned `ABSENT`, zero files and one `output-parent` identity. No fifth request, additional response frame, retry or post-creation inspection channel existed.

The Phase 1 publication primitive nevertheless required complete native chains before output-directory creation, after creation, before pending creation, after pending creation, and for root and pending again before finalization. An absent output has no identity; its parent cannot attest to objects created later. The private immutable-root precondition does not remove those checks. Node `stat`/`lstat` cannot replace the complete native reparse/handle policy.

The stopped worktree `C:\Users\melsa\Documents\Codex\cca-mo1307-2c` remains read-only historical evidence. These five uncommitted artifacts retain their exact original bytes and stopped disposition:

- `docs/mo1307-phase2c-acquisition-publication.md`;
- `repositories/cca-conformance/evidence/mo1307/phase2c/blocker-campaign.json`;
- `repositories/cca-conformance/evidence/mo1307/phase2c/blocker-receipt.json`;
- `repositories/cca-conformance/evidence/mo1307/phase2c/final-checks.json`;
- `repositories/cca-conformance/tools/mo1307-phase2c/blocker-probe.mjs`.

Its 12 contract probes reproduced the insufficiency with explicitly synthetic identities. It is **STOPPED / CONTRACT_INTERFACE_BLOCKER / NOT_PHASE2C_COMPLETE**; the correction does not turn that attempt into PASS. Correction evidence independently binds and reproduces the original defect under [phase2c-correction](../repositories/cca-conformance/evidence/mo1307/phase2c-correction).

## Alternatives and selected architecture

| Class | Decision and reason |
|---|---|
| A: extend capabilities of the same fixed helper | Selected: fresh, serial invocations of the existing fixed PowerShell helper provide the missing post-worker observations. Each invocation still accepts one request frame followed by EOF and returns one response frame followed by EOF. |
| B: persistent multi-operation publication exchange | Rejected: interactive turn-taking changes lifetime, EOF and framing authority without improving identity guarantees. Keeping an acquisition helper alive during evaluation would also violate no-overlap. |
| C: redefine the four acquisition slots | Rejected: all four existing checks remain necessary in their original order. An absence-only slot cannot observe causally later created objects; combining bootstrap reads would weaken validated path selection. |
| D: additional native component | Rejected: the same-helper model is coherent. A second native implementation would add acquisition and supply-chain authority without being needed. |

The smallest correction preserves the four pre-worker slots and adds five publication requests. Final root and pending inspection share one complete pending chain because that chain contains the entire root chain. This explicit coalescing retains every identity comparison. There is no arbitrary inspection RPC, directory discovery, new input root, additional executable or helper filesystem write.

## Exact request lifecycle and counts

Every request has its own fresh invocation of the **same fixed packaged PowerShell script**. One invocation receives exactly one request frame, stdin EOF, and produces exactly one response frame and stdout EOF. A valid response alone is not completion: the helper and its attributable console host must be confirmed terminated, with bounded transport fully closed, before another helper or an evaluation worker starts.

| Global sequence | Command | Operation | Required timing and successful observation |
|---|---|---|---|
| 1 | both | `READ_SET` | Before worker: authority/config snapshots under input-root, original sorted IDs and caps. |
| 2 | both | `READ_SET` | Before worker: candidate/manifest paths learned only from validated config, original caps. |
| 3 | both | `READ_SET` | Before worker: exact manifest allowlist in ID order, at most 128 paths and unchanged decoded caps. |
| 4 | evaluate | `CHECK_OUTPUT` | Before worker: output absent; complete drive-through-parent chain. |
| 4 | verify | `READ_SET` | Before worker: fixed result under result-root and optional decision under input-root, original caps. |
| 5 | evaluate only | `CHECK_OUTPUT` | After worker termination, immediately before exclusive mkdir: output still absent; complete parent chain stable against slot 4. |
| 6 | evaluate only | `INSPECT_OUTPUT_ROOT` | After exclusive mkdir: complete drive-through-created-output chain; parent prefix stable against slot 5. |
| 7 | evaluate only | `CHECK_STAGE_ROOT` | Before exclusive pending creation: complete output chain stable against slot 6. |
| 8 | evaluate only | `INSPECT_PENDING` | After pending write, flush, exact-byte verification and close: complete drive-through-pending chain; root prefix stable and pending byte length exact. |
| 9 | evaluate only | `CHECK_FINALIZATION` | After final exact-byte reread and handle close: full pending chain stable against slot 8, including root; native fixed final destination absence. |

A successful evaluate uses **nine invocations, one request per invocation, nine requests total**. A successful verify uses **four invocations, one request per invocation, four requests total**. Failure can stop earlier; it cannot skip, repeat or replace a slot. No automatic retry, second worker, open-ended request loop, tenth evaluate request or fifth verify request is permitted. Slots 1–4 retain their acquisition/validation phase ordering. Only evaluate may enter slots 5–9 after its sole worker is confirmed terminated.

## Closed wire protocol 2.0.0

The request and response retain their kinds and add a required `session`. Exact closed shapes are:

```text
Request = {
 kind:"MemoryOSReadinessHelperRequest",version:"2.0.0",
 session:Session,sequence:Integer,operation:Operation,
 roots:[{id,path}],files:[{id,maxBytes,path,root}]
}
Response = {
 kind:"MemoryOSReadinessHelperResponse",version:"2.0.0",
 session:Session,sequence:Integer,operation:Operation,
 status:"OK"|"ABSENT"|"FINAL_ABSENT"|"ERROR",code:null|HelperError,
 roots:[ReadRoot|InspectionRoot],files:[{id,identity,bytes}]
}
Session = exactly 64 lowercase hexadecimal characters
ReadRoot = {id,identity:Identity}
InspectionRoot = {id,chain:[Identity]}
Operation = READ_SET|CHECK_OUTPUT|INSPECT_OUTPUT_ROOT|CHECK_STAGE_ROOT|
            INSPECT_PENDING|CHECK_FINALIZATION
HelperError = MO1307_INPUT|MO1307_FILESYSTEM_BOUNDARY|
              MO1307_RESOURCE_LIMIT|MO1307_INTERNAL
Identity = {attributes,byteLength,fileId,finalPath,isDirectory,linkCount,volumeSerial}
```

The trusted wrapper creates a fresh session from 32 cryptographically random bytes for each CLI assessment and keeps it fixed across acquisition and publication. It is an operational correlation value, never normative readiness input, a credential, a filesystem capability by itself or proof that a helper ran. The trusted launch and byte-transport boundary supplies native observation authority. A response must exactly echo session, global sequence and operation; prior-session, prior-slot and late responses are rejected. Semantic result/proof identities do not contain this session.

`READ_SET` retains its exact Phase 1 root/file records, path rules, per-slot file selection, decoded bounds and base64 chunks of at most 4096 characters. Output-root is not a permitted `READ_SET` root. Its successful response is `OK`, with exact root/file identities and snapshots. No acquisition arrays acquire implicit paths or new sources.

Every inspection request uses `roots:[{id:"output",path:capturedOutputRoot}]` and `files:[]`. The root is captured once from the validated evaluate launch; publication callers cannot substitute it. Pending and final names are compiled constants, respectively `memoryos-readiness-result.json.pending` and `memoryos-readiness-result.json`; neither appears as a caller-selected wire path.

| Operation / slots | Successful status | Exact response roots | Response files |
|---|---|---|---|
| `CHECK_OUTPUT` / 4,5 | `ABSENT` | `[{id:"output-parent",chain:completeParentChain}]` | `[]` |
| `INSPECT_OUTPUT_ROOT` / 6 | `OK` | `[{id:"output",chain:completeOutputChain}]` | `[]` |
| `CHECK_STAGE_ROOT` / 7 | `OK` | `[{id:"output",chain:completeOutputChain}]` | `[]` |
| `INSPECT_PENDING` / 8 | `OK` | `[{id:"pending",chain:completePendingChain}]` | `[]` |
| `CHECK_FINALIZATION` / 9 | `FINAL_ABSENT` | `[{id:"pending",chain:completePendingChain}]` | `[]` |

Success has `code:null`. An `ERROR` has one listed HelperError and empty roots/files, never partial identities or diagnostic paths. The wrapper maps an existing destination discovered by slot 4 to OUTPUT, preserving Freeze section 19 even though that check occurs before the worker. Inspection failures during publication map to OUTPUT; TIMEOUT/CANCELLED remain the wrapper's terminal operational categories. No new public error or exit is introduced.

Frames remain four-byte unsigned big-endian body length followed by exactly J body bytes, including the single LF. Request/response ceilings **include the prefix** and remain 65,536 / 16,777,216 bytes. Unknown fields/operations/versions, duplicate keys, noncanonical bodies, wrong sequence/session/status, truncated frames, extra frames, trailing bytes, debug text and unbounded stderr fail closed. Wire 1.0.0 is not an accepted compatibility fallback. Each chain has at most **120 identities**, a conservative bound derived from the unchanged 240-code-unit path ceiling; it must still contain exactly the components required by the actual path, with no omission, surplus or truncation.

## Native observations and trust boundary

Identity fields and policy are unchanged. Complete chains run in order from the local drive root through every ancestor to the requested parent, output directory or pending file. All non-leaf components and output roots are ordinary directories. Pending is an ordinary regular file with linkCount exactly 1. Every component is checked for all Windows reparse types, exact final handle path, native file/volume identity, attributes, type and relevant byte length. Native checks before/after an operation must establish stability. The helper closes its handles before successful exit; the supervisor never retains an asserted live native handle after process termination.

`CHECK_OUTPUT` proves only output-leaf absence under a successfully checked existing parent chain. `CHECK_FINALIZATION` proves only final-leaf absence under the successfully checked output/pending chain. A missing ancestor, access denial, ambiguous error, reparse point or changed identity is failure, never an absence assertion. Neither absence observation invents an identity for the absent path.

Cross-slot comparisons are mandatory: slot 4 parent equals slot 5 parent; slot 6 parent prefix equals slot 5; slot 7 equals slot 6; slot 8 root prefix equals the admitted root chain and its leaf byte length equals staged bytes; slot 9 equals the entire slot 8 pending chain. All seven Identity fields participate in exact stability comparisons. The native helper must enforce each observation internally, and the bridge/publication primitive must enforce these cross-response bindings.

Roots remain private and immutable to concurrent adversarial namespace mutation for the whole invocation. The checks detect observed changes; they are not an OS sandbox against a privileged attacker. Native final absence followed by same-directory Node rename retains the existing nonreplacement guarantee **under that precondition**. It does not claim a kernel no-replace syscall against an excluded concurrent attacker. Node handle reads can verify exact staged content but cannot supply or replace native identity/absence observations.

## Branded sequence, inspection capability and publication token

`createHelperSequence(command,{session,now?})` creates private branded admission state with methods `begin`, `complete`, `helperExited`, `beginWorker`, `endWorker`, `checkpoint` and `abort`. `begin` reserves exactly the next permitted slot. A validation, overlap, wrong-phase or retry attempt terminally invalidates the sequence. `complete` accepts only the single matching bounded response; it does not permit another launch until `helperExited` acknowledges confirmed process/console/transport quiescence. An error response or invalid completion is terminal. `beginWorker` requires all four acquisition slots completed and quiescent; `endWorker` acknowledges actual worker termination. Calling these methods is an internal trusted orchestration obligation, not independent proof of OS process state. The optional `now` is a trusted internal supervisor/test monotonic-clock seam; decreasing/nonfinite observations reject. It is not a public override, semantic input or way to extend the launch deadline. The sequence and inspection bridge call the same deadline checkpoint on admissions/transitions. Actual child/worker preemption remains resumed 2C's responsibility.

`createPublicationInspection(sequence,root,{exchange,checkpoint})` accepts only that branded evaluate sequence after worker termination and binds the validated root and session. It produces one private, branded, single-use inspection capability. `checkpoint` is mandatory and synchronous; it enforces the wrapper's current absolute deadlines and cancellation. `exchange` is the narrowly trusted fixed-helper byte transport: it receives the already-encoded next request and returns exactly `{responseBytes,exitConfirmed:true}` only after matching native invocation, bounded EOF and confirmed helper/console termination. It cannot select a command, script, root, path or operation, fabricate identities, substitute Node stat, or acknowledge an unconfirmed exit. Transport failure terminally aborts the sequence.

`createPublication(root,{inspection})` takes this capability instead of the previous unconstrained `inspect(root,relative)` identity callback. The inspection capability supplies the mandatory checkpoint; no separate publication checkpoint option exists. It rejects unbranded, already claimed, mismatched-root or substituted capabilities before filesystem mutation. `createPublication` consumes slots 5/6; `stagePublication(token,bytes)` consumes 7/8; `finalizePublication(token)` consumes 9 after its final exact-byte reread. The opaque publication token remains an unforgeable in-process identity backed by private state, bound to one capability, root, chain and detached byte snapshot. It is never serialized or sent to the helper. No caller-supplied token text, chain or callback can replace it. Tokens/capabilities cannot be reused across publications or assessments.

The correction defines admission, wire and publication seams only. The fixed script remains a fail-closed foundation until separately authorized Phase 2C supplies actual checked-handle acquisition. Synthetic test exchanges prove protocol/primitive behavior, not native authenticity. Full supervisor/worker/child orchestration remains resumed Phase 2C work.

## Publication, cancellation and commit point

The required evaluate order is: acquire slots 1–4 and terminate each helper; run and terminate the sole evaluation worker; perform slot 5; exclusively create the new output directory; perform slot 6; perform slot 7; exclusively create the fixed pending file; write bounded detached result bytes, flush, verify exact complete bytes and close; perform slot 8; reread and verify exact pending bytes and close; perform slot 9; checkpoint; rename pending to final exactly once.

The checkpoint runs before and after each inspection and before filesystem mutations, including mkdir, pending creation/write and final rename. Cancellation/deadline observed after creation or staging terminates further work and retains any owned directory/pending bytes. No retry, recursive cleanup, partial normative result, completion marker, second file, overwrite or alternate output basename is allowed. A failed finalization consumes the token. Before rename, cancellation/deadline suppresses publication; no late helper response can revive it.

Final rename remains the sole commit point. A successful rename commits the complete file. Later abort, deadline or stdout failure returns OUTPUT with the committed file retained; it cannot retract or delete that file. Only a fully written summary ending LF is success. Verify has no publication capability, output directory, pending file or rename: after its four acquisition requests and worker it compares exact recomputation, optionally checks the external decision and writes only stdout.

## Deadlines and process topology

The existing limits remain: API 10,000 ms from public entry, CLI 30,000 ms from trusted entry, evaluation sub-budget 10,000 ms within remaining CLI time, each helper invocation 5,000 ms, and failed-call cleanup 2,000 ms with no success grace. The byte-only public API launches no Windows helper and performs no filesystem publication.

This correction explicitly adds **20,000 ms aggregate helper-active elapsed time per CLI assessment**. It preserves the original four-request upper bound of 4 × 5,000 ms rather than silently allowing nine fresh five-second budgets. This is a new explicit aggregate check, not a claim that Phase 1 previously implemented it. Active elapsed time includes process startup, native work, input/output/EOF waits and confirmed helper/console termination. It excludes time between invocations when all helper processes are gone, including evaluation-worker time. That excluded time remains charged to the unchanged overall CLI deadline.

Let `S` be invocation start, `used` the accumulated duration of fully terminated prior helpers, and `D` the absolute CLI deadline. Its effective absolute deadline is `min(D, S+5000, S+(20000-used))`. Require positive remaining budget before launch and completion strictly before every applicable deadline; equality is TIMEOUT. The active timer starts before child launch and settles only at confirmed quiescence. No slot or new phase resets accumulated use. A per-helper or aggregate expiry is terminal TIMEOUT even if CLI time remains; pending cleanup cannot admit a response or publish.

The supervisor uses monotonic clocks and external timer enforcement; pure evaluation remains clock-free. TIMEOUT wins when abort and expiration are first observed at the same checkpoint with now at/after deadline; an abort already observed strictly earlier remains CANCELLED. Cleanup may last at most 2,000 ms after failure and never permits another helper, worker or publication; overall failed elapsed time remains bounded by CLI 32,000 / API 12,000 ms. Late output is ignored.

At any instant there is one supervisor and at most one active fixed helper plus its possible console host: at most three attributable OS roles. Evaluation is one worker **thread**, never another process. No helper or helper console host overlaps the worker or another helper invocation. New launches wait for confirmed quiescence; receiving a frame or only an early child-exit event is insufficient. Engineering observers are excluded from product-role counts and are not product dependencies.

## Exact limit and compatibility impact

| Item | Original | Corrected |
|---|---|---|
| Private wire version | 1.0.0 | 2.0.0, required session and inspection-chain records |
| Evaluate helper request/invocation bound | 4 | 9, each one request/frame |
| Verify helper request/invocation bound | 4 | 4, each one request/frame |
| Pre-worker acquisition requests | 4 | 4 |
| Post-worker publication requests | none representable | exactly 5 on successful evaluate |
| Per-helper deadline | 5,000 ms | unchanged |
| Aggregate helper-active deadline | implicit upper bound 4 × 5,000 ms | explicit 20,000 ms ceiling |
| Inspection-chain cardinality | no representable chain | at most 120; exact path-derived length required |
| Request/response byte ceilings | 65,536 / 16,777,216 | unchanged |
| Identity fields and path ceilings | existing seven fields; 180/240 | unchanged |
| API/CLI/cleanup/heap/RSS limits | frozen values | unchanged |

No readiness state, gate, profile, provider, normalized claim, result, proof, human-decision, tag, trust-root, grant, DAG, reuse, staleness or history predicate changes. Tags remain authorized supplied observations. Product Git subprocesses, fetch/push/tag mutation, network, credentials, provider accounts, Linux/Ubuntu/WSL and VM use remain excluded.

2A commit `b628349b4e678a8f71086b1b5c807ffe2edf9a5d` owns pure readiness computation. 2B commit `b2877ab32c317bb67896414ba9cec64f6f436ca5` owns pure evidence/authority/graph verification. The mechanical [compatibility matrix](../repositories/cca-conformance/evidence/mo1307/phase2c-correction/compatibility/attempt2/matrix.json) classifies both **UNCHANGED_REUSABLE**: 2A passes 84 tests and 16 exact committed vectors; 2B passes 172 tests and 16 exact committed vectors against corrected shared foundation. Their semantic ownership and worktrees remain unchanged. The accepted 2B raw-source-lineage fixture correction remains owned by its existing commit and is not reversed or transplanted into the original historical Phase 1 receipt. These are isolated compatibility checks, not Phase 2D integration or refreshed native certification.

Shared integration must refresh helper/publication foundation and package bindings once, using corrected constants and script bytes. Old wire clients and arbitrary inspect hooks require migration to the new branded sequence/capability. Historical Phase 1 reports, requirements, inventories and acceptance/characterization receipts describe B1 and remain unchanged; their original four-slot statement is explicitly superseded for future execution by this correction. No historical PASS becomes native nine-invocation certification.

## Security and validation obligations

| Threat | Closed control and required negative vector |
|---|---|
| Extra helper authority / request smuggling | Six fixed operations, exact slot mapping, one frame/EOF, fixed output basenames; reject unknown operation/field, extra frame and trailing bytes. |
| Wrong sequence / retry / overlap | Branded terminal state, one outstanding request, exit acknowledgement before transitions; reject skipped/repeated/extra requests, worker overlap and unconfirmed exit. |
| Cross-invocation confusion / late response | Exact session, sequence and operation echo plus current phase/deadline; reject wrong-session and old-slot responses, including otherwise valid identities. |
| Stale identity / path substitution | Exact complete chain and all-field cross-slot equality; reject omitted ancestors, wrong root/leaf, changed identity and reused prior-operation responses. |
| Token/capability substitution | Private branding, single claim, root/session binding and single-use staging/finalization; reject arbitrary object, mismatched root, second claim and concurrent/repeated use. |
| Reparse / hardlink / wrong type | Existing native component policy and unchanged Identity validation; reject each policy violation in every represented chain. |
| Overwrite / TOCTOU | Exclusive mkdir/pending create, native final absence and stable chain, fixed names, private immutable-root precondition; reject existing final and changed pending/root without deleting evidence. |
| Cancellation / deadline race | Mandatory checkpoints and absolute per-call/per-helper/aggregate deadlines, equality rejection, terminal abort; reject late responses and precommit publication after expiry/abort, retain committed output on postcommit transport failure. |

Focused correction tests reproduce the old blocker, represent all required observations, exercise complete evaluate/verify sequences and every listed negative class, and retain failed development attempts. A complete affected Phase 1 regression validates unchanged contracts, schemas, fixture bytes, public guards, package integrity and workspace checks. Phase 1 characterization measured zero helpers; its unchanged pure workload evidence does not establish native helper startup/inspection timing. Only bounded affected protocol/startup characterization is appropriate here if its dependencies change; complete native identity, process and deadline acceptance remains resumed 2C's responsibility.

The correction evidence contains baseline, old-blocker reproduction, old/new protocol matrix, focused/security test receipts, Phase 1 regression, 2A/2B compatibility, changed-file inventory and binding plan. C2C has parent exactly B1 and subject `fix(memoryos-1.3): correct MO-1307 publication inspection contract`. Its binding-only child C2CB has subject `conformance(memoryos-1.3): bind MO-1307 publication inspection correction`. C2CB contains no production changes and binds only existing C2C artifacts. Package, graph, binding, whitespace, preserved blocker and clean-main checks must succeed after C2CB. No push or tag is authorized.

## Exact resumed-2C authority

After successful binding, the only authorized baseline for a separately requested resumed Phase 2C is the exact **C2CB commit identified and verified by the correction binding graph/record**, not B1, a moving branch name or the stopped worktree. The final correction report supplies that existing hash. Until it exists and its checks pass, resumption authority is prospective.

The next task may implement the corrected fixed-helper native inspections, trusted transport, supervisor/worker lifecycle, operational deadlines/cancellation and single-file publication against unchanged 2A/2B semantic seams; it must execute the required native Windows acceptance and affected regression. This correction task does not resume 2C, create a continuation branch/worktree, implement full orchestration, begin 2D or authorize a release. The original stopped worktree remains historical/read-only until the user separately authorizes a continuation.

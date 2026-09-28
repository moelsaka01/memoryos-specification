# MO-1307 Phase 2D integrated readiness implementation

This report describes the integration of the accepted readiness computation,
evidence authority and corrected Windows runtime on main. The governing
authorities are [Contract Freeze 1](mo1307-contract-freeze-1.md), the
[publication inspection correction](mo1307-phase2c-publication-inspection-correction.md)
and the [finalization boundary correction](mo1307-phase2c-finalization-boundary-correction.md).
Only their explicitly identified clauses supersede earlier wording. The
[Phase 2D evidence directory](../repositories/cca-conformance/evidence/mo1307/phase2d)
contains the actual source gates, inventories, reconciliation and execution
receipts. This report does not replace those byte-bound records or claim
Phase 3 certification, release approval or permission to tag.

## Source gates and reconciliation

Main began clean at C2FB `08de262d1ef3149b6e540bcaea0cf910e02732bd`, subject
`conformance(memoryos-1.3): bind MO-1307 finalization correction`. All source
worktrees were read-only. Exact commit, sole parent, subject, clean status and
accepted evidence were checked before source import.

| Stream | Accepted commit | Sole parent | Changed paths |
|---|---|---|---:|
| 2A readiness core | `b628349b4e678a8f71086b1b5c807ffe2edf9a5d` | B1 `3883ca889911fcc5a6f46c24e569478a8c32648e` | 82 |
| 2B evidence authority | `b2877ab32c317bb67896414ba9cec64f6f436ca5` | B1 `3883ca889911fcc5a6f46c24e569478a8c32648e` | 78 |
| 2C corrected acquisition/publication | `24a9ed13072cf344baf56ee019d96520b7dfd4f0` | C2FB `08de262d1ef3149b6e540bcaea0cf910e02732bd` | 1803 |

The [2A source gate](../repositories/cca-conformance/evidence/mo1307/phase2d/source-gate-2a.json),
[2B source gate](../repositories/cca-conformance/evidence/mo1307/phase2d/source-gate-2b.json)
and [2C source gate](../repositories/cca-conformance/evidence/mo1307/phase2d/source-gate-2c.json)
each record PASS. Inventories classify every source path as production,
schema/contract, test, fixture, package metadata, evidence, documentation or
engineering-only. Each pairwise intersection and the three-way intersection
contain exactly four paths. The
[overlap matrix](../repositories/cca-conformance/evidence/mo1307/phase2d/overlap-matrix.json)
records source and base bytes; the import/reconciliation record owns final
decisions. No merge, cherry-pick, branch-order selection or blanket ours/theirs
resolution is used.

| Shared path | Classification | Required resolution |
|---|---|---|
| `repositories/cca-conformance/tools/mo1307-phase1/package.mjs` | Shared-interface reconciliation | Preserve checker behavior and union the exact reviewed private source additions. |
| `repositories/memoryos-readiness/package.json` | Generated-metadata conflict | Regenerate the exact allowlist for the reconciled closure; retain version, exports and dependency policy. |
| `repositories/memoryos-readiness/sbom.spdx.json` | Generated-metadata conflict | Regenerate once from final package bytes with the existing recursion exclusions. |
| `repositories/memoryos-readiness/distribution-manifest.json` | Generated-metadata conflict | Regenerate after the SBOM and bind every other shipped member. |

No cross-stream production path conflict changes accepted semantic authority.
The 2B-owned shared foundation changes are adopted once: precise reference and
byte admission, frozen phase/error priority and history/qualification mismatch
mapping remain backed by unchanged closed schema validation. Neither another
branch's older foundation nor a weaker integration-specific verifier replaces
them.
All 16 readiness identities remain exactly those accepted by 2A. Fifteen
complete results/proof identities also remain exact. The MO-1306 fixture adopts
the already accepted 2B raw-source-lineage correction: its raw pins, audit and
proof identity change while its entire assessment and readiness identity remain
unchanged. Historical 2A vector bytes are preserved as historical acceptance,
not overwritten to conceal this explicitly accepted correction.

Original blocked 2C `CONTRACT_INTERFACE_BLOCKER`, resumed `ENVIRONMENT_BLOCKER`
and `CONTRACT_DEFECT` records, correction evidence and failed development
attempts remain historical evidence. A later successful check does not relabel
an earlier failed receipt. The accepted 2C runtime/publication receipt retains
its original 123/124 failure; the separately accepted seven-case publication-wait
rerun supersedes only the diagnosed floating-point harness assertion. It does
not rewrite that receipt or claim the old execution was 124/124.

## Production architecture and boundaries

2B owns the trust root, raw sources, grants, candidate/dependency closure,
selective invalidation, staleness, explicit reuse, immutable history and
normative DAG. 2A owns profile applicability, all 22 gates, retained blockers,
CNE reasons, qualifications, providers, history projection, readiness identity
and canonical result construction. 2C owns trusted native acquisition, copied
byte snapshots, one supervised worker, deadlines/cancellation, publication and
bounded output. 2D connects these existing authorities through fixed imports.

Evaluation follows this sequence:

1. The byte API admits and copies bounded bytes and independent pins. The CLI
   first obtains the same snapshots through the fixed checked Windows helper.
2. Inside the fixed worker, actual 2B verification checks raw source bytes,
   claim/source/grant correspondence, independent trust and candidate pins,
   dependencies, reuse and history, then derives the closed acyclic DAG.
3. The fixed adapter passes exactly `candidate`, `candidateDigest`, `profile`,
   `stage`, `scopeId`, `authorityIdentityDigest`, `slots`, `claims`, `graph`,
   `graphDigest` and `audit` to actual 2A computation. Structural admission alone
   does not supply this verified projection.
4. 2A computes all gates and canonical assessment, readiness digest and the
   separate proof binding over readiness identity and verified raw audit.
5. The API returns detached result bytes and both digests. The CLI evaluates
   the requested projection, publishes the one result using the accepted
   lifecycle and emits the bounded summary/readiness exit.

Verification reacquires or copies the supplied authoritative inputs and
result, independently repeats 2B verification and 2A computation, checks exact
canonical result bytes and identities, and only then validates an optional
human decision. It returns a verify projection and CLI exit 0 for every valid
readiness state. Verify never creates or republishes a result.

The three fixed integration-pending stubs are replaced with static accepted
module imports. Callers cannot select an evaluator through input, environment
or paths. Engineering fixture projections and semantic workers remain confined
to explicitly scoped test tools, outside the shipped package. Defensive
INTERNAL errors for impossible private states, hostile launch state, malformed
worker messages and unsupported imports remain fail-closed checks. They are
not unimplemented successful paths.
The source-bound [final integration review](../repositories/cca-conformance/evidence/mo1307/phase2d/integration-review-final.json)
and [guard inventory](../repositories/cca-conformance/evidence/mo1307/phase2d/guard-inventory.json)
record the three removed stubs, two comment-only 2A status updates and every
remaining INTERNAL occurrence. The two 2A modules retain byte-identical
executable text after comment lines are excluded.

Integration review exposed one local error-priority defect: redundant structural
preflight could emit a provider EVALUATION qualification error before actual 2B
could report an earlier AUTHORITY grant error. The original
[before probe](../repositories/cca-conformance/evidence/mo1307/phase2d/development/phase-precedence/before.json)
and corrected [after probe](../repositories/cca-conformance/evidence/mo1307/phase2d/development/phase-precedence/after.json)
are retained. The adapter now defers only a typed EVALUATION failure to the
accepted 2B failure-only diagnosis and rethrows that original failure if 2B
could otherwise return. Earlier byte/admission failures and result/decision
caps still reject immediately. This restores accepted phase priority without
admitting rejected evidence or changing a normative rule. D24 carries the
integrated regression. The first review is preserved and explicitly superseded;
it did not detect this defect.

## Public API and CLI

The root exports exactly two async functions:

```text
evaluateReadiness({configurationBytes,candidateBytes,manifestBytes,
 authorityBytes,files,expectedCandidateDigest,trustedAuthorityDigest},
 {signal}?)

verifyReadiness({configurationBytes,candidateBytes,manifestBytes,
 authorityBytes,files,expectedCandidateDigest,trustedAuthorityDigest,
 resultBytes,decisionBytes:null|Uint8Array}, {signal}?)
```

All Bytes fields are bounded `Uint8Array` snapshots. `files` is the exact sorted
`[{id,bytes}]` manifest set. Inputs use closed own data properties; shared memory
and accessor-based authority are rejected. Evaluation returns
`{resultBytes,readinessDigest,proofBindingDigest}`; verification additionally
returns `decision:null|{decision,consistency,authenticity}`. The byte-only API
does not discover or read paths, launch a native helper, publish files or use
the network. Its fixed worker contains the actual integrated computation.

The CLI exposes only frozen `evaluate` and `verify` argument shapes, own-property
safe command dispatch and explicit ordinary local Windows roots. It introduces
no stdin authority, URL, server, watcher, queue, cache, arbitrary child command,
Git operation, provider account or environment-selected semantic behavior.
JSON and text are projections of the same verified result. Text is generated
only when requested, so a text-only output-size failure cannot invalidate a
complete API/JSON result.

Four readiness states remain exact: READY, READY_WITH_QUALIFICATIONS, NOT_READY
and COULD_NOT_EVALUATE, projecting to evaluate exits 0, 2, 3 and 4 respectively.
The profiles remain `rest@1.0.0` and `cicd@1.0.0`. Every assessment has 22 gate
records. Proven mandatory blockers take precedence over mandatory CNE, then
release-impacting qualifications, then READY. Optional NOT_REQUIRED and inactive
NOT_APPLICABLE retain their frozen meaning. Malformed, unsafe or unauthorized
inputs remain operational errors; integrity, authority, graph, filesystem,
deadline and cancellation errors cannot be converted into normative CNE.

APPROVE, REJECT and DEFER bind candidate, readiness and proof identities after
complete recomputation. Authenticity remains `NOT_VERIFIED_BY_MEMORYOS`; even
an APPROVE contrary to NOT_READY/CNE cannot change readiness. Metadata-only raw
changes can preserve readiness but change proof, requiring a new proof binding.
PRE_TAG_READINESS and POST_TAG_VERIFICATION evaluate supplied authorized tag
observations. There is no product Git process, fetch, push or tag mutation.

## Windows operations and irreversible publication

The private helper wire remains 2.0.0. Successful evaluate uses nine fresh,
serial, single-frame helper invocations and one intervening evaluation worker;
verify uses four invocations and one worker. There are no retries, helper/helper
overlap or helper/worker overlap. The supervisor, at most one helper and its
possible console host are the maximum three attributable OS process roles;
the evaluation worker is a thread. Session nonces, helper sequence numbers,
safe temporary paths and process observations are operational data and never
enter normative result bytes.

The fixed helper is launched from
`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe` with exactly the
reviewed `-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File`
arguments and packaged helper path. Only SystemRoot/WINDIR are passed. This is
the accepted process-scoped policy authorization, not a caller override or
persistent policy change. Checked complete native identity chains, cross-slot
stability, reparse/type/hardlink policy, UNC/device/ADS rejection and explicit
private immutable-root ownership remain intact.

| Limit | Preserved behavior |
|---|---|
| API | 10000 ms absolute monotonic deadline; failed cleanup at most 2000 ms. |
| CLI | 30000 ms admission deadline; worker sub-budget 10000 ms. |
| Helper | 5000 ms per invocation and 20000 ms aggregate active time, including launch through quiescent exit. |
| Ordinary failure | At most 2000 ms cleanup; no success grace or retry. |
| Submitted rename | Await that exact admitted non-cancellable operation until settlement; no universal finite CLI settlement bound. |
| Post-settlement | One shared 2000 ms read-only confirmation/disposition deadline, anchored immediately on observing settlement. |
| Worker heap | 128/16 MiB old/young limits; no hard aggregate OS RSS sandbox claim. |

Publication retains the branded inspection capability and single-use opaque
token. It exclusively creates the output directory and fixed pending file,
writes, flushes and rereads exact detached result bytes, obtains the prescribed
native chains and final-absence observation, then admits exactly one rename to
`memoryos-readiness-result.json`. Its private states are PRE_SUBMISSION,
COMMIT_IN_PROGRESS, COMMITTED and FAILED.

Before rename admission, deadline equality and cancellation prevent submission.
After admission they are recorded until the exact rename settles; no terminal
TIMEOUT/CANCELLED can be returned while that mutation is outstanding. Actual
rename success is the commit point. Read-only confirmation checks exact final
bytes and pending absence within the one shared disposition allowance. Late
commit, failed confirmation or failed rename yields OUTPUT/21 with no success
stdout, retaining the actual namespace and operational phase. Timely verified
commit may emit a complete summary under the original deadline. Later stdout
failure retains the committed final file. There is no retry, rollback, cleanup
of evidence namespaces, second rename or extra native helper.

Node Windows rename is not a kernel no-replace primitive against an excluded
privileged concurrent namespace attacker. Nonreplacement depends on the frozen
private immutable-root precondition and checked native absence/stability. The
retained availability risk is an admitted non-cancellable rename that never
settles. N24 permits only bounded invocation-owned timers that are disposed at
terminal completion; persistent timers remain forbidden.

## Package and validation evidence

The reconciled package remains private `memoryos-readiness@0.1.0`, semantic
contract `memoryos.readiness@1.0.0`, with only the two public exports, zero
external production npm dependencies and no lifecycle hooks. The explicit
89-member union includes all reviewed source, runtime entry, helper, contracts,
schemas and notices, and excludes fixtures, tests, evidence, validators, caches
and engineering doubles. The contract manifest still binds 53 members; no
schema, public version, error catalog or normative byte shape changes.
Distribution has 88 rows, excluding itself. SPDX has 87 file rows, excluding
itself and distribution metadata to avoid recursion. Final package checks bind
the generated metadata to actual final bytes, rather than concatenating branch
inventories. Exact receipt bindings own the final counts and hashes.

The supported runtime is separately provisioned Node 24.21.0 win-x64,
93,580,104 bytes, SHA-256
`ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32`.
Windows PowerShell 5.1 is fixed; npm 11.19.0 is engineering/install tooling.
Validation is offline on native Windows. No Linux/Ubuntu/WSL, VM, provider
account, hosted runner or external authority acquisition is added.

Fresh validation starts with syntax/import, shared schemas and overlap/package
structure before the expensive native cases. Accepted scope is recorded
separately: Phase 1 has 105 tests, 2A has 84, 2B has 172, and 2C has the 124-case
runtime/publication closure and separate 94-case surface closure. Publication
57, finalization 24 and publication waits 7 are components of the 124 closure;
inspection 24 and launch security 13 are components of the 94 closure. These
are not added again as independent totals. N24, native protocol and actual
queued-rename witnesses keep their own scoped receipts.

The final-source regression receipts record:

| Scope | Fresh result | Receipt |
|---|---|---|
| Syntax/import, schemas/fixtures and package structure | PASS | [cheap-attempt2](../repositories/cca-conformance/evidence/mo1307/phase2d/regressions/cheap-attempt2/receipt.json) |
| Phase 1 | 105/105 PASS | [phase1-attempt3](../repositories/cca-conformance/evidence/mo1307/phase2d/regressions/phase1-attempt3/receipt.json) |
| Accepted 2A | 84/84 PASS and 16 exact vectors | [phase2a-attempt2](../repositories/cca-conformance/evidence/mo1307/phase2d/regressions/phase2a-attempt2/receipt.json) |
| Accepted 2B | 172/172 PASS and 16 exact vectors | [phase2b-attempt2](../repositories/cca-conformance/evidence/mo1307/phase2d/regressions/phase2b-attempt2/receipt.json) |
| Accepted 2C | 219/219 PASS: 124 runtime/publication + 94 surfaces + one N24 lifetime case | [phase2c-attempt1](../repositories/cca-conformance/evidence/mo1307/phase2d/regressions/phase2c-attempt1/receipt.json) |
| New integrated semantics/security | 58/58 PASS, all 16 verified vectors and graph/decision/determinism/preservation matrices | [semantics/attempt-1](../repositories/cca-conformance/evidence/mo1307/phase2d/semantics/attempt-1/receipt.json) |
| Released MO-1306 public byte API | Evaluate and verify PASS through actual fixed workers; exact 303,620 result bytes, 22 gates, ten qualifications and consistent REJECT decision | [api/mo1306-attempt1](../repositories/cca-conformance/evidence/mo1307/phase2d/api/mo1306-attempt1/receipt.json) |
| Actual packaged native CLI and byte API parity | Five selected cases PASS: all four readiness states plus REST; each result independently verified, with READY repeated in a new process/output root | [native acceptance summary](../repositories/cca-conformance/evidence/mo1307/phase2d/native/summary.json) |
| Actual native integrated lifecycle | Three cases PASS; evaluate/verify/evaluate used 9/4/9 helper requests, one real worker each, confirmed quiescence and no role overlap; distinct sessions yielded identical normative bytes | [lifecycle-attempt1](../repositories/cca-conformance/evidence/mo1307/phase2d/native/lifecycle-attempt1/receipt.json) |
| Actual packaged native CLI security controls | Seven cases PASS: traversal, hardlink, junction, raw-source tamper, existing output, prototype command and launch override; no successful publication | [security-attempt1](../repositories/cca-conformance/evidence/mo1307/phase2d/native/security-attempt1/receipt.json) |

The first integrated Phase 1 attempt remains 103/105 FAIL. Its native sandbox
denials are retained; the authorized native rerun and later final-source rerun
have their own successful receipts. No historical failure is rewritten, and
earlier successful receipts made obsolete by the local precedence fix are not
used as the final-source acceptance rows above.

The first [native integration attempt](../repositories/cca-conformance/evidence/mo1307/phase2d/native/integration-attempt1/receipt.json)
retains completed READY and qualified cases followed by a NOT_READY-vector CLI
acquisition timeout after 9048.3877 ms: exit 29, zero stdout and no result
publication. The unchanged-source
[second attempt](../repositories/cca-conformance/evidence/mo1307/phase2d/native/integration-attempt2/receipt.json)
completed READY, qualified and NOT_READY cases, then the CNE-vector acquisition
timed out after 21437.3318 ms with the same operational exit and no success
stdout. Both parent campaigns remain FAIL. Their causes are undetermined;
this report does not attribute them to the environment or claim a capacity or
performance guarantee. The native summary selects the exact passing READY,
qualified and NOT_READY case receipts from the second failed campaign, plus
the separately passing CNE and REST campaigns. This establishes five explicit
successful cases, rather than a successful full six-case sweep. All selected
cases completed actual byte-API/CLI equality and independent verification.

MO-1306 native evaluation remains **NOT_ESTABLISHED**. The two focused attempts
also remain FAIL: their CLI evaluate durations were 8144.4563 ms and
8799.779 ms respectively, each ending with acquisition TIMEOUT/29 and zero
stdout. These figures are child CLI durations, not the enclosing campaign or
outer harness durations. Actual byte-API evaluation and its exact result,
readiness and proof assertions completed before the CLI call in each focused
attempt; API verification and CLI result verification were not reached there.
The later dedicated public byte-API receipt independently completed both
evaluation and verification through actual fixed workers in 3912.6769 ms,
with exact 303,620-byte result, readiness and proof identities. Its supplied
REJECT decision was CONSISTENT and remained NOT_VERIFIED_BY_MEMORYOS.
The separately passing 58-case integrated suite exercises the actual 2B-to-2A
MO-1306 semantic pipeline, retaining all 22 gates and ten disclosures. That
evidence is not a substitute for native MO-1306 success.

The one bounded unchanged-source
[native diagnostic](../repositories/cca-conformance/evidence/mo1307/phase2d/native/mo1306-diagnostic-attempt1/receipt.json)
and its [read-only analysis](../repositories/cca-conformance/evidence/mo1307/phase2d/diagnostic-analysis.json)
identify request 3, READ_SET of 65 manifest files totaling 2,004,208 bytes, as
the limiting slot. Its helper start event was 5301.7806 ms, deadline
10301.7191 ms and terminal TIMEOUT event 10307.151 ms on the recorded monotonic
clock. Completed helpers 1 and 2 had used 4557.2767 ms; the CLI deadline was
30411.6079 ms. Thus the five-second per-helper budget was limiting, rather than
the aggregate or overall deadline. No worker ran and no output root was created.
The specific inner helper cause remains undetermined.

That diagnostic records `cleanupConfirmed:false`, so helper/console quiescence
is not established by its receipt. A later
[PID observation](../repositories/cca-conformance/evidence/mo1307/phase2d/native/mo1306-diagnostic-attempt1/pid-observation.json)
found the observed helper PID absent; it does not establish historical or
console-host quiescence. The transport accepts a complete valid helper response
as proof of prior native console quiescence, and no request-3 response was
retained. The false proof flag neither proves a live process nor justifies a
cleanup-success claim. All five failed native parents are preserved: two full
campaigns, two focused MO-1306 attempts and this diagnostic. Phase 3A must
investigate the slot-3 timing and terminal cleanup proof under the unchanged
frozen budgets before any installed-runtime or release certification.

Phase 2D receipts record fresh integrated byte-API evaluation/verification,
actual native CLI evaluate/verify, CLI/API parity, repeated normative bytes,
security controls, graph checks, complete schemas/fixtures and package/workspace
validation. Earlier scoped engineering tests are not substituted for these
integrated executions. Historical PHASE2 fixture classification is a schema
layer label: semantic negatives must now also reject through actual integrated
verification, without weakening schemas to make every semantic negative
structurally invalid.

The MO-1306 integrated expectation is READY_WITH_QUALIFICATIONS, evaluate exit
2, 22 gates and all ten disclosures. Generic real execution stays certified;
GitHub hosted execution is not inferred; GitLab/Jenkins/Azure remain limited to
contract validation. All 19 raw history rows and 12 negative history projections
remain preserved. REST retains SAME_HOST_REMOTE_ONLY and its released authority.
READY, qualified, blocker and unavailable-condition vectors remain distinct;
verification of a valid result succeeds independently of its readiness state.

Determinism covers repeated sessions and safe operational/output paths with
identical authoritative bytes. Object-key insertion order and private
claim/slot collection order are nonsemantic. Public arrays specified as sorted
sets remain sorted; arbitrary manifest-array reversal is an input violation,
not a permitted alternative authority. Enumeration-order tests normalize those
sets before producing the identical canonical authoritative input.

Integrated security controls cover candidate/raw-source/claim/grant/trust-root
tamper; stale dependencies; history rewriting and qualification omission; false
provider promotion; graph cycle/dangling reference; profile/result/decision/tag
mismatch; path traversal and reparse/hardlinks; PowerShell substitution;
prototype command names; publication token/capability substitution; and false
timeout after rename admission. Each receipt distinguishes actual native checks
from synthetic boundary controls. The graph is bounded, candidate/authority
rooted, acyclic, closed and has exact dependencies without future/self-reference.
The [integrated security ledger](../repositories/cca-conformance/evidence/mo1307/phase2d/integrated-security.json)
maps those controls to scoped evidence and preserves the native MO-1306 and
cleanup-proof limitations.

Independent read-only review reconstructed the typed nodes and edges directly
from candidate components, accepted grants, claims and dependencies, separately
checked rooted reachability and acyclicity, and verified 343 raw manifest file
bindings. Across 16 separate fixture graphs it observed 955 nodes and 2493
edges; these sums are not one graph or a unique global-node count. MO-1306 has
164 nodes and 832 edges, including 127 dependency nodes and 17 grants/claims.
Its audit retains 65 manifest inputs: 45 SOURCE, 17 ENVELOPE and three
AUTHORITY_SOURCE records. Raw source lineage belongs to that exact
audit binding; the six frozen normative node types do not gain a SOURCE alias,
and normalized authority alone is not raw-source trust. Its 12 history
projections retain seven SUPERSEDED and five PRESERVED_WITH_QUALIFICATION rows.
The ten disclosures comprise five historical disclosures, three provider
not-live-certified limitations, one GitHub hosted limitation and one bounded
advisory disclosure.

Execution receipts and the final acceptance inventory own pass/fail counts and
source bindings. Development failures remain separately retained with their
diagnosis and bounded corrected rerun. No current report statement converts a
failed development attempt into a historical PASS.

## I2/B2 binding and Phase 3 plan

I2 is the single implementation child of C2FB, with subject
`feat(memoryos-1.3): integrate MO-1307 release readiness`. Its inventory and
evidence contain no future I2 hash. After I2 exists, the sole binding child B2
uses subject `conformance(memoryos-1.3): bind MO-1307 phase 2 integration` and
binds actual I2 commit/tree identities without production changes. Read-only
post-B2 checks must establish the graph/ancestry, exact tree/package/schema
bindings, Phase 1 and selected integrated regressions, actual native smoke,
workspace/diff checks and clean main before Phase 2 is declared complete.

Only after those B2 checks pass, recommend these separate later worktrees,
each initially rooted at the exact verified B2 commit:

| Proposed branch / worktree | Required scope |
|---|---|
| `codex/mo1307-phase3a-runtime` / `cca-mo1307-3a` | Native Windows 11 x64 installed runtime; readiness/decision/tag vectors; exact API/CLI bytes; offline execution; interruption and resource boundaries/characterization, including the retained 65-file MO-1306 slot-3 timeout and terminal console-cleanup proof under unchanged budgets. |
| `codex/mo1307-phase3b-package` / `cca-mo1307-3b` | Exact archive/member/distribution integrity; two independent assemblies; one offline install; SPDX 2.3 schema/semantic checks; complete runtime/engineering dependency, validator, schema, license, advisory, provenance and reproducibility accounting. |
| `codex/mo1307-phase3c-security` / `cca-mo1307-3c` | Security/trust/evidence-graph audit and negative corpus; dependency completeness; forged claims/false approval; preserved history/qualifications; filesystem/network/process/log/secret boundaries; release-claim review. |

The three streams may run independently only after their distinct inputs and
ownership are bound. Later 3D integrates exact accepted 3A/B/C evidence and all
failed attempts/dispositions, reconciles changed dependencies, audits final
gates/vectors/graph/package identity and produces non-self-referential I3/BF
binding for a subsequent human tag review. Its integration branch recommendation
is `codex/mo1307-phase3d-certification` / `cca-mo1307-3d`, created only by that
later authorized task with the exact accepted input identities.

No Phase 3 branch/worktree is created here. No push, tag, provider campaign or
claim of hosted certification is authorized by this integration. The next task
is to start the separately scoped 3A, 3B and 3C certification work from verified
B2, retaining every qualification and failed-history disclosure.

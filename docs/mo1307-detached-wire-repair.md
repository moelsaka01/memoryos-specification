# MO-1307 detached-launch wire repair

Status: **PHASE3A_CONCRETE_IMPLEMENTATION_BLOCKER**. The one mandatory production
wire smoke failed. The helper exited 22 with no stdout/stderr or framed response;
the transport rejected `MO1307_INTERNAL` at ACQUISITION and cleanup remained
unconfirmed. Execution stopped. No accepted candidate, package installation,
Phase 3A certification or Phase 3B/3C refresh was produced.

C3RB `defe93989efc6501b1a730b82e79e705884b269b` remains production authority.
The failed correction `865978ff56229b60cca77bdb797987fc7d49aa4e` is unaccepted;
its stopped evidence is preserved at `cd8926e1e14db736db4b2957858b9032b75425b0`.
Accepted C3RB Phase 3B `702c1b6381f6112a50ac844831d195275dac3350` and Phase 3C
`b02fc0226a1a2d800185a02071674ca80bdf4a1d` remain unchanged historical authorities.

## Scoped specification

This document supersedes only the detached-launch prescription in
[the preceding correction specification](mo1307-console-ownership-correction.md).
That document is preserved unchanged. Its description of detached-mode job
association describes the failed launch mode, not the repaired setting. Its
current console-window/held-object authorization and fail-closed startup design
remain the proposed correction; this task does not reopen that design.

The repair changes `helperLaunchSpecification().options.detached` from `true`
to `false`. `windowsHide:true`, `shell:false`, fixed absolute Windows PowerShell
5.1 executable, fixed argument array and packaged script, package working
directory, sanitized `SystemRoot`/`WINDIR`, and three `pipe` streams remain.
The supervisor retains the child reference and its existing exit, EOF,
cancellation and settlement checks. The helper script is unchanged from the
unaccepted correction. No numeric-PPID ownership inference or forced console-host
termination is restored.

A valid request must yield exactly one valid wire 2.0.0 response before success.
Empty stdout cannot become successful transport settlement, even if the child
exits zero. Request framing, canonical body, session/sequence, error mapping,
byte limits, filesystem observations, serializer and publication are unchanged.
The helper still must prove native console absence or complete its current
console-owner/held-object and host-exit proof before returning a valid frame.
A windowless attached console does not acquire host authorization from this
launch repair. Silent startup refusal remains exit 22 without diagnostics.

No resource limit changes: helper 5000 ms, aggregate helper 20000 ms, CLI 30000 ms,
API/worker 10000 ms, terminal cleanup 2000 ms, native host wait 1000 ms. **H remains
NOT_ESTABLISHED.** There is no retry-until-pass, new architecture investigation,
deadline characterization, C3S or Control-E work.

## Finite diagnostic evidence and limits

The retained first validation of the failed detached correction exited zero in
111.4571 ms with no stdout/stderr or response frame; transport rejected
`MO1307_INPUT` and cleanup was unconfirmed. Validation stopped there.

The new diagnostic made two predeclared engineering-probe launches, varying only
`detached` between those launches. It reused the retained 350-byte request but
used a fixed engineering script and private sidecar argument instead of the
production helper. Its first statement attempted a script-entry witness.

| Mode | Retained observation |
|---|---|
| `detached:true` | Exit 0; 0 stdout/stderr bytes; no recorded entry witness; 132.7916 ms. |
| `detached:false` | Entry witness; exact 350-byte binary echo; stdin EOF; stdout write/flush returned; 0 stderr; exit 0; 888.5722 ms. |

The false-mode probe recorded valid native pipe handles and managed streams. It
also observed one console client (itself) and a null console window; that does
not identify a host or prove production console cleanup. All recorded stream
closure conditions passed for the diagnostic. The receipt reports zero product
helper invocations and zero production wire-pass claims.

These observations localize the detached failure to a launch-dependent condition
at or before the probe's first recorded script-entry witness. They support
removing the incompatible detached setting on this pinned installation. They do
not establish PowerShell's internal early-exit branch, prove that the original
production invocation followed the same internal branch, or constitute a helper
response. No claim that invalid inherited handles caused the failure is made.

Diagnostic receipt:
`repositories/cca-conformance/evidence/mo1307/wire-repair/launch-diagnostic/receipt.json`
— SHA256 `1217ce3f896af6d274af4ec4f4ef138bb24e91c48c51e8589065f1f761a6e39e`.

## Required order and stop boundary

The predeclared first gate was one smallest valid exchange through the repaired
production transport, requiring the exact framed response, stderr behavior,
child exit/EOF settlement and confirmed cleanup. It failed, and the stop rule
was applied: no subsequent console cases, regressions, certification or refresh.

The actual invocation used PID 32600 and the sealed 353-byte valid request. It
exited 22 after 1075.518 ms of recorded product time, with zero stdout/stderr
bytes. All eight stream/process completion flags were true, but the supervisor
retained `cleanupConfirmed:false` and `activeRole:helper`. Child exit and closed
pipes did not establish the helper's native console-quiescence proof.

The observed failure was the nonzero-exit rejection at
`src/helper-transport.mjs:66`, mapped to `MO1307_INTERNAL` at ACQUISITION. The
retained production observation does not identify which native startup branch
refused. The diagnostic's sole-self/null-window observation is compatible with
a refusal by the unchanged console proof, but is not a measurement of that
production branch. Its exact cause remains UNESTABLISHED.

The receipt records exactly one helper invocation, zero additional cases, no
retry, no certification start, unchanged limits and all 89 source members
unchanged against the pre-execution seal:

- `repositories/cca-conformance/evidence/mo1307/wire-repair/minimum-wire-smoke/receipt.json`
  — SHA256 `fd87d908d29b1e4fcade1b1d2ef0d2609b28300c530bb4a03ece6b373127f745`.
- `repositories/cca-conformance/evidence/mo1307/wire-repair/minimum-wire-smoke/seal.json`
  — SHA256 `308575e1c18b9d2dc2cf3e334ac6be3b0cb46427bcae31b9d37064556d279518`.

The following later gates were conditional and remain **UNEXECUTED**: a finite
console/startup suite covering applicable
normal/no-console/optional-host paths, unattributable or wrong-image host,
ambiguous ownership, extra client, access denial, detach failure, host-exit/wait
failure, silent exit 22, deadlines and wire preservation. Fault doubles remain
engineering branch evidence, separate from actual native launch evidence.

The blocked regression stage consists of the prepared 107-test driver, native filesystem
component (33 mandatory cases plus a predeclared conditional alias case), then
the two native TOCTOU controls. The two controls use reversible copies of the
current helper; no historical helper or 3C campaign is executed. Each required
failure stops its successor. The existing node:test files retain their own case
scheduler; the 107 driver stops before the next required command.

The new drivers and preparation instructions are in
`repositories/cca-conformance/tools/mo1307-wire-repair/README.md`. Their manifest
would label repaired bytes `VALIDATION_SOURCE_NOT_YET_ACCEPTED_CANDIDATE` with
`candidate:null`. That regression preparation/execution did not become a passing
validation. Any future new production identity would require successful mandatory
validation and exact equality to its already-validated package members.

A fresh isolated Phase 3A worktree, archive, offline installation, installed-member
verification and sealed A-O execution were therefore not started. No historical
PASS is current execution. This stopped generation must not be retried.

## Final report

The preservation commit/tree and final repository status are recorded separately
in the forward binding
`repositories/cca-conformance/evidence/mo1307/wire-repair/final-binding.json`.
That binding records an unaccepted repair and retained failure, not a new accepted
candidate. No commit hash is invented here before preservation completes.

| Item | Current recorded disposition |
|---|---|
| 1. Cause of zero-output exit | Launch-dependent pre-entry diagnostic boundary above; exact PowerShell internal branch remains unknown. |
| 2. Launch repair | `detached:true` to `false`; fixed executable/script/environment and pipe contract unchanged. |
| 3. Final production diff | Relative to the failed correction: helper-transport option/comment, helper README wording, generated SBOM/distribution bindings. Helper script unchanged. Relative to C3RB the retained current-console helper correction remains, so five shipped members differ: helper, transport, helper README, SBOM and distribution. Exact unaccepted commit/tree binding: final-binding.json. |
| 4. Wire validation | FAIL at minimum-wire-smoke: one helper; exit22; no frame; stdout0/stderr0; MO1307_INTERNAL; 1075.518 ms; cleanup unconfirmed. Diagnostic echo is not a product response. |
| 5. Console/security validation | UNEXECUTED after the mandatory wire failure. |
| 6. Regression validation | Prepared 107 tests + native filesystem + two TOCTOU; all UNEXECUTED. |
| 7. New candidate identity | NONE ACCEPTED. Preservation records the unaccepted repair; neither prior failed hash nor a source digest is an accepted candidate. |
| 8. Package/install identity | Package preparation build/check passed 89 members, 53 contract members, zero dependencies. No certification archive/offline installation was created. Exact prepared source members are bound by the smoke seal/receipt. |
| 9. A-O results | ALL_NOT_RUN. A MO-1306 evaluate/verify/API; B READY; C NOT_READY; D COULD_NOT_EVALUATE; E REST; F seven decisions; G complete tag inventory; H helper deadlines/cancellation; I worker deadlines/cancellation; J cleanup/topology; K finalization; L filesystem/native; M environment; N determinism; O final MO-1306. |
| 10. Certification receipt | NOT_CREATED. |
| 11. Phase 3A status | **PHASE3A_CONCRETE_IMPLEMENTATION_BLOCKER** at the first mandatory production wire smoke. |
| 12. Commit/binding identities | C3RB and historical accepted commits above; diagnostic and smoke receipt/seal hashes above. Exact unaccepted repair/evidence preservation identities: final-binding.json. |
| 13. Phase 3B refresh scope | Future-only candidate-bound artifact scope below; NOT_RUN. |
| 14. Phase 3C refresh scope | Retained 88-ID future dependency selection plus source review/new console cases below; not a sealed campaign, NOT_RUN. Any later candidate diff requires reconciliation again. |
| 15. Repository status | Preservation HEAD, branch and final clean/dirty status are recorded in final-binding.json after this report is committed. No production acceptance is implied. |
| 16. Next action | Preserve the stopped repair and evidence, report this concrete blocker, and stop. No further diagnostics, helper/test execution, retry, 3B/3C refresh, push, tag or Phase 3D. |

## Conditional Phase 3B and 3C refresh

The latest user authorization permits scoped 3B and 3C refreshes **in parallel
only after Phase 3A acceptance on the new candidate**. They are not being run or
accepted by this specification. The earlier accepted C3RB results remain
historical and are not transferred to changed source bytes.

The preserved matrix is
`repositories/cca-conformance/evidence/mo1307/console-correction/future-3bc-refresh-requirements.json`
— SHA256 `c8b7800dfd3942170fcc03a02cbae986540901747ba121ca776e15e34a319568`.
It explicitly enumerates all 88 existing affected 3C IDs and the exact 3B
artifact-bound controls. Its failed-candidate binding is historical, not the new
repair's candidate identity. Reconcile the final actual diff before fixing a new
refresh inventory; preserve this prior matrix unchanged. The current stopped
repair's future-only rebound, with `candidate:null` and the same explicit 88 IDs,
is recorded separately in
`repositories/cca-conformance/evidence/mo1307/wire-repair/future-3bc-refresh-requirements.json`.
This is a dependency selection, not a sealed refresh campaign or a new candidate.

Phase 3B requires new candidate/archive identities, exact source/archive/installed
member inventories, distribution88 entries, SPDX87 checksums and package
verification code, two independent deterministic archive assemblies, fresh
offline install, before/after89-member equality and persistence, runtime import
closure, installed smoke/source independence, affected tamper controls and new
provenance/review/seal. Unchanged toolchain/license/schema authority is reusable
only with exact dependency proof. The installed API-ready vector and invalid CLI
dispatch smoke contain no native helper execution and cannot certify cleanup.

The matrix's 16 artifact-bound tamper controls are archive-byte-tamper,
missing-member, unexpected-member, unsafe-tar-path, nonregular-tar-member,
duplicate-member, missing-tar-terminator, trailing-tar-data, helper-tamper,
distribution-hash-tamper, distribution-length-tamper, sbom-checksum-tamper,
extra-package-file, missing-package-file, provenance-byte-tamper and
installed-helper-mutation. Its six remaining historical tamper controls require
separate checker/input dependency review; no inherited tamper PASS is granted.

The prior 3C selection is 67 equivalence + 12 protocol + two TOCTOU + six
deadline/cleanup + one fixed-launch primary control. Exact selectors, all IDs,
supporting native raw witnesses, source-audit requirements and proposed new
console-specific cases are retained in that matrix. Refresh helper delta,
network/secrets/fixed-launch/native-boundary review, shifted filesystem
dominance bindings, bounded-state source review and candidate/tool/output seals.
The six deadline IDs and fixed-launch ID are:

- `runtime-boundary:fixed-helper-environment-poison`
- `refresh:deadline-timeout-exact-mapping`
- `refresh:deadline-late-native-success-refused`
- `refresh:deadline-crash-closed-transport`
- `refresh:helper-path-count129`
- `refresh:deadline-resource-native-declared-file-cap`
- `runtime-boundary:fixed-powershell-launch`

The repaired detached flag again matches C3RB; the helper is byte-identical to
the unaccepted correction, while transport comments/console-policy provenance
remain changed from C3RB. The future selection retains the fixed-launch control
to bind those final launch and authorization assumptions, without claiming its
old behavior changed. No blanket transfer of the other historical primary
outcomes is authorized. New console cases supplement the historical IDs and are
counted separately. There is no accepted new candidate, so any later production
diff requires dependency reconciliation again. Do not rerun all 551 unless that
analysis requires it.

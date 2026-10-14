# MO-1307 Phase 3A-R2 — C3S specialized response serialization

**STOPPED: required Phase 2C regression failed. C3S is not accepted; no C3S or
C3SB commit was created. C3RB remains the production authority.**

The authorized change replaces generic recursive response serialization with a
closed deterministic writer. Request canonicalization, acquisition, native
security observations, Base64 production/chunking, lifecycle, and final response
framing remain unchanged. Request-local buffer reuse is not part of this change.

## Authority and historical preservation

The implementation/evidence parent is current main
`4a1de6f00788e3c52a647d6f25aa1dbd2d5d5d97`. The immutable production comparison
authority is C3RB `defe93989efc6501b1a730b82e79e705884b269b`. Accepted 3B-R is
`5cb213eeab8a6deec39a8f8f93ea13a70e053231`; accepted 3C-R is
`f4ed5873969ab6b627941dc20d5823c5e853b9fe`. Neither certifies changed C3S bytes.
Phase 3A-R remains BLOCKED/incomplete and Phase 3D remains GATED. The Phase 2D
discrepancy remains HISTORICAL_ONLY for the current restart; Phase 2D is not reopened.

The 15 existing R2 diagnostic artifacts are bound by
[preservation.json](../repositories/cca-conformance/evidence/mo1307/phase3a-serialization-correction/preservation.json).
If this correction is accepted, those exact bytes will be adopted into C3S as
historical diagnostic evidence. Their original report's untracked-status statement
remains the historical observation. The one execution returned
`MO1307_FILESYSTEM_BOUNDARY` during initial root-chain acquisition. It did not
exercise successful response serialization, select this correction, or prove a
performance benefit. No R2 rerun occurs. C3S selection follows explicit human
authorization based on the combined static/historical engineering evidence.
The dirty r3a worktree and all earlier failures remain preserved.

## Production change and invariants

`Encode-Identity` and `Encode-Response` emit fixed canonical field order with
in-memory StringBuilder instances. Dynamic strings retain `Encode-String`;
numbers, booleans and null retain the existing scalar `Encode-Value` behavior.
Only internally generated Base64 chunks bypass dynamic escaping, retaining the
4096-character ceiling and the unchanged conversion/slicing pipeline. Empty
files retain `bytes:[]`. No partial successful response reaches stdout.

The original generic encoders are unchanged and continue to canonicalize
requests. The original response construction, strict UTF-8 without BOM, one LF,
four-byte prefix, 16,777,216-byte framed ceiling, all-exception RESOURCE_LIMIT
fallback, two final output writes and flush are unchanged. Removing the two
new functions and restoring the single encoder call recovers exact C3RB bytes;
the [source comparison](../repositories/cca-conformance/evidence/mo1307/phase3a-serialization-correction/source-equivalence.json)
records this limited static proof. Actual byte/security validation is separately
required.

Wire version 2.0.0, request/response schemas, sessions, sequences, operations,
readiness, 22 gates, exits, providers, evidence binding, human decisions,
publication and process topology remain unchanged. Frozen limits remain helper
whole lifecycle 5000 ms, aggregate helper-active 20000 ms, CLI/rename admission
30000 ms, API/worker 10000 ms and failure cleanup 2000 ms. H remains NOT_ESTABLISHED.

## Finite validation plan

1. Pure serializer engineering comparisons use the actual C3RB/C3S encoder
   functions and final response/fallback/framing block. They cover all six
   operations, success and ERROR, empty and multiple files/roots/chains, payload
   and Base64 boundaries including 0/1/2/3/3071/3072/3073 bytes and 2/4/8 MiB,
   string/Unicode/surrogate and integer boundaries, and the exact framed-size
   boundary. Complete byte equality and independently expected outcomes are
   required. Synthetic encoder-limit cases are not native runtime certification.
2. Native security equivalence retains the previous 39 paired cases and adds
   five inspection-operation success pairs: at most 44 pairs / 88 executions,
   with 19 instrumented pairs and 17 controlled mutations. The inherited
   20000-ms engineering oracle guard is not the product deadline or performance
   acceptance; all product limits remain unchanged. Stop on the first unexpected
   result, byte difference, observation-count drift or cleanup failure.
3. Existing unchanged regression closure: cheap syntax/import/schemas/fixtures,
   package 8, Phase 1 native 25, Phase 2C 219, Phase 2D 58 and 16 exact vectors.
   Overlapping Phase 2C subset counts are not added again.
4. Only after equivalence, security and regressions pass, measure serialization
   of the exact READY and MO-1306 oracle response workloads. For each workload,
   use three paired observations in fixed order old/new, new/old, old/new:
   six serializations per workload, twelve total; no warm-up or excluded result.
   The predeclared engineering benefit threshold is at least a 10% reduction in
   median serialization time for each workload, with all frame bytes identical.
   Then run exactly one corrected-product READY request and one MO-1306 request,
   in that order, through the unchanged real supervisor and transport. Inputs,
   hashes, complete expected frames and tooling are sealed before execution.
   Product witnesses must return exact expected bytes, normal confirmed cleanup
   and completion within the unchanged 5000-ms helper bound. Stop on failure;
   no retry, new input, Control-E or campaign expansion.

## Acceptance and binding

Acceptance requires every byte/security/protocol check and regression to pass,
unchanged dependencies/ceilings, supported scoped performance benefit and
preserved history. Any equivalence or security failure stops this correction.
No passing subset grants acceptance.

The established correction convention requires implementation/evidence C3S as a
child of the actual main parent, followed by binding-only C3SB referring to
actual C3S parent/tree/helper/package/evidence identities. No future or self hash
is embedded. Post-binding checks are cache-only graph/package/workspace checks,
not repeat native campaigns. No push, tag or Phase 3D is authorized.

## Required subsequent certification

Any accepted C3S/C3SB candidate requires fresh installed Phase 3A certification.
Changed helper bytes and dependent SBOM/distribution/archive identities require
scoped 3B refresh. The closed writer's response, escaping, framing, error and
resource behavior require scoped 3C review; unchanged controls may be reused only
through explicit dependency analysis. Existing 3B-R/3C-R remain authorities for
their exact C3RB scope. No certification refresh is executed by this correction.

## Recorded validation stop

| Scope | Observed result |
|---|---|
| Exact source recovery | PASS; removing the two added writers and restoring one response call recovers C3RB bytes |
| Pure serializer equivalence | 90/90 PASS; complete framed bytes and independent expected frames; 48 also passed the unchanged protocol decoder |
| Native security equivalence | 44/44 pairs PASS; 88 helper executions, 12 success pairs, 32 expected refusal pairs |
| Native observation/freshness controls | 19 instrumented pairs and 17 controlled mutations PASS; established MO-1306 1448 opens and 2172 identity/final-path observations retained |
| Package regeneration | PASS; 89 members, 53 contract members, zero external production dependencies |
| Cheap syntax/import/schema/fixture checks | PASS; 31 commands |
| Package regressions | 8/8 PASS |
| Phase 1 native regressions | 25/25 PASS |
| Phase 2C regressions | FAIL; 218/219 PASS, F22 failed |
| Phase 2D regressions and 16 selected vectors | NOT_RUN after regression failure |
| Serialization/product performance witnesses | NOT_RUN; benefit NOT_ESTABLISHED |
| Final acceptance, C3S/C3SB commits and binding | NOT_RUN; no acceptance |

F22, `read-only verification timeout is bounded and late handle completion only
closes`, failed at `mo1307_phase2c_finalization_test.mjs:206`:

```javascript
assert.ok(performance.now() >= publicationStatus(item.token).dispositionDeadline)
```

The retained test output reports a 2029.4944-ms whole-test duration. It does not
record the clock values at the failed comparison or the amount by which it was
early. Earlier assertions in F22 reached the expected OUTPUT rejection,
COMMITTED state and `namespaceVerified:false`; the subsequent late-handle
release/closure assertions were not reached. All 219 tests in the already
running group settled, yielding 218 passes and one failure. The wrapper stopped
before launching the next regression group.

The test and `src/publication.mjs` are byte-identical to C3RB. The failing
read-only publication verification uses a JavaScript timer and injected `fs.open`
fixture; it does not exercise the new PowerShell serializer. This establishes a
required regression failure, not a measured cause or a harmless-flake finding.
No unrelated publication fix, weakened assertion, retry or acceptance waiver was
attempted. No performance witness, certification, commit, push or tag followed.

The raw failure is retained in
[tests.stdout.txt](../repositories/cca-conformance/evidence/mo1307/phase3a-serialization-correction/regressions/phase2c/tests.stdout.txt)
and the [regression receipt](../repositories/cca-conformance/evidence/mo1307/phase3a-serialization-correction/regressions/phase2c/receipt.json).
The [stop disposition](../repositories/cca-conformance/evidence/mo1307/phase3a-serialization-correction/stop-disposition.json)
records the unaccepted candidate and exact remaining scope. Unexecuted governance
and performance tooling is retained as prepared tooling, not execution evidence.

Only three shipped working-copy files changed: the helper, SPDX SBOM and
distribution manifest. The helper is 33313 bytes, SHA-256
`d9874969f1d02065cd2df0b8a978bfaf0b27a6840fb168acf0af8e3a113f2c7d`;
the SBOM is 47328 bytes, SHA-256
`acf057a767354e9305a8f5926e404d4e23c5d033c0b3c7b4aa193dfa84b3919f`;
the distribution manifest is 12631 bytes, SHA-256
`e0483d8a0e995e5ee62501cd5c153dd6476e1890f6bf77a86d3499852ebf93cb`.
These are unaccepted working-copy identities, not a new release/archive binding.

Main remains at `4a1de6f00788e3c52a647d6f25aa1dbd2d5d5d97`. No files were staged.
The original 15 R2 files remain byte-identical and untracked; their proposed
adoption did not occur. The r3a HEAD and dirty status remain unchanged. All
previous accepted identities and failed-history labels are retained. The next
step requires a separate disposition of F22; this correction does not authorize
repairing or rerunning that publication check.

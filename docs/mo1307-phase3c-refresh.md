# MO-1307 Phase 3C-R targeted security and trust refresh

Result: **PASS for exact C3RB**, pending Phase 3D integration with separately
accepted Phase 3A-R and Phase 3B-R inputs. This certifies the affected security
boundary only. It does not certify installed runtime completion, package
assembly, hosted execution, human authenticity or release authorization.

## Exact authority and preservation

| Authority | Identity |
|---|---|
| Workspace | C:/Users/melsa/Documents/Codex/r3c |
| Branch | codex/mo1307-phase3c-refresh |
| Baseline / C3RB / required commit parent | defe93989efc6501b1a730b82e79e705884b269b |
| C3RB tree | 54c8ca8acc388d8dcb5d8d76e119b434dcc1a9bb |
| C3R implementation | 58c98b7eb0aa2d07bab78753ce66b564066aafeb |
| C3R tree | d144200c4982949d5de4c8f6b73c0f2c1dbd2ae3 |
| Original accepted 3C | 191f34748141afca2027e8e9db0c6f1b6a9c84c0 |
| Old B2 candidate | 976d4a04d75dadc02e30215dd5a8ddeaa2352df8 |
| Corrected helper | 30,210 bytes; SHA-256 35381850f1ef8c322e528156ebd8779071ad3288cdccd4d0ebab51ce6f9c6ac8 |
| Historical helper | 29,771 bytes; SHA-256 ba2ffa58f253c3b8135772a880b5d306f20de56efa58e384907122f088b4a21b |
| Corrected distribution manifest | 12,631 bytes; SHA-256 5802973c276d10f48db51f842101cd664fbc21e13a74b344a9e0b421746ffc09 |
| Corrected SPDX SBOM | 47,328 bytes; SHA-256 7997bb939027132d307864750331ba70c0538a7590aea2773cafa5e3759aabaa |

Both worktrees initially had the exact required HEAD and a clean Git status.
Original 3C was only read. The preservation gate rehashed its original inventory,
verified its complete 11540-file nonignored name set and clean Git state,
and checked the 27 legacy files omitted by the initial broad name filter against
exact unchanged HEAD blobs. It also rehashed all 12008 initially inventoried
current files and verified the 27 omitted legacy files. That inventory-filter
omission is disclosed in preservation.json. Production and all pre-existing
tracked bytes remain unchanged.

## Reuse decision and outer binding

The complete 31-area matrix classifies 19 areas UNCHANGED_REUSABLE, 11
TARGETED_REFRESH_REQUIRED, and one INVALIDATED: use of the historical outer
candidate/helper/distribution/SBOM identities as authority for current C3RB.
No historical certification outcome is erased or relabeled as a current pass.
The matrix also maps all 22 original attack surfaces and supplementary witnesses.

Exact dependency analysis verified 89 shipped Git blob pairs: 86 are unchanged;
only the helper, distribution manifest and SBOM differ. It also verified all
628 C3R binding members, 36 original trust source bindings, 145 reviewed input
bindings (143 current inputs and two retained historical engineering tools),
and 583 fixture files. The helper allowlist row, distribution row, SBOM SHA-1
and SHA-256 row, and fixed runtime helper path bind to the corrected script.
This is source-to-helper security binding; archive/install certification belongs
to Phase 3B-R.

Unchanged inner proofs remain reusable for readiness precedence, trust roots,
grants, raw lineage outside native acquisition, DAG semantics, history,
qualifications, provider axes, human decisions, tag governance, result/proof
semantics, CLI dispatch, errors, workers, publication state and release authority.
Original receipts that mention B2 or package identity keep their historical
meaning. Current outer applicability comes from this audit's C3RB bindings.

The 496 original primary IDs have explicit dependency classifications: 470 are
eligible for unchanged reuse and 26 require native refresh. Final execution
accounting additionally reruns representative unchanged consumer/launch controls.

## Helper delta and validated-path dominance

Independent PowerShell AST/token review finds exactly one removed executable
statement: Assert-Root $observed inside Read-Identity. The remaining difference
is explanatory comments. After that removal the old and corrected scripts have
5,256 identical noncomment/non-newline tokens and zero parse errors. All 19
native invocation sites are unchanged.

There are exactly **three Read-Identity call sites**:

| Corrected line | Caller | Validated expected path |
|---|---|---|
| 248 | Open-Chain, initial identity | Component prefixes constructed only after Assert-Root at line 234 |
| 259 | Assert-ChainStable, held-handle reinspection | The unchanged path stored by Open-Chain in the request-local entry |
| 262 | Assert-ChainStable, fresh reopened identity | That same validated entry path, with a new native open |

The three Open-Chain calls cover READ_SET root acquisition (283), file acquisition
(289), and publication inspection (337). The three stability callers cover
post-read file checks (313), final root checks (322), and publication inspection
(344). All six publication slots were exercised successfully and with traversal
refusals, including both CHECK_OUTPUT slots. No production alternate entry path
can call Read-Identity with attacker-selected unvalidated expected metadata.

Strings in these existing request-local entries are immutable values; no
production path-field reassignment exists. The containers are not claimed to be
language-frozen objects. The optimization creates no new retained descriptor,
global/path-keyed table, cross-request cache or observation cache. A process
accepts one framed request and exits. Native state is reacquired at every
required freshness boundary.

Every successful identity observation still executes native information, file
type, final handle path, prefix/full expected-path equality, reparse/type/link,
size and volume checks. Unchanged fail-fast refusals can exit before later
checks. The removed lexical check contributes no unique validation because the
fresh complete native final path must equal an already validated canonical
expected path. Seven-field identity equality and all fresh opens remain intact.

## Fresh targeted execution

| Evidence | Result and scope |
|---|---|
| Before/after equivalence | 69 exact-frame pairs; 55 refusals and 14 successes; 138 helper processes |
| Instrumented subset | 21 pairs; exact old/new native counters; 19 controlled mutations |
| Additional TOCTOU | Two old/new native replacement pairs at pre-read and held-to-fresh boundaries |
| Consumer protocol | 13 rows; 12 exact MO1307_INPUT refusals plus one native-frame control |
| Deadline/environment/resources | 18 evidence rows; 11 real native helper invocations; all PASS |
| Raw retained experimental rows | 102; these are not summed as unique controls |

The historical MO-1306 and READY file contents are reconstructed locally from
retained accepted native responses and independently matched byte-for-byte to
the tracked fixtures. The request session, sequence, descriptors, order and
limits stay unchanged; only the root is rebound into r3c. This keeps every write
and execution fixture inside the required workspace. It is explicitly not a
reexecution of the historical absolute-root frame. Both exact helper algorithms
run the same local request under a bounded 20-second engineering guard, and their
complete response bytes match. The old algorithm is compared to its response,
not its historical timeout disposition.

The local MO-1306 request has 65 files and 790 checked chain entries. Each
helper performs 1580 native opens and 2370 identity/information/final-path
observations. Both sides have identical initial, post-read and final-root counts.
The historical 1,448/2,172 counts differ because the local fixture root has a
different depth; no reduction is inferred from unlike roots.

Actual Windows controls reject traversal, drive-relative paths, UNC, device/ADS
and reserved paths, dot aliases, invalid relative separators, file/directory
symlinks, junctions, hardlinks and wrong types. Allowed case and root separator
canonicalization still succeeds. Final-path perturbations reject alternate roots,
wrong prefixes, ADS, trailing dot/space, separators, controls and mismatched full
paths. Synthetic volume/identity observations are labeled separately.

Nineteen equivalence mutations include four actual filesystem mutations after
read (replacement, size change, reparse substitution and ancestor replacement),
with the other fifteen perturbing native observation fields or expected paths.
The two additional actual replacement pairs cover initial-chain-to-read and
held-check-to-fresh-open boundaries. Every mutation refuses equivalently.
Engineering copies release a held leaf only where needed to permit a mutation
normally blocked by production sharing. Reversible markers recover the exact
old or corrected source. No engineering hook is shipped.

Native protocol cases cover wrong version/session/sequence/operation, unknown
fields, malformed/truncated frames, duplicate/noncanonical JSON, extra frames,
trailing bytes and size limits. Current consumer checks cover malformed and
noncanonical base64, session/sequence/operation/version mismatches and replay.
Cross-session ownership belongs to the consumer/sequence; the one-shot helper
echoes a syntactically valid session and has no cross-process session store.

## Deadlines, cleanup, resources and authority

Fixed deadlines remain 5,000 ms per helper, 20,000 ms aggregate helper time,
30,000 ms CLI admission, 10,000 ms worker/byte API and 2,000 ms ordinary cleanup.
There is no near-deadline branch that skips or reduces helper validation.

A real delayed-EOF helper timeout maps to MO1307_TIMEOUT / ACQUISITION / exit 29.
An owned helper crash maps to MO1307_INTERNAL / ACQUISITION / exit 22. An exact
valid native OK frame delivered through an engineering stream proxy after the
terminal deadline remains refused. The native helper itself completed earlier;
this specifically tests late transport delivery and is not a claim of late
native generation. Partial/late sequence controls preserve terminal failure.

All 11 helper PIDs were externally sampled; all helper and three-stream close
events occurred. Across 73 OS process samples, no surviving helper or attributable
console host remained. Timeout/crash product snapshots conservatively retain
cleanupConfirmed:false because no valid native response proves detachment.
That is distinct from this audit's external observed quiescence. The CIM observer
may conservatively overattribute descendants after parent PID recycling; this
cannot conceal a known survivor and is not used for a topology maximum claim.

Request limits are exercised at native and JS admission, including 128/129 paths,
request frame size, declared file caps and observed file size. Pure allocation
structures and bounded local collections are unchanged. Representative old/new
working-set samples were 101,691,392 and 105,017,344 bytes; this whole-process
observation includes PowerShell/GC/observer effects and proves no hard RSS ceiling
or isolated allocation delta. Full runtime resource certification stays with 3A-R.

The exact fixed PowerShell executable, script and arguments resist PATH/PATHEXT,
PowerShell/script substitution, HOME/USERPROFILE, proxy and credential sentinel
poison. Loader/import/require substitution is refused. Sentinels do not leak in
helper stdout/stderr or error projection. Static source/dependency checks show no
new network primitive/import/call, hosted/provider action, debug instrumentation,
timing log or unexpected diagnostic output. These controls do not claim OS-wide
egress isolation. Private immutable-root and nonhostile-OS assumptions remain.
The earlier native downstream volumeSerial-branch limitation remains: no new
actual distinct-volume fixture or downstream native branch coverage is claimed.

## Deduplicated corpus

| Classification | Unique controls | Rejection controls | Accepted/behavioral |
|---|---:|---:|---:|
| Reused | 459 | 349 | 110 |
| Rerun | 36 | 32 | 4 |
| New | 56 | 45 | 11 |
| Total | 551 | 426 | 125 |

Thirty-seven historical IDs are covered by fresh executions. A single combined
environment-poison scenario discharges two original layer IDs, so it counts as
one of the 36 distinct rerun scenarios. All 496 historical IDs are retained in
the mapping. Counter replays, repeated attempts, resource samples, repeated
session decoder checks, and native/JS witnesses of the same path-count refusal
add no separate primary control. The 102 raw experimental rows are reported
separately and never added to the 551-control union.

Preserved harness issues are: wrong global Node rejected before native launch;
request-rebinding deep comparison distinguished null-prototype versus cloned
objects during setup; an optional-argument instrumentation anchor mismatch;
an insufficient delayed-EOF late-response stimulus; a removed-statement literal
mistake in source-only reuse tooling; and a corrected accepted-versus-negative
count label. All are documented with retained inputs/attempts. None demonstrated
a product security defect or was reclassified as a successful product execution.

## Review, acceptance and handoff

A separate post-test read-only review checks validated-path domination, fresh
native observations, no observation/global state reuse, error-path and deadline
bypasses, residue, package binding and the current corpus. Its exact source and
receipt bindings are in independent-review.json. The final report receives a
separate read-only attestation before sealing. Workspace verification passed.
Before commit, the seal checks the full evidence inventory, exact staged bytes,
allowed additions, unchanged product/old3C, and git diff --check.

MO-1306 correction validation includes a successful CLI smoke. It does not
promote Phase 3A certification: the historical native completion limitation
remains historical, and current installed runtime certification is pending a
separately accepted Phase 3A-R. Old 3B archive identity and old 3C helper identity
are not current artifact authority. Live GitHub/GitLab/Jenkins/Azure execution,
automatic human approval authenticity and automatic release authorization are
not established here.

The single authorized commit has subject:

    cert(memoryos-1.3): refresh MO-1307 security certification

Its sole parent must be C3RB defe93989efc6501b1a730b82e79e705884b269b. Only
refresh tools/evidence and this report are added. The containing commit is the
3C-R handoff identity; it cannot truthfully embed its own hash, so that hash and
final clean Git status are supplied after commit in the task's final response.
No push or tag is performed.

Phase 3D must consume this exact 3C-R commit together with separately accepted
3A-R installed-runtime and 3B-R artifact refresh commits bound to the same exact
C3RB. Recheck their parents, scope, production identities and retained limitations
before integration. This task does not establish that those two other inputs
already exist, start 3D, or authorize a release.

## Requested final-report register

| # | Item | Disposition |
|---|---|---|
|1|Baseline|Exact requested branch/HEAD; initially clean|
|2|C3RB|defe93989efc6501b1a730b82e79e705884b269b|
|3|Original 3C|191f34748141afca2027e8e9db0c6f1b6a9c84c0|
|4|Original preservation|11540 nonignored files, clean Git, unchanged|
|5|Reuse matrix|31 areas: 19 reusable/11 targeted/1 invalidated outer identity|
|6|New helper identity|35381850f1ef8c322e528156ebd8779071ad3288cdccd4d0ebab51ce6f9c6ac8|
|7|Old/new delta|One redundant Assert-Root statement removed; comments changed|
|8|Read-Identity call sites|3|
|9|Validated-path dominance|PASS all production call paths|
|10|Request-local reuse|PASS; no new cache or observation reuse|
|11|Native freshness|PASS|
|12|Mutation controls|19 equivalence + 2 additional; all refuse|
|13|Final-path security|PASS|
|14|Path negatives|PASS actual Windows cases|
|15|Helper protocol|PASS native and consumer subsets|
|16|Equivalence|69 exact-frame pairs PASS|
|17|TOCTOU|PASS initial/read/post and held/fresh boundaries|
|18|Deadline security|PASS exact timeout mapping and late refusal|
|19|Cleanup|PASS external quiescence; conservative product flags preserved|
|20|Resources|PASS targeted boundedness; full runtime capacity out of scope|
|21|Package/helper binding|PASS source/allowlist/distribution/SBOM/runtime script|
|22|PowerShell launch|PASS fixed executable/script|
|23|Environment|PASS synthetic poison and substitution|
|24|Network|No added capability; no network/provider execution|
|25|Secrets/logs|PASS static residue and synthetic sentinel|
|26|Trust-root reuse|Unchanged dependencies; current outer binding refreshed|
|27|Grant reuse|Unchanged dependencies; current outer binding refreshed|
|28|Raw-lineage reuse|Unchanged semantics; acquisition boundary refreshed|
|29|DAG reuse|Unchanged dependencies|
|30|History reuse|Unchanged dependencies|
|31|Qualification/provider reuse|Unchanged dependencies and limitations|
|32|Decision/tag reuse|Unchanged semantics; no authenticity promotion|
|33|Result/proof reuse|Unchanged dependencies|
|34|MO-1306 runtime claim|Correction validation exists; certification pending 3A-R|
|35|Release-claim audit|PASS; no automatic release authority|
|36|Reused rejection controls|349|
|37|Rerun rejection controls|32|
|38|New rejection controls|45|
|39|Independent review|Separate post-test source/corpus and report attestations|
|40|Production defects|0 established|
|41|Certification disposition|PASS targeted 3C-R for exact C3RB; scoped handoff|
|42|Production changes|0|
|43|Evidence|repositories/cca-conformance/evidence/mo1307/phase3c-refresh/|
|44|Report|docs/mo1307-phase3c-refresh.md|
|45|Workspace verification|PASS|
|46|git diff --check|Required final staged seal gate; receipt records execution|
|47|Commit hash|Containing one commit; final response records exact hash|
|48|Commit parent|defe93989efc6501b1a730b82e79e705884b269b|
|49|Final Git status|Final response verifies after commit|
|50|Push|None|
|51|Tag|None|
|52|Linux/Ubuntu/WSL|Not used|
|53|VM|Not used|
|54|Provider accounts|Not used|
|55|Duration|Start 13:16 UTC; report capture 2026-09-29T13:40:55.575Z; final response records completion|
|56|Hard-stop compliance|Three-hour hard deadline 16:16 UTC; seal enforces it|
|57|Exact Phase 3D handoff|Containing 3C-R commit plus separately accepted 3A-R/3B-R on exact C3RB|

Evidence: [certification receipt](../repositories/cca-conformance/evidence/mo1307/phase3c-refresh/certification-receipt.json),
[reuse matrix](../repositories/cca-conformance/evidence/mo1307/phase3c-refresh/reuse-matrix.json),
[execution summary](../repositories/cca-conformance/evidence/mo1307/phase3c-refresh/execution-summary.json),
[deduplicated corpus](../repositories/cca-conformance/evidence/mo1307/phase3c-refresh/targeted-negative-corpus.json),
[preservation](../repositories/cca-conformance/evidence/mo1307/phase3c-refresh/preservation.json).

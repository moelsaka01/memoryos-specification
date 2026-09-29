# MO-1307 Phase 3B-R targeted package certification refresh

The targeted artifact checks pass for exact C3RB
`defe93989efc6501b1a730b82e79e705884b269b`, package
`memoryos-readiness@0.1.0`, contract `memoryos.readiness@1.0.0`.
The disposition is `QUALIFIED_PHASE3BR_PASS_PENDING_PHASE3D`, subject to the
successful final seal recorded in the [certification receipt](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/certification-receipt.json)
and [final validation](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/final-validation.json).
Their closed evidence bindings govern the final Phase 3B-R disposition.
Phase 3D integration and final release authorization remain separate gates.
This refresh certifies package identity, assembly and installation; it does
not perform Phase 3A runtime certification or Phase 3C security certification.

## Baseline and historical authority

Work began with a clean tree in `C:\Users\melsa\Documents\Codex\r3b`, branch
`codex/mo1307-phase3b-refresh`, at the exact C3RB commit above. Its sole parent
is C3R `58c98b7eb0aa2d07bab78753ce66b564066aafeb`, whose parent is B2
`976d4a04d75dadc02e30215dd5a8ddeaa2352df8`. The
[baseline](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/baseline.json)
records the observed start and three-hour deadline.

Original accepted Phase 3B commit
`85dea823385e1ccaddcd9997c3918b1312175eba` remains historical certification of
B2. Its 112,154-byte archive, SHA-256
`6335c3ae18d9ab2ba1af3523d3dd4458ca832ed37fdce868729409277533744b`, is retained
unchanged in the read-only historical worktree
`C:\Users\melsa\Documents\Codex\cca-mo1307-3b`. It is not the refreshed C3RB
candidate. The [old authority binding](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/old-3b-binding.json)
identifies all seven original report/evidence files. The full preservation
comparison verifies all 11,416 tracked historical files unchanged and the
historical working tree clean.

That original authority has sparse granularity: one report, the archive,
archive inventory, two installed inventories, a certification receipt and a
tamper summary. Assembly, install, runtime, advisory and provenance claims
reside in the receipt. This refresh does not invent missing contemporaneous
logs. Reuse of detailed toolchain and schema evidence explicitly identifies
the unchanged ancestor receipts that supply those dependency identities.

## Changed dependency closure and reuse

The [source/package comparison](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/source-package-comparison.json)
mechanically establishes the same 89-member set and exact equality for 86
members. Only `helpers/windows-inspect.ps1`, `distribution-manifest.json` and
`sbom.spdx.json` differ from the original B2 package. The first is the C3R
implementation change; the other two are its generated identity metadata.
All 89 shipped source members also match their exact C3RB Git blobs.
Production remains exact C3RB throughout this certification refresh.

The [closed reuse matrix](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/reuse-matrix.json)
classifies every original category as `UNCHANGED_REUSABLE`,
`IDENTITY_REFRESH_REQUIRED`, `REEXECUTION_REQUIRED` or `INVALIDATED`.
Its 28 categories comprise eight unchanged/reusable, five identity refreshes,
15 reexecutions and zero invalidations. Its supporting
[dependency evidence](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/reuse-details.json)
contains old/current lengths and hashes rather than topic-based assumptions.
Archive-bound checks, independent assemblies, installation, installed smoke,
persistence and source independence are refreshed. Unchanged contract,
schemas, fixture validation, toolchain provenance and notices are reused only
through exact dependency checks. Original B2 certification remains valid as
historical authority; its artifact-specific results do not certify C3RB.

## Candidate and member integrity

The [candidate receipt](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/candidate.json)
binds the selected archive:

| Field | Value |
|---|---|
| Filename | `memoryos-readiness-0.1.0.tgz` |
| Length | 112,338 bytes |
| SHA-256 | `341f67e821a56cf88133e8b361e8c670849ff9feaf583ae2732cc3ca61d389a2` |
| SHA-512 | `47cb546684bec6f1edf3bf1f295c8102f6d9f016fde1cd7089c43bb433524812a3b59385fc0b0e57af21e683a99ef9904dc0d651a88c7cb3d1d6b3a3fc56dc8c` |
| npm integrity | `sha512-R8tUZoS+xvHt878fKVyBAvbZ8Bb94c1wicQ7tDNSSBKjtZOF/AsOV68h5oOpnvmQTcDWUaiMfLPR1rOj/FbcjA==` |
| Members | 89 regular files |

The [allowlist](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/allowlist.json)
and [archive inventory](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/archive-inventory.json)
verify every member against C3RB source bytes. Missing, unexpected, unsafe and
nonregular member counts are zero. Headers use uid/gid 0, mode 0644, mtime
499162500 and no PAX fields. The parser checks header checksums, terminal zero
blocks and absence of trailing data.

The corrected helper is bound at `package/helpers/windows-inspect.ps1`:

| Helper | Bytes | SHA-256 |
|---|---:|---|
| Historical B2 | 29,771 | `ba2ffa58f253c3b8135772a880b5d306f20de56efa58e384907122f088b4a21b` |
| C3RB | 30,210 | `35381850f1ef8c322e528156ebd8779071ad3288cdccd4d0ebab51ce6f9c6ac8` |

The [helper receipt](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/powershell-helper.json)
binds that identity to the distribution row, SPDX SHA1/SHA256 file row, fixed
runtime closure and PowerShell launch specification. Launch code remains
byte-identical: the package-relative script runs through the fixed Windows
PowerShell executable with only `SystemRoot` and `WINDIR` in its child
environment. It is the CLI's native acquisition/publication helper.

The [C3R correction report](mo1307-phase3a-readset-correction.md) and bound
correction evidence characterize removal of repeated lexical path validation
as a performance optimization with contract/security behavior preserved for
the retained correction cases. Phase 3B-R certifies the artifact identity;
independent security equivalence remains within the scoped Phase 3C-R review.

## Manifests, SPDX and runtime closure

The [distribution check](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/distribution.json)
reverifies all 88 rows against source and archive bytes. The manifest excludes
its own recursive row and is 12,631 bytes, SHA-256
`5802973c276d10f48db51f842101cd664fbc21e13a74b344a9e0b421746ffc09`.

All 53 contract members are byte-identical to old Phase 3B. The contract
manifest is unchanged at 7,981 bytes, SHA-256
`95810fd28917b123b8809ac0677462ab4879635d1b97a5a372047c4e0aaeddc5`.
The [contract reuse check](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/contract-reuse.json)
records every member comparison.

The [SPDX check](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/sbom.json)
and [complete document validation](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/document-validation.json)
pass. SPDX 2.3 remains one package, 87 files and 88 relationships; these counts
were compared with old Phase 3B. Every file checksum and relationship is
checked. The document is 47,328 bytes, SHA-256
`7997bb939027132d307864750331ba70c0538a7590aea2773cafa5e3759aabaa`.
The package verification code is
`44957c8e471983882df0f59a158ad6603f94ce9e`; its declared cyclic exclusions are
`distribution-manifest.json` and `sbom.spdx.json`. The distribution manifest
binds the SBOM itself. Validation uses the complete pinned SPDX 2.3 schema,
with format checking and remote retrieval denied.

The recomputed [runtime closure](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/runtime-closure.json)
binds 27 JavaScript modules, 119 import/fixed worker/helper edges and nine
Node built-ins. Imports resolve only to permitted built-ins and contained
package members; external production npm dependencies remain zero. Node and
Windows PowerShell are separately provisioned platform runtimes. Static
closure and installed resolution observations do not constitute a hostile-host
sandbox or Phase 3C certification.

## Assemblies, offline install and bounded smoke

[Assembly A and B](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/assemblies.json)
use independently fresh clean source roots, empty explicit caches and
controlled npm configuration. Both archives are byte-identical to each other
and to the selected 112,338-byte candidate. The old B2 archive is expected to
differ and is not an equality target.

The [fresh offline install](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/offline-install.json)
uses `--offline --ignore-scripts --no-audit --no-fund`, an empty explicit
cache, empty explicit user/global configuration and a fresh isolated root.
There is no network fallback. The only installed package is
`memoryos-readiness`. Every one of its 89 members matches archive/source bytes.

The [installed smoke](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/installed-smoke.json)
loads the public API, executes one exact safe `ready` byte API vector and
observes the closed invalid CLI dispatch return `MO1307_USAGE`, exit 10.
The byte vector produces the expected 59,987-byte result, SHA-256
`8ec1375f09103b8d1b791985065c3589bdf8ba2a4ed661dcc081d48468049fa7`.
Original Phase 3B methodology did not require a native verify CLI operation;
this bounded smoke does not run a native helper or repeat Phase 3A-R.

[Source independence](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/source-independence.json)
is observed from `C:\Windows\System32`, outside the source worktree, with
`NODE_PATH` and `NODE_OPTIONS` empty. The retained 44 resolutions use installed
package files and built-ins; ambient package and source-worktree imports are
zero. Fixture data is copied into the isolated root. The unmodified worker
uses its fixed package URL, empty environment and empty `execArgv`.

[Installed persistence](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/installed-persistence.json)
rehashes all 89 members after smoke: zero mutations, with the corrected helper
identity unchanged. A later deliberate installed-helper tamper control is
separate from this smoke and restores/rechecks the complete inventory.

## Reused toolchain, schemas and notices

Node 24.21.0 is 93,580,104 bytes, SHA-256
`ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32`.
The complete 1,994-file Node/npm installation exactly matches the retained
ancestor official-distribution inventory, SHA-256
`8576929965bf577960cfe6b9d1e6fe9d46f0cf4d7ad10d3a4c6c7ac039996c34`.
npm remains 11.19.0 and engineering/install tooling only. Signed-checksum,
keyring, verification-result and notice provenance files are byte-identical;
expensive upstream provenance acquisition is not repeated.

Windows PowerShell 5.1.26100.9444 is 495,616 bytes, SHA-256
`8bb6fa8c283b4d92120b1ef249a9b311b0f804d4cabbe9981159976c8be76a5e`, matching the
retained Phase 1 executable identity. Original Phase 3B recorded the npm and
platform versions but lacked full npm/platform inventories; this refresh
explicitly uses unchanged ancestor identities instead of attributing those
missing details to the original receipt. The helper binding itself is refreshed.

All 52 schema files, the 53-member contract closure, catalog, validator source,
validator lock, runtime schema tables and all 476 fixture files match the
retained Phase 2D authority exactly. The 464 positive and 12 negative fixture
results are reused; nine parser-specific fixtures retain their separate
historical disposition. No full fixture campaign is rerun. Bounded checks
parse all schemas and local references; the pinned document validator also
passes Draft 2020-12 meta-schema validation. Its seven wheel identities and
163 extracted members are verified before import, with isolated Python,
bytecode writes disabled and remote retrieval denied. Historical validation
of old distribution/SBOM bytes is excluded from schema-result reuse; those
changed documents receive fresh validation.

`LICENSE-NOTICE.md`, `NOTICES.md` and package metadata are unchanged. The helper
optimization introduces no dependency or license. Product status remains
`UNLICENSED`/`NOASSERTION`; no product license grant or publication permission
is inferred. SPDX's `CC0-1.0` data license applies to the metadata. Separately
provisioned platform tools retain their own licenses and notices.

## Tamper controls, methodology and final binding

All [22 bounded negative controls](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/tamper-controls.json)
pass, covering archive bytes, missing/extra/duplicate/unsafe/nonregular members,
tar termination/trailing data, helper bytes, manifest lengths/hashes, SBOM,
schemas, runtime identity/imports, dependencies, provenance and installed-helper
mutation. No original negative control is reused: the old summary lacks the
checker-source dependency closure needed to justify that reuse. Production
files are not mutated by these controls.

The [methodology refinement record](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/methodology-refinements.json)
discloses validation-strengthening edits after assembly/install execution:
explicit tar termination/trailing-data rejection, absent install-root assertions
and exact installed package-name checks. Current retained tool hashes are not
presented as contemporaneous assembly tool hashes. Both retained independent
archives and the selected candidate are reparsed and independently revalidated;
command receipts, all member/source/install parity and the new negative
controls remain evidence. Final sealing additionally checks tamper against the
actual final provenance bytes.

The [provenance](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/provenance.json)
and [certification receipt](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/certification-receipt.json)
close C3RB/C3R, correction authority, candidate, manifests, helper, runtime
closure, independent assemblies, offline install and explicitly reused old
evidence. They use existing identities and no future certification-commit
self-reference. Workspace verification passes. Final sealing additionally requires
`git diff --check`, historical preservation and zero production changes,
with the final validation receipt recording those gates.
The certification commit's parent must remain exact C3RB. No push, tag,
Linux/Ubuntu/WSL, VM or provider account is used for this refresh.

## Advisory carry-forward and exact Phase 3D handoff

The [advisory carry-forward](../repositories/cca-conformance/evidence/mo1307/phase3b-refresh/advisory-carry-forward.json)
preserves the original bounded review dated 2026-09-29. The refresh remains
on that date; unchanged component identities justify reuse of its disposition.
No new current advisory source is consulted, and no zero-vulnerability claim
is made.

The original Node July 2026 HTTP/2 finding remains
`OPEN_PHASE3D_DISPOSITION_REQUIRED` for exact Node 24.21.0. Original Phase 3B
did not retain individual advisory/CVE identifiers; none are invented here.
MemoryOS Readiness declares `topology.network=false`, has no external production
npm dependency and imports none of the inspected Node network built-ins,
including HTTP/2. This static boundary is available reachability evidence;
Node containing HTTP/2 does not by itself establish MO-1307 affectedness.
Conversely, the helper optimization does not close the finding. No advisory
risk is accepted.

Phase 3D must bind the separately accepted exact-C3RB Phase 3A-R installed
runtime certification, scoped Phase 3C-R security refresh and this Phase 3B-R
artifact certification. It must reconcile the original July 2026 HTTP/2
advisories with exact Node 24.21.0, accepted runtime/security evidence and the
product's reachable attack surface, then record final applicability and
remaining authority decisions. Historical B2 certifications and historical
failures remain preserved with their actual scopes. Unresolved product
licensing supplies no license grant. This package refresh alone does not
authorize release or start Phase 3D before its accepted inputs exist.

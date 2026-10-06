# MO-1308 Phase 3B closure and supply audit: campaign definition

Status: **AUTHORED AND REHEARSED IN THE CLOUD — NOT CERTIFIED**. Stream 3B of the [Phase 3 protocol](mo1308-phase3-protocol.md)
(Freeze Amendment A8, section 34), on branch `mo1308/phase3b-closure`. Nothing here is evidence; no certifying generation was
sealed and nothing was committed under `evidence/`.

## 1. What it audits

3B is a closure and supply audit, not a package certification (H47): no package is produced, there is no SBOM (D9), and the
identity of the shipped surface is the closure manifest digest. It proves R32 (released closures and tags stay byte-identical),
R33 (no new third-party dependency), R28 and R29 (the history authority's import boundary and absence of I/O) on the candidate.
It uses git objects only; the audit itself uses no network and installs nothing. The release tags must be fetched before the run.

## 2. Tooling (`repositories/cca-conformance/tools/mo1308-phase3b/`)

| File | Role |
|---|---|
| `audit.mjs` | the audit functions, one per property; each returns `{problems, observed}` |
| `assemble.mjs` | three independent assemblers of the production path set: A from git objects, B from `git archive` parsed by our own tar reader, C from a clean worktree under `core.autocrlf=true|false` (the repository's `.gitattributes` is checked out with it, because `eol=lf` is what keeps the bytes identical) |
| `tar.mjs` | canonical USTAR archive written two independent ways (`writeTarA`, `writeTarB`) and a reader |
| `smoke.mjs` | the offline smoke driver: a fixed 8-command history CLI sequence, run from an extracted closure and from the working tree |
| `cases.mjs` | the implementation of all 26 cases (nothing is host-only) |
| `baseline.json`, `pin-baseline.mjs` | the pinned released baseline: the seven `memoryos-1.3-*` tags, the six released closure roots with the recorded post-tag differences, the four vendored SDK copies, the MO-1307 package identity |
| `campaign.mjs` | the command line: `rehearse`, and `seal` / `run` / `close` for the certifying generation |

## 3. Cases and what each does

| Step | Cases |
|---|---|
| A lineage and allowlist | A1 candidate identity reproducible and B2 an ancestor. A2 B2 and BF ancestry, the history anchors, no octopus merges, the Freeze at the audited commit starts with the Freeze at B2 (append-only) and A1 to A7 are intact in order. A3 every path changed since BF is in the allowed set. A4 released documents, evidence and closure roots are changed only by additions. |
| B released closure identity | B1 the four vendored SDK copies equal the release blob. B2 the MO-1302 Action trees equal the tag trees and all 42 rows of its distribution manifest verify. B3 the vscode, mcp, rest and ci closures equal BF, and differ from their tags only by the recorded post-tag differences (two documentation files of MO-1303). B4 the MO-1307 package: 89 members, the package identity `sha256:0890ca48…` recomputed from the tree, the 88 manifest rows, and the recorded archive's members equal to the tree. B5 the tags: same set, same annotated tag objects, same peeled commits; two are recorded independently in the Freeze. |
| C dependency audit | C1 no dependency manifest added or removed; only `version` and `scripts` of a `package.json` may differ and the CLI version is `1.2.0`; no lockfile or vcpkg change. C2 the production closure imports only `node:fs`, `node:path` and repository files. C3 the three history modules import only the owner modules the Freeze allows, never the SDK or the Core. C4 a forbidden-identifier scan (`process`, `require`, `fetch`, timers, file I/O words) of the history modules and the SDK, and a runtime proof under the Node permission model: the in-memory history flow runs with reads limited to the closure and no write, child process or out-of-closure read possible. C5 licenses and notices unchanged; the hand-written SHA-256 is in exactly `mip-canonical.js` and `memoryos-history-admission.js`; no `node:crypto`. |
| D source closure | D1, D2 the static import closure of the CLI and of the SDK equals the set Node actually loads from the extracted closure. D3 the closure equals the candidate identity. D4 the closure manifest (path, mode, size, SHA-256, blob id) and its digest are written as an artifact. |
| E reproducibility | E1 the object and `git archive` assemblies agree. E2 clean worktrees with `core.autocrlf=true` and `false` agree. E3 the two archive writers give byte-identical archives (digest recorded). |
| F offline smoke | F1 the closure is extracted into an empty directory; `init`, three `append`s, `verify`, `query`, `export`, `verify-export` all succeed with a stripped environment. F2 the outputs, ledger and export are byte-identical to the working-tree run (after proving the working tree equals the candidate). |
| G provenance | G1 Node, git and Python versions and the Node executable hash; for a certifying run the pinned Node v24.21.0 and native Windows x64 are required. G2 no network module, no package manager, no `node_modules`. G3 the license statement artifact: all first-party, no third party, no SBOM. |

## 4. Running it

```text
# once, before any run (outside the audit, which uses no network): fetch the tags
git fetch origin --tags

# a non-certifying rehearsal, anywhere (about 12 s in the cloud); writes to DIR only
node repositories/cca-conformance/tools/mo1308-phase3b/campaign.mjs rehearse --out DIR [--commit SHA]

# the certifying one-shot, on the reference host, only after a recorded harness review is bound
node .../campaign.mjs seal --generation phase3b --review REVIEW.json
node .../campaign.mjs run  --generation phase3b --segment main
node .../campaign.mjs close --generation phase3b
```

3B runs last on the host (3A, 3C, 3B, then the 3D validator), on the final candidate. The audited commit is `--commit` (default
`HEAD`) and must descend from B2 without touching a production path.

## 5. Rehearsal result (cloud, Linux, Node v22.22.0, non-certifying)

`REHEARSAL_COMPLETED`: 26 of 26 cases PASS, no host-only declaration, its own evidence re-derives with no problem. The pinned
baseline reproduces from the fetched tags. The shared tests and `tests/mo1308_phase3b_test.mjs` (21 tests, which also run every
audit against deliberately damaged commits) pass. The rehearsal is not evidence and not promotable.

Findings of the authoring, none of them a product defect:

- The history modules import no SDK or Core, but the transitive closure of their owner modules (Policy engine, Regression source)
  reaches `investigation-core.js`. C3 records it as an observation; the Freeze rule is about the history modules' own imports.
- `core.autocrlf=true` rewrites line endings in a checkout that lacks the repository's `.gitattributes`. A real clone carries it,
  and E2 checks that the production bytes are identical under both settings when it does.
- The history store lstat()s every ancestor of a ledger path (H40), which the Node permission model cannot grant without opening
  the whole subtree. The offline smoke therefore proves closure completeness by construction (an extracted closure with no
  repository around it), and the permission model is used only for the C4 in-memory proof.
- The MO-1307 "package identity" `0890ca48…` is the SHA-256 of the canonical member rows, not of the archive; the archive itself is
  pinned separately.

## 6. Limits and disclosures

- Independent ground truth for tag objects exists only for `memoryos-1.3-mo1302` and `memoryos-1.3-mo1307` (Freeze section 24 and
  section 1.2); the other five are pinned from the tags as fetched and are trust-on-first-use.
- B3 accepts two documentation differences of MO-1303 recorded in `baseline.json` (`CHANGELOG.md`, `README.md`), unchanged since BF.
- The certifying run needs the pinned Node and native Windows; the cloud rehearsal is on Linux and Node v22.

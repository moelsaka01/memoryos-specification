# MemoryOS 1.1 RC-001B Repository Audit

## Purpose

This record closes the repository-organization portion of RC-001B. The audit
treated the workspace as a public release candidate and reviewed structure,
navigation, naming, version identity, documentation ownership, media,
duplicates, obsolete artifacts, ignored output, and Git publication state.

RC-001B changed documentation and repository organization only. It did not
change runtime, UI, JavaScript, C++, tests, public APIs, specifications, or
architecture.

## Release identity

| Identifier | Canonical meaning |
| :--- | :--- |
| MemoryOS 1.1 | Public product release name |
| 1.1.0 | Target semantic version |
| `v1.1.0` | Reserved final tag name; not yet presented as published |
| Release Candidate | Current product status |
| MO-1101 through MO-1108 | Completed implementation milestones |
| RC-001 | Completed production workflow validation gate |
| RC-001A | Completed documentation-freeze gate |
| RC-001B | Repository audit and publication-integrity gate |

The canonical milestone names are Stable Semantic World, Cognitive Trace,
Living Connectome, Cognitive Replay, Cognitive Polish, Cognitive Evolution,
Comparative Reconstruction, and Integration & Workflow Unification.
Engineering Excellence remains MO-1108 evidence, not a ninth milestone.

## Repository audit report

### Public root

The root contains the build and contribution controls plus six distinct public
records. Their responsibilities no longer overlap:

| File | Responsibility |
| :--- | :--- |
| `README.md` | Five-minute product landing page, onboarding, navigation, build, and run path |
| `CHANGELOG.md` | Completed MemoryOS 1.1 milestone and RC-gate history |
| `RELEASE_NOTES.md` | Current 1.1.0 release-candidate identity, workflow, compatibility, and evidence |
| `KNOWN_ISSUES.md` | Product limitation and publication prerequisites |
| `ROADMAP.md` | Implemented foundations, release horizons, future proposals, and change rules |
| `ARCHITECTURE.md` | Workspace scope, dependency direction, and frozen foundation boundaries |

No unexpected top-level temporary, backup, patch-reject, editor-swap, or OS
junk file remains. The root-anchored ignore rules correctly exclude generated
output while allowing legitimate lowercase `testing` source directories.

### Navigation

The root README now provides a direct repository map. Runtime and CP-001
through CP-010 live under `repositories/cca-core`; CP-011 and the MemoryOS 1.1
Studio live under `repositories/cca-studio`; engineering documentation lives
under `docs`; and the canonical compiler format lives under `specification`.
Deep repository READMEs link back to the product landing page and workspace
documentation.

### Git publication state

The audit found 189 tracked files and 323 trackable untracked files. The
untracked publication set includes 149 `cca-core` files, 170 `cca-studio`
files, three root release records, and one additional workspace artifact.
Those files are not ignored, but the current Git `HEAD` does not contain them.

No staging, commit, or tag was created during RC-001B. A release operator must
review and intentionally add the complete publication set, then verify a clean
checkout or source archive. Publishing the current `HEAD` would omit most of
MemoryOS 1.1 and is a release blocker.

The ignored `out/` tree contains 32,123 local build/dependency artifacts and
approximately 8.6 GB of non-release data. It remains correctly ignored. A
release must be produced from a clean tracked checkout or archive, never by
zipping the working directory.

### Independent conformance

The frozen CCA-STUDIO-1.0 authority package cited by the Studio conformance
record is not materialized in this checkout. The evidence report now states
that limitation explicitly. The authority must be published under a governed
path or linked at an immutable external version before requirement
traceability is independently reproducible.

## Repository cleanup report

RC-001B performed the following repository-only cleanup:

- removed `repositories/cca-core/NUL`, a 4,110,781-byte accidental compiler
  preprocessor dump using a Windows-reserved filename;
- removed the orphan Studio-local release-note duplicate and retained the root
  `RELEASE_NOTES.md` as the sole canonical release record;
- moved 49 ordered capture inputs into four named
  `docs/media/source-frames/` sets;
- moved 18 unreferenced pre-1.1 design and QA captures out of the active
  screenshot surface into a documented archive;
- removed one byte-identical abandoned screenshot copy while retaining its
  archive twin;
- renamed 80 JPEG-encoded files from misleading `.png` names to truthful
  `.jpg` names and updated all inbound documentation references; and
- added media and archive manifests defining retention and publication rules.

After cleanup, all 21 `.png`, 80 `.jpg`, and eight `.gif` files match their
declared formats. The active `docs/screenshots/` directory contains 30 assets,
all cited by release or milestone documentation.

The removed preprocessor dump was generated output and is reproducible from
the compiler invocation that created it. The pruned screenshot remains
recoverable byte-for-byte from the retained identical archive asset. No
product implementation was removed.

## Duplicate asset report

The initial media inventory contained 13 exact-hash duplicate groups. RC-001B
removed the one redundant pair with no documentation or capture-sequence
purpose. No duplicate Markdown document or GIF exists.

Twelve exact-hash pairs remain intentionally: each is an ordered GIF source
frame that is also used as a canonical documented still. Source frames are
production inputs, not public release deliverables, and are separated under
`media/source-frames/`. The [media manifest](media/README.md) records this
boundary. Current MemoryOS 1.1 release screenshots and GIFs have one canonical
public path each.

## Obsolete artifact report

| Finding | Resolution |
| :--- | :--- |
| Windows-reserved `NUL` preprocessor output | Removed |
| Studio-local duplicate release note | Removed; root record is canonical |
| Unreferenced pre-1.1 captures beside current screenshots | Moved to the documented historical archive |
| Raw frames mixed with release GIFs | Moved to documented source-frame sets |
| JPEG files named `.png` | Renamed to `.jpg`; references updated |
| Generic temporary, backup, swap, reject, and OS files | None found outside ignored build output |
| Ignored `out/` build tree | Retained locally, excluded from publication |

## Validation results

- Workspace structure verification passed with
  `tools/verify_workspace.py --root .`.
- 593 Markdown and HTML references across 105 documents were inspected; all
  583 local references resolve.
- All 109 media files match their declared PNG, JPEG, or GIF encoding.
- All 42 public screenshot/GIF assets are referenced and have zero exact-hash
  duplicate groups.
- CHANGELOG contains exactly one heading for every MO-1101 through MO-1108
  milestone.
- No Windows-reserved device filename or generic temporary artifact remains
  outside ignored build output.
- `git diff --check` reports no whitespace error. Git emits only the existing
  Windows line-ending notices.

## Final repository checklist

- [x] Root documents have distinct, linked responsibilities.
- [x] A first-time visitor can locate runtime, Studio, documentation, and the
  canonical compiler specification from the landing page.
- [x] MemoryOS 1.1, target 1.1.0, `v1.1.0`, RC gates, and MO-1101 through
  MO-1108 use explicit, non-conflicting meanings.
- [x] Current release screenshots and GIFs are canonical and referenced.
- [x] Historical captures and raw source frames are intentionally separated.
- [x] File extensions match encoded media formats.
- [x] No duplicate documentation or duplicate release GIF exists.
- [x] No implementation, runtime, UI, test, API, specification, or architecture
  file changed during RC-001B.
- [ ] An authorized owner has selected and recorded a software license.
- [ ] The complete trackable publication set has been reviewed and added to
  Git, then validated from a clean checkout or source archive.
- [ ] The frozen CCA-STUDIO-1.0 authority package is available at a governed,
  immutable location for independent conformance review.

## Assessment

Repository organization and public navigation are complete. MemoryOS 1.1 is
not yet ready for public publication because licensing, Git publication state,
and authoritative conformance-package availability require owner or release
authority outside this documentation-only sprint. These blockers do not affect
runtime behavior, determinism, or the implemented MemoryOS 1.1 capabilities.

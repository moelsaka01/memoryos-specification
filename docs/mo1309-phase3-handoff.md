# MO-1309 handoff — phase 3 (integration and binding B2)

Fixed template: this file opens with State, Last bound commit, Next action and
Decisions needed, and ends with the dated run log. One committed file per
phase (see [the Freeze](mo1309-contract-freeze-1.md) section 15). The run log is
appended to, never rewritten; the four fields above are replaced at each
update. The Phase 2 handoff, which lived on `claude/peaceful-gauss-62v6vi`
(`117488da`), is carried unchanged into [its own file](mo1309-phase2-handoff.md).

## State

Phase 3 (integration) COMPLETE and bound as B2. The four stream branches are merged into
`mo1309/phase3` with normal merges and no conflict. The quadratic view-model build is fixed (private change,
differential-tested, budgets only tightened). The three duplicated test-support assemblers are gone; the page,
scanner and generator tests run over the real generator output. The dashboard tests run from a separate
manifest, `cca-studio/package.json` is byte-identical to BF. The conformance inventory covers DB01–DB32 (cloud
coverage for all 32; 24 requirements also need Windows campaigns (4A, 4B or 4C)). Cloud rehearsals of 4A, 4B, 4C and the 4D
validator pass or fail as they must and are **non-certifying**. No Windows result exists and none is claimed.
No STOP condition occurred. DB26 holds: no MO-1308 production blob changed across the milestone.

## Last bound commit

`0f27cbbc` on `mo1309/phase3` is the Phase 3 product and evidence commit; this handoff is a docs-only commit on top
of it, and that handoff commit is **B2** (the head of `mo1309/phase3` and, after the fast-forward, of `main`).
Baselines: Phase 1 `2da41aca`; streams 2A `6956c650`, 2B `2d0b66fe`, 2C `f406b4eb`, 2D `f53fda8e` (all verified
against the branch heads); BF `bf2fdc87` (tag `memoryos-1.3-mo1308`, an ancestor); `main` before B2 `2381e424`.

## Next action

**Phase 4 on the Windows host.** The full ordered plan, preconditions, failure handling and the list of every
Windows-only part is [docs/mo1309-phase4-windows-plan.md](mo1309-phase4-windows-plan.md). In short, on Windows 11 x64
with Node.js v24.21.0 exactly, a Chromium-family browser (`MO1309_BROWSER` if needed) and a fresh clone at B2
(clean tree, full history):

1. W1 — the 2D Windows run ([prepared run](mo1309-phase2d-windows-run.md)): three `memoryos-dashboard-perf.mjs` commands from `repositories/cca-studio`; retain both reports and their SHA-256.
2. W2 — 4A end to end on `mo1309/phase4a-e2e`: `node repositories/cca-conformance/tools/mo1309/campaigns.mjs 4a --certifying --full --out repositories/cca-conformance/evidence/mo1309/4a/gen-1`.
3. W3 — 4B closure and supply on `mo1309/phase4b-closure`: `campaigns.mjs 4b --certifying --out .../4b/gen-1`.
4. W4 — 4C security and trust wording on `mo1309/phase4c-trust`: `campaigns.mjs 4c --certifying --out .../4c/gen-1`.
5. W5 — retained regression on `mo1309/phase4d`: `tools/mo1309/run-tests.mjs --out .../evidence/mo1309/regression` (every suite once; each rerun is its own row and log).
6. W6 — differential gate on Windows: `tools/mo1309/differential-gate.mjs` and the A3.2 CTest differential (preset `default`, `-E "^cca_core_tests_NOT_BUILT$"`, BF versus candidate, identical toolchain).
7. W7 — 4D: author `docs/mo1309-release-disclosures.md`, `tools/mo1309/assemble-final.mjs`, commit I3, `tools/mo1309/validate.mjs` (expect `I3_VALID_PENDING_BF`), commit the binding-only BF (`mo1309-final-binding.json`), validate again (`CERTIFIED_READY_TO_TAG`), then the human tag review. No tag is created by any tool.

Windows-only (not establishable in the cloud): certifying status of every 4A/4B/4C case (DB29); 4A-E1 to E3 NTFS CLI exports;
4A-E4 certified-scale budget check on the reference host; 4A-E5/E9 byte comparison and exclusive-publication failure paths on NTFS;
4A-E6/E7 `file://` versus HTTP, keyboard, 200% zoom and 320/768/1280 in the Windows browser; 4A-E8 the 100,000-entry characterization;
4B-C1 to C4 on a Windows checkout; 4C-S1 to S6 rendered on Windows, including a real directory swap during the read; the A3.2 CTest differential
(MSVC, vcpkg, GoogleTest; `cca_core_tests`, the 112 `*AllocationFailureTest` cases, `memoryos.sdk.*`, `memoryos.standard.runtime.reference`); the
`cca.workspace.verify` rule of A3.2; the 4D validator on the real final record; the human tag review.

## Decisions needed

None blocking. For the owner's awareness: (1) the Freeze names "binding B2" in its phase table without defining the
mechanism; B2 was taken to follow the Phase 1 pattern (product and evidence commit, then a docs-only binding commit,
fast-forward of `main` after an ancestry check, no tag) under Freeze section 14 rule 3 — no behaviour depends on the
name. (2) Of 25 conformance units that fail on BF and on the candidate alike, 6 are `undetermined` in the cloud (see the gate
receipt); they are MO-1308-era or earlier, fail identically at BF, and are for the PM item and the Windows gate, not for MO-1309.

## Run log

- 2026-10-10 — Fetched full history; verified the four stream heads and `main`. Created `mo1309/phase3` from `main`
  (`2381e424`) and merged 2A, 2B, 2C, 2D with normal merges: no conflict (the identical `memoryos-dashboard-wording.js`
  hunk on 2A and 2B merged cleanly). Carried the Phase 2 handoff from `117488da`. The merged tree passed 77/77
  dashboard tests, including the browser tests.
- 2026-10-10 — Quadratic fix. `buildDashboardViewModel` now calls `verifyHistoryExport` once and parses each verified entry once with the public
  `decodeHistoryBytes`/`validateEntry`; retention, tombstone link and stored decision consistency are taken exactly as `queryHistoryLedger`
  maps them. No MO-1308 file changed. The Phase 1 builder is kept verbatim as the test oracle. Differential (byte equality of the canonical view
  model): all five fixtures, the 1,000-entry and the 10,000-entry synthetic corpora identical. Negative controls: the comparison fails on a
  one-field divergence; chain, member, manifest, marker, truncated-tail, extra-file and removed-member tampering are rejected by both builders with the same carried MO-1308 code.
  Timings (medians, same host, quiet machine; [report](mo1309-phase3-cloud-report.json), [record section 7](mo1309-phase2d-performance.md)):
  view-model build 29.5 s to 5.35 s at 10,000 and 2,861 s to 55 s at 100,000; whole generation 36.8 s to 11.4 s at 10,000 and 49.1 min to 129.7 s at
  100,000 (characterized only, no claim); generator memory 391 to 312 MB (10,000) and 2,604 to 2,191 MB (100,000). Budgets only tightened: view-model build 150 s to
  30 s, generation 200 s to 60 s, generator memory 1,200 to 1,100 MB; the rest unchanged; the earlier values are kept in the budgets file.
- 2026-10-10 — Harness fixes (pre-authorized, logged, with negative controls). (a) HARNESS_DEFECT: closing the browser removed the profile while Chromium
  helper processes still wrote it (ENOTEMPTY aborted a measuring run twice). First attempt, retried removal: not sufficient. Root cause fixed:
  the browser is spawned in its own process group and the whole tree is killed (`taskkill /T` on Windows); a repeated launch/close test shows no
  profile left behind, and a test shows a persistently failing removal still throws. (b) Test assertions written around the stand-in assemblers
  were adjusted for the real output: the generator-version line is allowed beside the registry text, and the no-leak check compares occurrences with
  what the page sources, registry and view model already contain (the real page's CSS holds the token `root`), with a control that an added occurrence is a leak.
- 2026-10-10 — Test support. `support-dashboard-snapshot.mjs` calls the production assembler over the production page sources and adds
  `generateFixtureSnapshot` (the production generator end to end); the hand-built 2C snapshot and the 2B stand-in page were removed. A new generator test
  requires end-to-end output equal to the unit assembly for every fixture. The MO-1309 manifest is
  `repositories/cca-conformance/mo1309-test-manifest.json` (runner `tools/mo1309/run-tests.mjs`; completeness tested with a negative control).
- 2026-10-10 — Tooling in `repositories/cca-conformance/tools/mo1309/`: `audit.mjs` (DB26/DB27: only additions under MO-1309 paths and three modified documents against BF;
  every one of the 45 production blobs of the MO-1308 candidate identity unchanged; no import other than relative or `node:`; no dependency or build file),
  `inventory.mjs` (builds `mo1309-conformance-inventory.json` from the Freeze tables and the DB-tagged test titles; DB01–DB32, current), `run-tests.mjs`,
  `differential-gate.mjs`, `campaigns.mjs` (4A, 4B, 4C), `validate.mjs` (4D) and `assemble-final.mjs`; 29 tests in the `mo1309-tools` suite.
- 2026-10-10 — Retained regression ([rows](../repositories/cca-conformance/evidence/mo1309/phase3-regression/rows.json)): seven rows, each bound to its own log: dashboard-unit
  75/75, dashboard-browser 13/13 (run 1 and, as its own row, run 2), dashboard-differential-10k 1/1, mo1309-tools 29/29 (run 1 and, as its own row, run 2 at a later commit), studio-existing
  (`npm test`, unchanged) 358/358.
- 2026-10-10 — Differential no-regression gate against BF `bf2fdc87` (A3.2 style, Node-driven units only; the CTest part needs the Windows toolchain).
  Generation 1 `FAILED_PRESERVED` = HARNESS_DEFECT of the gate's own rule (it demanded identical failure sets; the candidate fails one test fewer than BF in
  `mo1308_phase3d_test`); preserved with a disposition in `phase3-differential-node-g1/`. Generation 2: 99 units at BF, 104 at the candidate (5 new MO-1309 units pass), 0 regressions,
  0 new failures, 25 shared failures listed PRE_EXISTING (15 tag/lineage/Standard-clone dependent, 4 missing Node dependencies, 6 undetermined, all failing identically at BF), the workspace verifier
  fails identically on both sides: verdict `PASS_QUALIFIED_CLOUD_SUBSET`, never a plain PASS.
- 2026-10-10 — Rehearsals (non-certifying; `evidence/mo1309/phase3-rehearsal/`): 4A passes except 4A-E8 (REHEARSED_ONLY), 4B passes, 4C passes; each receipt lists every
  Windows-only part. A certifying run is refused here (platform, Node version, clean tree, new evidence directory). The 4D validator over the assembled rehearsal record is
  `NOT_READY` as it must be (the retained-regression rule passes on the real rows; the stream, coverage, trust and disclosure rules fail because nothing is certifying).
- 2026-10-10 — B2. ROADMAP status updated (documentation-only). This handoff committed on top of `0f27cbbc`; ancestry of `main` (`2381e424`) checked; `main` fast-forwarded to B2, never forced; no tag.

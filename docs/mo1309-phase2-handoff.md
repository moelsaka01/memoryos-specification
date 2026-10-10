# MO-1309 handoff — phase 2 (streams 2A, 2B, 2C, 2D)

Fixed template: this file opens with State, Last bound commit, Next action and
Decisions needed, and ends with the dated run log. One committed file per
phase (see [the Freeze](mo1309-contract-freeze-1.md) section 15). The run log is
appended to, never rewritten; the four fields above are replaced at each
update. This file lives on the session branch `claude/peaceful-gauss-62v6vi`,
not on the four stream branches, so that the streams keep disjoint files.

## State

All four streams (2A UI, 2B generator/loader, 2C trust review, 2D performance)
COMPLETE and bound. Certified scale fixed at 10,000 entries; 100,000 entries
characterized only. The Windows characterization run is prepared and has not
been run. No STOP condition occurred; no extra generation was needed.

## Last bound commit

| Stream | Branch | Bound commit |
|---|---|---|
| Phase 1 (base of every stream) | `mo1309/phase1` | `2da41aca` |
| 2A UI | `mo1309/phase2a-ui` | `6956c650` |
| 2B generator/loader | `mo1309/phase2b-build` | `2d0b66fe` |
| 2C security/trust | `mo1309/phase2c-trust` | `f406b4eb` |
| 2D performance | `mo1309/phase2d-perf` | `f53fda8e` |

## Next action

Phase 3 integration

## Decisions needed

None.

## Run log

- 2026-10-10 — Fetched full history. Bound Phase 1 commit taken from
  `mo1309-phase1-handoff.md`: `2da41aca` (the handoff-only commit `2381e424`
  sits on top). Each stream branch was created from `2da41aca`. `main` and
  tags are not touched: the push authorization names only the four stream
  branches, and `main` cannot fast-forward onto a stream while the others are
  independent, so the `main` fast-forward belongs to Phase 3.
- 2026-10-10 — 2A. Page sources `web/dashboard/page.{html,css,js}` (classic
  script, no dependency, no network or storage API, text-only DOM writes,
  closed attribute list, registry-only chrome); test assembler and
  DevTools-protocol harness on Node built-ins (`tests/support-devtools.mjs`);
  `memoryos_dashboard_page_test.mjs` (9) and
  `memoryos_dashboard_browser_test.mjs` (13) in the preinstalled Chromium
  (Node 22.22.0 in the cloud; the Freeze's Node 24.21.0 applies to Phase 4).
  Requirements: DB05–DB08, DB12–DB17, DB23–DB25 (cloud part).
  Harness decision, no policy change: Chrome DevTools evaluation is itself
  exempt from page CSP, so the CSP test probes with page-run string timers,
  with a negative control proving the probe runs without the policy.
  Phase 1 file touched: `memoryos-dashboard-wording.js` gained four registry
  keys (`observation.*`, `statement.scriptRequired`, `page.updated`); the
  identical hunk is on 2B so the merge is clean. `npm test` in `cca-studio`
  358/358 unchanged.
- 2026-10-10 — 2B. `web/js/memoryos-dashboard-snapshot.js` (pure assembler) and
  `scripts/memoryos-dashboard-generator.mjs` (lstat listing and limit check,
  one read per file with fstat identity check, `buildDashboardViewModel` over
  the in-memory bytes, exclusive staging plus hard-link publication, typed
  errors, one-line stderr). 14 tests (`memoryos_dashboard_generator_test.mjs`)
  use stand-in page sources (the real page is on 2A). Requirements DB01–DB05,
  DB09, DB18–DB21. Cross-stream check in an unpushed scratch merge of 2A and 2B:
  the generator's output is byte-identical to the 2A test assembler for every
  fixture, and all 62 dashboard tests pass.
- 2026-10-10 — 2C. `docs/mo1309-phase2c-trust-review.md` (H40/A6 re-review
  confirmed unchanged, 21-threat model, data-class rules), pure scanner
  `web/js/memoryos-dashboard-dataclass.js` with one negative control per rule
  and structural H40/A6 source checks (`memoryos_dashboard_trust_test.mjs`, 9).
  Requirements DB28, DB19, DB04 (scan rules), DB05/DB06 (scan rules). Running
  the scanner over real generator output in a scratch merge of 2A+2B+2C found
  three over-tight rules (extra viewport meta; short user name `root`; member
  text the view model legitimately repeats); fixed in the scanner and the doc
  (commits on 2C), after which all five fixtures scan clean and all 71
  dashboard tests of the merged tree pass.
- Phase 3 notes: replace the three duplicated assemblers in test support
  (`support-dashboard-snapshot.mjs`, `support-dashboard-mini-snapshot.mjs`,
  stand-in page) with the real generator output; the `main` fast-forward;
  wire dashboard tests into a manifest (Phase 1 note).
- 2026-10-10 — 2D. Corpus builder, runner and budget evaluator in
  `scripts/memoryos-dashboard-perf*.mjs`; records
  `docs/mo1309-phase2d-{performance.md,cloud-report.json,budgets.json,windows-run.md}`;
  6 tests. Corpora are synthetic (MO-1308 identity primitives plus
  `buildHistoryExport`, accepted by `verifyHistoryExport`; the released exporter
  needs about 16 min for 100,000 entries), measured in a throwaway merge of the 2D
  tip, 2A and 2B. Cloud medians: 1,000 entries generation 1.7 s, 0.92 MB, load
  0.09 s; 10,000 entries generation 36.8 s, 8.9 MB, load 0.29 s; 100,000 entries
  (one run, characterized only) generation 2,944 s, 2.6 GB, 88.8 MB, load 4.35 s.
  Certified scale 10,000; budgets recorded from the worst of five runs
  (factors in the performance record section 4). Finding for Phase 3 and the
  owner, not a STOP: the view-model build is quadratic (about entries/1000 chain
  verifications because every `queryHistoryLedger` page re-verifies the chain:
  29.5 s at 10,000, 2,861 s at 100,000); a private fix with a differential test is
  possible without any public-behaviour change. The Windows run is prepared in
  `docs/mo1309-phase2d-windows-run.md`; no Windows result is claimed.
- 2026-10-10 — Cross-stream check: an unpushed octopus merge of the four stream
  tips merges without conflict; 77/77 dashboard tests pass (including the
  browser tests), `npm test` in `cca-studio` 358/358, and no stream changes an
  MO-1308 module, a package manifest, a lockfile or ARCHITECTURE.md relative to
  `2da41aca`. `main` and tags untouched.

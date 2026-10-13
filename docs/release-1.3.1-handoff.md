# MemoryOS 1.3.1 handoff — Studio History screen

Fixed template: this file opens with State, Last bound commit, Next action and
Decisions needed, and ends with the dated run log. One committed file for the
release (see [the Freeze](mo1310-studio-history-1.3.1.md) section 13). The run
log is appended to, never rewritten; the four fields above are replaced at each
update.
Resume with: "Read docs/release-1.3.1-handoff.md and continue the 1.3.1 run to completion".

## State

Steps 1 to 3 COMPLETE. Freeze 1 FROZEN (`89d87a95`). Build and integration done and bound as **B** on `release-1.3.1/build`: ARCHITECTURE clauses, the Studio History entry and screen, the 1.3.1 tests (22 unit/closure/differential, 9 Chromium), the conformance inventory (SH01 to SH24 covered), the retained cloud regression record (each suite once, own row and log) and the prepared one-shot Windows campaign (17 cases), rehearsed here as **non-certifying** (all pass). No Windows result exists and none is claimed. No STOP condition occurred. No tag was created.

Findings recorded: (1) the released MO-1308 modules reference `SharedArrayBuffer` unguarded, so the verifier throws in a page that is not cross-origin isolated; Studio uses a scoped stand-in (no MO-1308 byte changed; Q-SAB-STANDIN). (2) In the cloud, mo1308 (8 failures), MO-1307 (122 failures) and two MO-1309 tooling tests fail with names identical to v1.3.0 (comparison in the rehearsal evidence); MO-1307 is 639/639 only on Windows. (3) Two existing MO-1309 test expectations were updated for the permitted refactor/clause (generator import list; ARCHITECTURE MO-1309 count 2 to 4), negative controls kept. (4) `app.js` loads the screen with one dynamic import (private detail).

## Last bound commit

Product commit `c0c06c1b`; evidence commits follow; this handoff is a docs-only commit on top and is **B**, the head of `release-1.3.1/build` and, after the fast-forward, of `main` (recorded in the final report). Baseline: tag `v1.3.0` → `889f99e7`; `main` before B: Freeze `89d87a95`.

## Next action

The Windows run, in order, from binding B in PowerShell: [docs/release-1.3.1-windows-plan.md](release-1.3.1-windows-plan.md) — W1 the campaign (`node repositories/cca-conformance/tools/mo1310/campaign.mjs --certifying --out repositories/cca-conformance/evidence/mo1310/campaign/gen-1`), W2 retained regression, W3 differential gate against `889f99e7`, W4 disclosures, I3, validator, binding-only BF, then the human tag review for `v1.3.1`.

## Decisions needed

None.

## Run log

- 2026-10-13 — Fetched full history and tags; verified `v1.3.0` peels to
  `889f99e7` and `main` = `origin/main` = `0e229ba0` (one release-description
  document after the tag). Studio baseline `npm test` 358/358 (Node v22.22.0).
  Created `release-1.3.1/freeze`: Freeze 1 (authority and freeze in one
  document), this handoff, ROADMAP row. Scripted checks: no OPEN entry in the
  register; `git diff --check`; relative links resolve; changed-path set.
  Self-approval rule met: Freeze marked FROZEN; `main` fast-forward follows.
- 2026-10-13 — Freeze committed as `89d87a95` and `main` fast-forwarded (`0e229ba0` → `89d87a95`) after an ancestry check.
- 2026-10-13 — Step 2/3 on `release-1.3.1/build`: product commit `c0c06c1b` (bounds extraction with golden digests recorded from the unrefactored v1.3.0 generator first; reader, verify stand-in, registry, screen, derived page, frame page, serve.mjs header, ARCHITECTURE; tests; conformance tooling). Harness note (section 12 rule 1): the browser helper waits for the NEW outcome node after a choice (a stale status raced the first version; 8 consecutive green runs after the fix). Cloud retained regression (Linux, Node v22.22.0): studio-history 22/22, studio-history-browser 9/9, studio-existing 358/358, cli exit 0, mo1309-dashboard-unit 75/75, -browser 13/13, -differential-10k 1/1, mo1309-tools 21/21, mo1310-tools 7/7; mo1308 208/221 (8), mo1307 517/639 (122) and mo1309-baseline-bound 9/11 (2) fail with names identical to v1.3.0. Campaign rehearsal: 17/17 PASS, non-certifying.

- 2026-10-13 — Windows run on `C:\r131` (worktree at B `1d77559b`; Windows 11 10.0.26200 x64, Node v24.21.0 SHA-256 ba4e6d11…6c32, Python 3.14.4, Edge 155.0.4283.45 at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`). Step W1: the first launch failed before any output (parent `evidence/mo1310/campaign/` absent; the tool creates only the leaf; no certifying output existed, nothing consumed); parent created, `gen-1` run once: SH ACCEPTED, 17/17 PASS (commit `ee11ba33`). Operator observation Q-NATIVE-PICKER (real CLI export, native folder dialog in Edge at http://127.0.0.1:4173/): the user reported "worked as expected" (dialog opened, folder chosen, confirmation prompt shown, verified dashboard displayed); no prompt wording was supplied.

- 2026-10-13 — Step W2 (retained regression, commit `bfdd6315`, each suite once, label `windows`, 07:12–08:40 +04): studio-history 22/22, studio-history-browser 9/9, studio-existing 358/358, cli 91/91, mo1308 214/221 (7 failing: A01, A02, B01, B02, N07, S03, D03 — tree/lineage audits against the MO-1308 BF; the cloud record had the same names at v1.3.0 plus one more), mo1309-dashboard-unit 75/75, -browser 13/13, -differential-10k 1/1, mo1309-tools 21/21, mo1309-baseline-bound 9/11 (pinned, identical to v1.3.0), mo1310-tools 7/7, MO-1307 strict 639/639 (strict count met). The tool exits 1 only because mo1308 is not a pinned suite; the Windows base-versus-candidate comparison is made by the W3 differential gate.

- 2026-10-13 — Step W3 (differential gate vs v1.3.0 `889f99e7`, Node subset, fresh worktrees `C:\t131b` and `C:\t131c`, `npm ci --ignore-scripts` in the five lockfile directories of each; candidate `bbee6e5a`): verdict `PASS_QUALIFIED_CLOUD_SUBSET`, base 104 units, candidate 105 (1 new), 0 regressions, 0 new failures, 14 pre-existing (identical at v1.3.0). The C++ CTest run is skipped on the SH-C1 receipt of campaign gen-1 (`nativeChangeProof`, no C, C++, CMake or vcpkg path changed).

- 2026-10-13 — Step W4: disclosures `docs/mo1310-release-disclosures.md` (commit `4df312b4`; Q-SAB-STANDIN, Q-STATIC-FILES with the pinned request set, Q-FOLDER-ACCESS, Q-NATIVE-PICKER with the operator observation, Q-MO1309-BASELINE-BOUND, Q-MO1308-TREE-AUDITS, Q-GATE-NODE). Final record assembled with candidate `c0c06c1b`, one generation (`gen-1`), the regression rows and the differential receipt; committed as I3 together with this entry.

- 2026-10-13 — **STOP at the validator (owner decision needed).** I3 is committed (`355e522b`). `validate.mjs` result: `NOT_READY`; SH-D1, D2, D3, D5, D6 pass; **SH-D4 fails: "mo1308: no passing row"**. On this Windows host the mo1308 suite (run once, row 5, commit `bfdd6315`) is 214/221 with 7 failures (A01, A02, B01, B02, N07, S03, D03: tree, lineage and changed-path audits against the MO-1308 BF). `repositories/cca-conformance/mo1310-test-manifest.json` requires a passing row for mo1308 (only `mo1309-baseline-bound` is pinned as `expectedFailing`). The cloud rehearsal already showed mo1308 failing with names identical to v1.3.0 (8 there). Making SH-D4 pass would mean changing the acceptance manifest (pinning mo1308 at 214/221, ideally after a Windows run of mo1308 at the v1.3.0 tree `C:\t131b` shows identical failures). That changes what the validator accepts, so it is not taken under the harness pre-authorization without the owner. No BF was committed; no tag was created.

- 2026-10-13 — **Owner decision OD-1 (recorded; also in `docs/mo1310-release-disclosures.md`).** Pin the seven mo1308 failures (A01, A02, B01, B02, N07, S03, D03) as known baseline failures, by exact test name, with proof and a negative control. The differential gate did not cover them (units `mo1308_phase3b`/`3d` were killed by its unit limit, 0 tests compared), so mo1308 was run once at the v1.3.0 tree `C:\t131b` on this host (09:39–11:02 UTC): 221 tests, 214 pass, 7 fail, the same seven names (`evidence/mo1310/baseline-mo1308/`). Harness change under the pre-authorization: `tools/mo1310/known-failures.mjs`, `validate.mjs` and `run-tests.mjs` accept `expectedFailingTests`; manifest pin for `mo1308`; tests and negative controls in `tests/mo1310_tools_test.mjs` (8/8); inventory regenerated (`inventory.mjs check`: current). Next: new I3, validate (expect I3_VALID_PENDING_BF), binding-only BF, validate (expect CERTIFIED_READY_TO_TAG).

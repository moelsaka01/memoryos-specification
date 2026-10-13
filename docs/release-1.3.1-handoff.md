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

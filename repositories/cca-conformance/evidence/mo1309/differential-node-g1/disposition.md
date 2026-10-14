# Node differential gate (W6, Node-driven units) — generation 1 disposition

Result: `FAILED_PRESERVED`, preserved unchanged. Receipt `receipt.json` (BASELINE BF `bf2fdc87`, CANDIDATE `1026dce7`, prepared trees `C:\n7b` and `C:\n7c` with `npm ci --ignore-scripts` from the lockfiles, Windows 11 x64, Node v24.21.0). 99 units at BASELINE, 104 at the candidate (5 new MO-1309 units).

Cause of the verdict: rule 3 (a unit present only on the candidate fails): `conformance:mo1309_campaigns_test.mjs` exit 1, test "DB29 a certifying run is refused ...", "Missing expected rejection". No regression (rule 2) and no new failure among the 15 shared failures (rule 4).

Classification: **HARNESS_DEFECT** (Freeze section 14.2): the test's second assertion probed a not-yet-existing directory under `evidence/mo1309/`; the guard refuses it only because the tree is dirty or the host is not Windows. On a clean Windows 11 checkout with Node 24.21.0 the probe was accepted and the test ran a real certifying 4B campaign into `evidence/mo1309/x` of the throwaway candidate tree `C:\n7c` (not retained, not in any record). In the Phase 4 W5 run the tree was dirty, so the defect did not show there. No product byte is involved.

Fix (tooling only, section 14.1, commit `74be815b`): the probe is the existing tracked directory `evidence/mo1309/phase3-rehearsal`, which must be refused with "output directory exists (one-shot)". Negative control: that assertion fails if the existing-directory refusal is removed or loosened; the test can no longer start a campaign. Generation 2 repeats the whole gate (`differential-node-g2`) on a fresh pair of trees with the fixed candidate `74be815b`.

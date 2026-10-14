# MO-1308 Phase 3A: 3A-G6 swapper finding (HARNESS defect, found 2026-10-09 in rehearsal r9)

**Observed.** Rehearsal r9 failed 3A-G6 ("the swapper reported nothing (exit 1); the swapper left records.aside"); main2 stopped after step G. Dev runs of 3A-G6 alone reproduced it in 2 of 6 and later 2 of 8 runs.

**Cause (diagnosed with a temporary stderr/lstat probe, since removed).** `swapper.mjs` renames `<ledger>/records` aside and plants a junction. In the instant `records` is absent, a racing append re-creates `records` as a real directory (the accepted H40 stray creation; one hashed record file in the probe). The swapper then either fails to plant the junction (EEXIST) or, in the restore, `rename(records.aside, records)` fails with EPERM because a real directory is already there; the uncaught error left `records.aside` behind and the ledger broken (every later append LEDGER_CORRUPT). Not a product defect: the product behaved as in the accepted H40 class, and the case's assertions (outside content unchanged, only typed failures, records a real directory at the end, final verify passes or fails closed typed) are unchanged.

**Classification.** HARNESS defect (swapper robustness), inside the pre-authorized class; no check was loosened.

**Correction (`tools/mo1308-phase3a/swapper.mjs`).** Removing the junction and the restore are retried (bounded, 60 s) on EPERM/EBUSY/EACCES; a stray real `records` directory found at restore time is merged into the saved directory (an existing name is kept) and removed before the rename back; an EEXIST at planting counts as a refused swap. The report carries `refusedRestores` and `strayRecords`. 3A-G6 alone: 12 of 12 runs PASS after the fix. The 3A independent review must cover this change (3A harness bytes changed again).

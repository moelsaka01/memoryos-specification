# MO-1309 differential gate — classification of the cloud's "undetermined" shared failures

Source: the cloud gate generation 2 receipt (`repositories/cca-conformance/evidence/mo1309/phase3-differential-node-g2/receipt.json`, Linux, Node 22.22.0) and the Windows Node gate generation 2 receipt (`.../differential-node-g2/receipt.json`, Windows 11 x64, Node 24.21.0, candidate `74be815b`, BF `bf2fdc87`). Every unit below fails identically at BF in the environment where it fails, so none is a regression.

The Phase 3 handoff counts 6 "undetermined" units; the cloud receipt itself lists 5 (it lists 16 tag/lineage-dependent and 4 missing-dependency units, 25 in all). The five are classified here; there is no sixth entry to classify.

| Unit | Cloud (Linux) | Windows, BF and candidate | Classification |
|---|---|---|---|
| `mo1305_phase1_conformance_test.mjs` | fails; GatewayError from `memoryos-rest` | fails on both sides: `ENOENT ... .cache/mo1305-phase3-correction/accepted-build/memoryos-rest-0.1.0.tgz` | ENVIRONMENT: an untracked build artifact under `.cache` that a fresh worktree does not have |
| `mo1305_phase3_conformance_test.mjs` | fails; GatewayError from `memoryos-rest` | fails on both sides: `ValueError: WORKSPACE` (`tools/mo1305-phase3d/common.py` requires the root to be `C:/Users/melsa/Documents/Codex/cca-workspace`) | ENVIRONMENT: hard-coded workspace path (the MO-1308 A3.2 follow-up list names it) |
| `mo1305_release_metadata_correction_test.mjs` | fails; GatewayError from `memoryos-rest` | fails on both sides: expects `CERTIFICATION_PENDING`, observes `CERTIFIED_READY_TO_TAG` | ENVIRONMENT: the expectation depends on repository tag state (the milestone tag exists in this clone); identical at BF |
| `mo1307_phase2c_supplement_test.mjs` | fails ("validation function ... returned false") | passes on both sides | PLATFORM-SPECIFIC to the cloud (Linux): not a failure on the Windows host |
| `mo1308_phase3a_test.mjs` | fails (strict-equal mismatch) | passes on both sides | PLATFORM-SPECIFIC to the cloud (Linux): not a failure on the Windows host |

On Windows the gate's shared failures are 15 units (cloud: 25); 12 are tag/lineage/Standard-clone dependent, and three (`mo1305_phase3`, `mo1308_phase3b`, `mo1308_phase3d`) are labelled `undetermined` by the gate's log matcher, classified above or in the disclosures (`mo1308_phase3b` and `mo1308_phase3d`: see the disclosures, Q-GATE-LONG-UNITS).

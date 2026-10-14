# Supplement: mo1308_phase3b / mo1308_phase3d without the gate's 900 s limit — INTERRUPTED (preserved)

Why: in Node gate generation 2 both `mo1308_phase3b_test.mjs` and `mo1308_phase3d_test.mjs` hit the gate's 900 s per-unit kill on BF and candidate alike, so they compared no tests. This supplement ran them directly (`node --test --test-reporter=tap`, trees `C:\n8b` BF and `C:\n8c` candidate `74be815b`).
Results: 3b base 892 s exit 1 (17/21 pass; A01, B02, N07, S03 fail); 3b candidate 857 s exit 1, same 4 failing tests (`# pass 17`, `# fail 4`). 3d base: started 19:38, no TAP output and about 75 CPU-seconds in 30 minutes, a child `git.exe` idle under the test: treated as a hang and stopped by hand at 20:09; log kept (4,190 bytes). 3d candidate: not run.
Classification: INTERRUPTION (3d base hang; cause inside the MO-1308 Phase 3D test's git use, not yet identified; identical unit at BF, so not an MO-1309 regression). Not a gate generation; nothing is rerun yet.

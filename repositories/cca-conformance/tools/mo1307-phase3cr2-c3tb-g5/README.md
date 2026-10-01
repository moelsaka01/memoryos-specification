# MO-1307 Phase 3CR2 C3TB G5 acceptance-only recovery

G5 is an append-only acceptance generation over the complete, immutable G4
reconciliation. It does not resume G4 and it does not change G1, G2, G3, G4,
the product, the candidate authority, or any historical witness.

G4 completed reconciliation and final evidence, then its one staged acceptance
verification failed at the fixed-Git `diff --cached --check` assertion. The
only reported violations were the additional blank line at EOF in these two
immutable sources:

- `mo1307-phase3cr2-c3tb-g4/binding-lib.mjs`, line 271;
- `mo1307-phase3cr2-c3tb-g4/recovery-static-lib.mjs`, line 551.

Both files have the exact tail bytes `207d293b0a7d0a0a`. G5 preserves those
bytes, records the failed G4 attempt, and creates a separate acceptance-only
evidence namespace. G5 sources themselves use one final newline and introduce
no additional diff-check violation.

## Fixed sequence

Use only the repository-pinned Node executable. Each writer is single-use and
creates files exclusively.

1. Run `validate-recovery.mjs --write` exactly once. It re-verifies G2, G3,
   G4, the authoritative binding, the exact G4 staging defect, and zero
   execution before creating `zero-execution-validation.json`.
2. Run `preflight.mjs --write` exactly once. It seals the exact seven-file G5
   tool closure and the exact nine planned G5 evidence paths.
3. Run `accept.mjs --write` exactly once. It creates only
   `administrative-acceptance-recovery.json` from immutable G4 evidence.
4. Run `finalize.mjs --write` exactly once. It creates the G5 receipt, final
   validation, Phase 3D handoff, evidence manifest, and final seal.
5. Stage the exact acceptance path union and run `finalize.mjs --verify-staged`.
6. Create one single-parent acceptance commit over C3TB and run
   `finalize.mjs --verify-committed`.

No G5 step launches a helper, worker, product control, security control, native
control, or network operation. Stages 1 through 8 and G4 reconciliation are not
rerun. Phase 3A, Phase 3B, and Phase 3D are not executed. Do not push or tag.

Any failure terminates G5 with `PHASE3CR2_RECONCILIATION_BLOCKER`; do not edit
or retry an already-written G5 evidence namespace in place.

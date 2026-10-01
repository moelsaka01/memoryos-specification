# MO-1307 Phase 3CR2 C3TB G6 acceptance-only recovery

G6 is an append-only acceptance generation over the complete, immutable G4
reconciliation. It does not resume G5 and it does not change G1, G2, G3, G4,
G5, the product, the candidate authority, or any historical witness.

G5 sealed validation and preflight successfully, then its one read-only
acceptance verification failed before writing administrative acceptance
evidence. The fixed-Git repository root used forward slashes while the Node
root used backslashes; G5 lowercased both values but did not normalize path
separators before exact equality at `accept.mjs`, line 312. G6 records that
failed attempt and uses a separate evidence namespace. G6 normalizes both
repository-root values to forward slashes before comparing them.

## Fixed sequence

Use only the repository-pinned Node executable. Each writer is single-use and
creates files exclusively.

1. Run `validate-recovery.mjs --write` exactly once. It re-verifies G2, G3,
   G4, G5, the authoritative binding, the exact G5 path-normalization defect,
   and zero execution before creating `zero-execution-validation.json`.
2. Run `preflight.mjs --write` exactly once. It seals the exact seven-file G6
   tool closure and the exact nine planned G6 evidence paths.
3. Run `accept.mjs --verify-only` once, then run `accept.mjs --write` exactly
   once. Only the write invocation creates
   `administrative-acceptance-recovery.json` from immutable G4 evidence.
4. Run `finalize.mjs --write` exactly once. It creates the G6 receipt, final
   validation, Phase 3D handoff, evidence manifest, and final seal.
5. Stage the exact acceptance path union and run `finalize.mjs --verify-staged`.
6. Create one single-parent acceptance commit over C3TB and run
   `finalize.mjs --verify-committed`.

No G6 step launches a helper, worker, product control, security control, native
control, or network operation. Stages 1 through 8 and G4 reconciliation are not
rerun. Phase 3A, Phase 3B, and Phase 3D are not executed. Do not push or tag.

Any failure terminates G6 with `PHASE3CR2_RECONCILIATION_BLOCKER`; do not edit
or retry an already-written G6 evidence namespace in place.

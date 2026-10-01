# MO-1307 Phase 3CR2 C3TB G7 acceptance-only recovery

G7 is an append-only acceptance generation over the complete, immutable G6
terminal evidence. It does not resume or modify G6, any earlier generation, the
product, the candidate authority, or any historical witness.

G6 correctly wrote all nine terminal evidence files and staged the exact 1326
A-only acceptance paths. Its staged verifier then failed before any acceptance
commit: `verifyStaged()` line 1002 called `loadFinal()` line 954, which called
`loadPrefinal()` and re-entered the four-file prefinal inventory check at lines
549 and 317. That check correctly rejects a nine-file terminal namespace when
used in the wrong lifecycle state. G7 preserves that failure and separates its
prefinal and terminal loaders.

## Fixed sequence

Use only the repository-pinned Node executable. Writers are single-use and
create evidence exclusively.

1. While G7 evidence is absent, run `--verify-source-only` with
   `validate-recovery.mjs`, `preflight.mjs`, `accept.mjs`, and `finalize.mjs`.
2. Run `validate-recovery.mjs --write` exactly once.
3. Run `preflight.mjs --write` exactly once to seal all seven G7 tools and nine
   planned evidence paths.
4. Run `accept.mjs --verify-only`, then `accept.mjs --write` exactly once.
5. Run `finalize.mjs --write` exactly once to create the five terminal files.
6. Stage the exact 1342-path A-only union and run
   `finalize.mjs --verify-staged`.
7. Outside every G7 tool, create one single-parent acceptance commit over C3TB,
   then run `finalize.mjs --verify-committed`.

G7 tools never create a commit. No G7 step launches a helper, worker, product
control, security control, native control, certification control, or network
operation. Stages 1 through 8 and G4 reconciliation are not rerun. Exactly the
two immutable G4 EOF-whitespace violations are allowed; no additional
whitespace violation is allowed. Phase 3A, Phase 3B, and Phase 3D are not
executed. Do not push or tag.

Any failure terminates G7 with `PHASE3CR2_RECONCILIATION_BLOCKER`; never edit
or retry an already-written G7 evidence namespace in place.

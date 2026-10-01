# MO-1307 Phase 3CR2 C3TB G3 reconciliation recovery

This is a new, append-only administrative generation. It does not resume or
rewrite the failed `phase3cr2-c3tb-g2` execution. It consumes that generation's
immutable raw witnesses and performs reconciliation only.

## Required order

Use only the pinned runtime at `.cache/mo1307-phase3cr2-runtime/node.exe` and
run each writer at most once, in this order:

1. `.cache/mo1307-phase3cr2-runtime/node.exe repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g3/validate-recovery.mjs --write`
2. `.cache/mo1307-phase3cr2-runtime/node.exe repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g3/preflight.mjs --write`
3. `.cache/mo1307-phase3cr2-runtime/node.exe repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g3/reconcile.mjs`
4. `.cache/mo1307-phase3cr2-runtime/node.exe repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g3/finalize.mjs --write`
5. After staging the exact recovery closure, run the same tool with
   `--verify-staged`; after the acceptance commit, run it with
   `--verify-committed`.

The validation writes `zero-execution-validation.json`. The preflight requires
that it is the sole G3 evidence file, re-verifies the complete immutable G2
closure, seals every G3 tool byte, and then exclusively creates
`recovery-plan.json` and `pre-execution-seal.json`.

## Zero-execution boundary

Validation and preflight may read files, hash bytes, and query local Git
objects. They must not launch the MemoryOS product, its helper, a worker, a
native control, a security control, a certification campaign, or any network
operation. Reconciliation must not rerun G2 stages 1 through 8. Phase 3A,
Phase 3B, and Phase 3D are outside this generation; the Phase 3D artifact is a
handoff only.

`candidate.json` is a pre-binding record whose candidate commit and production
tree fields remain null. Those placeholders are retained but excluded from
derivation. The production tree is accepted only when every non-null sealed
authority agrees: the G2 plan and seal, binding implementation and package,
binding verification, both preserved official-check receipts, and Git's C3T
and C3TB production subtrees. Candidate, production-commit, missing/different
tree, binding-kind, official-check, and helper mismatches all fail closed.

Any failure leaves G2 unchanged and yields no certification claim. The terminal
failure outcome for this recovery remains `PHASE3CR2_RECONCILIATION_BLOCKER`.

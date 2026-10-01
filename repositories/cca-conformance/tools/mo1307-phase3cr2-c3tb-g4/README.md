# MO-1307 Phase 3CR2 C3TB G4 reconciliation recovery

This is a new, append-only administrative generation. It does not resume,
rewrite, or recategorize either the failed `phase3cr2-c3tb-g2` execution or
the blocked `phase3cr2-c3tb-g3` recovery. It consumes G2's immutable raw
witnesses and performs reconciliation only.

## Required order

Use only the pinned runtime at `.cache/mo1307-phase3cr2-runtime/node.exe` and
run each writer at most once, in this order:

1. `.cache/mo1307-phase3cr2-runtime/node.exe repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g4/validate-recovery.mjs --write`
2. `.cache/mo1307-phase3cr2-runtime/node.exe repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g4/preflight.mjs --write`
3. `.cache/mo1307-phase3cr2-runtime/node.exe repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g4/reconcile.mjs --verify-only`
4. `.cache/mo1307-phase3cr2-runtime/node.exe repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g4/reconcile.mjs --write`
5. `.cache/mo1307-phase3cr2-runtime/node.exe repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g4/finalize.mjs --write`
6. After staging the exact recovery closure, run the finalizer with
   `--verify-staged`; after the acceptance commit, run it with
   `--verify-committed`.

The validation exclusively creates `zero-execution-validation.json`. The
preflight requires that it is the sole G4 evidence file, re-verifies the
complete immutable G2 and G3 closures, seals all seven G4 tool files, and then
exclusively creates `recovery-plan.json` and `pre-execution-seal.json`.

## Preserved G3 blocker

G3 terminated with `PHASE3CR2_RECONCILIATION_BLOCKER` and wrote none of its
four reconciliation outputs. Its sealed validation binding included
`checkout.helper.gitBlob` in `helperAuthorities.gitBlobs`, while G3
`reconcile.mjs` built `helperCheckout` with `filePin`, which omitted that
field. The helper bytes and identity still agreed, but the exact authoritative
binding comparison at G3 line 677 correctly failed closed.

G4 classifies that defect as
`MISSING_PROPAGATION/OTHER_CONCRETE_RECONCILIATION_DEFECT`. Validation
mechanically reconstructs the G3 input, proves the missing authority entry is
the sole difference, pins all G3 bytes, and records the blocker separately.
G4 reconciliation must propagate the checkout Git blob by using a Git-bound
pin. It may not weaken or remove the exact comparison.

## Zero-execution boundary

Validation and preflight may read files, hash bytes, and query local Git
objects. They must not launch MemoryOS, its helper, a worker, a native control,
a security control, a certification campaign, or any network operation.
Reconciliation must not rerun G2 stages 1 through 8. Phase 3A, Phase 3B, and
Phase 3D are outside this generation; the Phase 3D artifact is a handoff only.

The production tree is never hardcoded or accepted from a manual fallback. It
is derived only when every required non-null sealed and Git authority agrees.
Candidate, production-commit, missing/different tree, binding-kind,
official-check, and helper mismatches all fail closed.

Any failure preserves G2 and G3 unchanged, writes no certification claim, and
uses the terminal outcome `PHASE3CR2_RECONCILIATION_BLOCKER`.

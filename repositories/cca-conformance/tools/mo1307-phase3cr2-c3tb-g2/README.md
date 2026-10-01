# MO-1307 Phase 3CR2 C3TB fresh generation G2

This directory contains the append-only Phase 3CR2 tooling for exact C3TB
`119e68bdcf0ffc906b4ca03a912aadcb25908346` on branch
`codex/mo1307-phase3cr2-c3tb`. Production remains exact C3T
`65e24b2debdd70ecb8e52fbccbd6c101621f1917`, production tree
`324bf600b6cbfaa8564db27fce2d999711270cb8`, with no product edit.

G2 is generation `phase3cr2-c3tb-g2`, ordinal 2, in mode
`FRESH_AFTER_FAILED_GENERATION`. It does not resume generation
`phase3cr2-c3tb`. The prior generation remains `FAILED_INCOMPLETE` /
`PHASE3CR2_FAILED_INCOMPLETE` after its first mandatory failure at stage 4,
`DEADLINE_CLEANUP_SELECTED_7`. Its exact 15-tool and 194-evidence closures are
preserved under the original tool and evidence namespaces. Those 209 files
remain historical failed-generation evidence; they are neither rewritten as
PASS nor admitted as members of the accepted G2 evidence manifest.

There is no G2-local failed-preflight record. The G2 campaign plan and
pre-execution seal bind the full prior failed-generation closure, the corrected
control-map pin, and a separate zero-product engineering validation record at
`repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g2-harness-validation/validation.json`.
That sibling namespace contains exactly one file and is not campaign evidence.
Its six cases prove the current authorized diff and historical baseline pass,
synthetic executable and console-policy changes fail, a comment-only hunk
passes, and a reuse dependency mismatch returns `MOVE_TO_FRESH`. Product,
helper, security-campaign, certification-campaign, and network execution counts
are all zero.

The corrected source/security predicate classifies all 28 exact C3RB-to-C3TB
hunks: 9 headless, 2 native-last-error, 1 open-chain, 2 deadline, 3 derived
metadata, 11 documentation-only, and 0 unexpected. Comment-only status is
decided per hunk with language-aware whole-line and inline-comment handling;
there is no global comment strip or raw-source equality shortcut. The actual
attribution boundary stops with `PHASE3CR2_UNEXPECTED_SOURCE_DELTA` for any
unexplained production difference. Its campaign review is the deadline case
`deadline-cleanup/attempt-1/bounded-state-and-fixed-source-review.json` and its
identical case detail in the deadline receipt. It must pass exact console-policy
and headless semantics, review every security-critical hunk, and bind all 462
reuse decisions with no mismatch or omission.

Preflight seals the finalized tools before any campaign execution. The ordered
campaign is one-shot: the first mandatory failure stops G2, no retry or repair
occurs in-campaign, remaining stages stay `NOT_RUN`, and the result is
`PHASE3CR2_FAILED_INCOMPLETE`. Acceptance requires 89/89 selected historical
controls `PASS_FRESH`, 462/462 controls `REUSED_EXACT`, both candidate-specific
controls PASS, zero controls moved to fresh, and zero omissions. Four
reuse-candidate controls may have supporting-only fresh witnesses; those
witnesses never replace dependency-equality proof. A post-seal reuse mismatch
is fatal drift, not adaptive movement.

`finalize.mjs` retains all three modes:

- `--write` validates completed evidence and exclusively creates the report,
  independent review, receipt, handoff, manifest, and final seal. It executes no
  product, helper, security, or certification control.
- `--verify-staged` requires the exact staged set: the preserved 209 prior files,
  every accepted G2 manifest member, the manifest and final seal, and the one
  validation artifact. Prior and validation files remain outside the accepted
  G2 manifest even though the containing conformance commit preserves them.
- `--verify-committed` requires one conformance-only commit whose sole parent is
  exact C3TB, whose changed paths are exactly that staged set, whose production
  tree is unchanged, and whose worktree is clean.

The generated report has exactly 20 numbered items and preserves the prior
`FAILED_INCOMPLETE` outcome while recording the corrected review as PASS and G2
as `PHASE3CR2_ACCEPTED`. Phase 3BR2 remains accepted and untouched, Phase 3AR2
remains independent, and Phase 3D is not executed. No push or tag is performed.

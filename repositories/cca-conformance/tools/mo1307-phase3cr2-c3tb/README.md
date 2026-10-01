# MO-1307 Phase 3CR2 C3TB refresh

This directory contains the append-only, dependency-selected Phase 3CR2
campaign for exact C3TB `119e68bdcf0ffc906b4ca03a912aadcb25908346`.

The first setup attempt stopped in mandatory preflight because the accepted
`current-control-results.json` digest was transposed into the expected
`current-control-map.json` identity field. It executed no controls and made no
certification claims. That non-PASS history is preserved at
`failed-preflight-attempt-1.json`. The corrected preflight verifies the
accepted Phase 3C manifest-to-map chain and seals a fresh, non-resumed campaign
only after a zero-product-execution validation passes.

The campaign preserves historical accepted Phase 3C commit
`b02fc0226a1a2d800185a02071674ca80bdf4a1d`, freshly executes 103 raw/live
witnesses (89 selected historical-control witnesses, 10 dependent supporting
cases, and 4 supporting-only witnesses for controls that remain
`REUSED_EXACT`), evaluates two candidate-specific controls, proves all 462
reuse dispositions, and stops at the first mandatory failure. The separate
one-case native metadata/source-semantics stage is not folded into the 103.
The campaign performs no Phase 3A, Phase 3B, Phase 3D, push, tag, or production
repair. Accepted Phase 3BR2 commit
`4d92f0f21c9c3aad8202f4558d61b9229c7214fc` is neither rerun nor modified.

The mandatory `NATIVE_LAST_ERROR_METADATA` stage reflects the exact current
`Initialize-Native` bindings without invoking a native API or submitting a
helper request. Equivalence, TOCTOU, and deadline comparisons copy the sealed
corrected N15 helper byte-for-byte; its artifact and production source share
git blob `527fea7b9f12ba345f5b4f57511263485e79e303` at production commit
`c9cd73df2f4c48afeab6059b31eca61830e1633c`. It is a comparison source, not
promoted diagnostic evidence.

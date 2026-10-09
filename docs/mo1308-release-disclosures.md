# MO-1308 release disclosures (Phase 3 certification, candidate deff3c80)

This document states what the Phase 3 certification does and does not establish for the MemoryOS 1.3 investigation-history ledger
(MO-1308). It is the disclosure input of case 3D-E3 (and 3D-D6). Every outcome below is the outcome recorded in the accepted
certifying generations `phase3a` (108/108), `phase3b` (26/26) and `phase3c` (67/67); none was edited.

Register: Q01 Q02 Q03 Q04 Q05 Q06 Q07 Q08 Q09 Q10 Q11 Q12 Q13 Q14 Q15.

## Scope of the claim

Local single-user v1 on native Windows 11 x64 with the pinned Node. The ledger is integrity-checked, not authenticated, not encrypted
and not signed. It is not claimed for multi-user, shared-storage or cloud use; MO-1309 must re-review those before any such claim.

## Operator guidance (rollback anchor)

Operators record the `headDigest` of every export outside the ledger (in a separate system) and verify it externally. Without an
external head anchor, tail truncation and rollback to an older valid prefix cannot be detected.

3C-A6: CONFIRMED - truncating the tail, or restoring an older valid prefix, produces a ledger that still verifies; only an externally recorded headDigest exposes it.

## Qualification cases (recorded outcomes)

- 3A-E6: CONFIRMED - the delete-pending staging-name probe reproduced the EPERM-versus-EEXIST behaviour the A6 hypothesis predicts (Q02).
- 3A-F7: NOT_CONFIRMED - with staging names `<role>.<pid>.<n>` (A10) the repeated concurrent append workload showed no staging EPERM in more than 1 of 10 runs; the host-latency qualification Q10 still applies as an environment note.
- 3A-JC6: CONFIRMED - exporting 100,000 entries completes with the marker written last and takes on the order of 16 minutes on the reference host (Q11); a performance follow-up for MO-1309, not a defect.
- 3C-B3: CONFIRMED - a fully self-consistent forged chain verifies; verification is integrity only (Q13).
- 3C-B5: CONFIRMED - an entry whose admission fields are forged, or whose bytes would fail admission, still verifies when the chain and member digests are consistent (Q08).
- 3C-C10: CONFIRMED - policy-evaluation admission is inspection-only and readiness-result admission is not a MO-1307 verification (Q12).
- 3C-E6: CONFIRMED - a staging remnant left by an interrupted append can survive a purge (Q04).
- 3C-E7: CONFIRMED - after a purge the entry keeps its recordDigest, member names, lengths, digests and subjects (Q05).
- 3C-E8: CONFIRMED - an export taken before a tombstone keeps the bytes; there is no import and no recall (Q07).
- 3C-E9: CONFIRMED - the tombstone authority reference is operator-chosen free text and is permanent (Q06).

## Structural qualifications

- Q01: DISCLOSED - the store is Node-only; a directory swap is detected after the fact, never prevented (H40). Local single-user v1 only; re-review before any multi-user, shared-storage or cloud use, including MO-1309.
- Q09: DISCLOSED - the incremental SHA-256 and the canonical module copy are first-party code, verified by FIPS 180-4 example messages, the CAVP Monte Carlo procedure computed against node:crypto, differential tests and a recorded independent review; official CAVP response files were not used.
- Q14: DISCLOSED - the certification claims native Windows 11 x64 only (H45).
- Q15: DISCLOSED - UNC, network, OneDrive and cloud-placeholder locations are observed, not claimed.

## Other recorded limits and findings

- Q02: a failed exclusive create of a staging file is a typed IO failure and is never retried; two hypotheses (transient lock, delete-pending) are not both resolved (see 3A-E6, 3A-F7).
- Q03: see the operator guidance above. Q10: host latency under antivirus and indexers is heavy-tailed; an environment qualification, not a bound.
- Q13: integrity only; access control is the operator's filesystem responsibility (H07, H08).
- Product corrections made during Phase 3 (A10: unwritable output never changes an exit; refusal of a link at a staging name; purge boundary re-check; per-process staging names; A11: the entry-count limit is tested before entry validation) are in the certified candidate; residual swap windows between a check and the filesystem call are the accepted H40 class.
- The independent harness reviews (3A twice, 3B, 3C twice) have no open blocking finding. Accepted non-blocking items are listed in each `phase3x-harness-review/review.json`; notably 3A-G6 races only the first part of its swap schedule, the 3B transitive-import check records but does not assert that the history authority reaches the Core through `investigation-policy-engine.js` (owner modules unchanged), and git and Python are recorded by version only.
- Preserved non-certifying rehearsals (3A r2-r11, 3B r1-r2, 3C r1-r5, 3D r1-r2) are kept in the evidence tree and are never accepted inputs.

# MO-1308 Phase 3C harness review: dispositions (non-blocking findings)

Two independent read-only sub-agent reviews of the 3C harness (`tools/mo1308-phase3c`, 17 files). The first (bytes of commit a1744da8) found one BLOCKING finding, H-01 (3C-F2 passed for the wrong reason), fixed and re-reviewed. The second (final bytes, commit e7172e11 plus this record; rehearsal r4 67/67) found no blocking finding. The sealed record is `repositories/cca-conformance/evidence/mo1308/phase3c-harness-review/review.json` (subject hashes of all 17 files). This document is where the accepted items are disclosed; the 3D release disclosures cite it.

| Finding | Disposition | Where / what |
|---|---|---|
| H-01 BLOCKING 3C-F2 vacuous | FIXED | hostile paths inside a re-sealed sorted manifest, exact EXPORT_CORRUPT, control row; fails if the path rule is removed |
| H-02 F3/G2 scratch is `<worktree>/.p3c-work` | ACCEPT_WITH_DISCLOSURE | disclosed here; removal is lstat-based, confined, in `finally`; a hard kill leaves an untracked directory in the worktree |
| H-03 G6 runtime refusals vacuous | FIXED (assert regions found); runtime part corroboration only | |
| H-04 D5/D7/D8 reduced sizes, no legacy compare at 10,000 | ACCEPT_WITH_DISCLOSURE | disclosed here |
| H-05 wider code sets than Freeze 14.1 | ACCEPT_WITH_DISCLOSURE | disclosed here; tightening would assert more than the Freeze says |
| H-06 Q03 outcome rule | ACCEPT_WITH_DISCLOSURE | the pre-registered protocol rule; per-variant results are observed; 3D-E2 must read them |
| H-07 swallowed results | FIXED for E3; E6/F4 ACCEPT_WITH_DISCLOSURE | record cases |
| H-08 static audits | FIXED for G1; I1/I3 token limits ACCEPT_WITH_DISCLOSURE | runtime observer (I2) backs the claims |
| H-09 weak hostile rows (J2, J5, J6) | ACCEPT_WITH_DISCLOSURE | disclosed here |
| H-10, H-18 B2 determinism wording | ACCEPT_WITH_DISCLOSURE | independent recomputation carries the case |
| H-11 oracle not bound | FIXED | `campaign.mjs` inputPaths |
| H-12 durations in observations | ACCEPT_WITH_DISCLOSURE | |
| H-13 C8 file-only snapshot; G2 90 s guard | ACCEPT_WITH_DISCLOSURE | |
| H-14 G2 appends the produced result as a duplicate | ACCEPT_WITH_DISCLOSURE | byte-identity property holds; that leg is not relied on |
| H-15 step guards: A 585 of 900 s, C 190 of 300 s in r4 | ACCEPT_WITH_DISCLOSURE | the certifying run needs a quiet host with a recorded load sample; sample counts not lowered |
| H-16 I1/I3 scanners accept some forms | ACCEPT_WITH_DISCLOSURE | the product has none today |
| H-17, H-19, H-20 notes | ACCEPT_WITH_DISCLOSURE | |

PRODUCT dispositions: none. No finding needs a production change; Part B of correction round 3 (Amendment A11) is driven by 3A-JC9 only.

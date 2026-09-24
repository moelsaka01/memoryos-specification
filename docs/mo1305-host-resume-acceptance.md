# MO-1305 Phase 1 host-resume acceptance evidence

The final Windows candidate passed all 21 bounded installed-acceptance gates. The canonical inventory and Phase 1 binding evidence resolve the actual I1/B1 graph; I1 is parented by verification correction V and B1 is parented by I1. This evidence does not claim Phase 2, Phase 3 or Windows release certification.

- Measured source: `3757c03536d73d0457b901155cab34b5b1c0e410c5a64ed0ba1e9dbbc1007949`.
- Final source: `95ec29c735a08c8219b6ca7dbe7798748677133a3df96c2f9b14b08d19759281`.
- Final archive SHA-256: `814106ce3d0d276ddcb0181dd6e62c22211480a4c3860623d6a6340268f90860`; 185978 bytes.
- Final limits SHA-256: `4ad1011f2e0861d28020427f1788026c92c6ff0672c707dab7116da1f568e1fa`.
- Resource coverage: 15 immutable vector receipts, 150 cold and 300 warm valid observations; 341 reused and 109 fresh. No variance extension triggered.
- R6 host invalidation: maximum-permitted-headers warm slots 1 and 2; both preserved, each selectively replaced. R1/R4/R5/R6 remain FAIL and all 221 preserved repository artifacts retain their hashes.
- Maximum valid operation: 7832379 us; final deadline 31400 ms under the unchanged 4x / upward-100-ms rule.
- Final memory budgets (MiB): young 32, old 112, worker external 25, parent heap 124, parent external 34, process RSS 393. All retain 1.5x headroom and stay within the authorized ceilings; worker young configuration remains 24 MiB.

| Final-candidate gate | Result |
|---|---|
| Functional catalog | 105/105 PASS |
| Adverse functional | 20/20 PASS |
| Selected stress | 9 vectors, two repetitions of at least ten seconds each, PASS; measured and final-confirmation identities remain separate |
| Host validity | 21 deterministic tests PASS; every resource member revalidated from OS evidence; all 38 final adverse/stress windows independently revalidated after the restricted-PATH query correction |
| Package / OpenAPI / worker authority | 27 tests PASS |
| Clock / native protocol | 28 tests PASS |
| Extra startup / baseline startup | 15 / 51 PASS |
| Lifecycle / worker faults | 19 / 15 PASS |
| Node fetch / curl | 12 / 12 PASS, real TLS 1.3 / HTTP 1.1 |
| Raw TLS framing and security | 174 PASS |
| Semantic parity | 73 SDK vectors and 29 local cases PASS, including PASS, FAIL and COULD_NOT_EVALUATE |
| Final boundaries / boundary matrix | 26 / 138 PASS |
| Signals | Bounded Windows shutdown PASS |
| Offline install | Fresh isolated install with initially empty cache, scripts disabled; all installed bytes match |
| Independent builds | Two exact archive/source matches |
| Required predecessor regressions | Six trigger-policy groups, 235 PASS; unrelated C++/UI/hosted suites excluded |
| Workspace / whitespace | PASS |

The dated supply-chain scope remains 2026-09-24 and is bound to the final generated dependency manifest, SBOM and exact notices. The semantic closure and runtime code are unchanged; only derived limits, their OpenAPI projection and generated package provenance differ from the measured candidate.

See [host interruption validity](mo1305-host-interruption-validity.md), [modular resource aggregate](../repositories/cca-conformance/evidence/mo1305-phase1-resume/resource-aggregate.json), [inventory](../repositories/cca-conformance/mo1305-conformance-inventory.json), and [binding evidence](../repositories/cca-conformance/evidence/mo1305-phase1-binding/binding.json). Ubuntu/Linux, VM and cross-platform parity are NOT_REQUIRED. No push or tag is part of this work.

# MO-1305 Phase 2D integrated implementation

The authoritative integration workspace is `C:\Users\melsa\Documents\Codex\cca-workspace`, branch `main`. The verified clean starting commit is B1 `b6c397b99e1f8bfcd04be972f35069f8737a4137`, `conformance(memoryos-1.3): bind MO-1305 phase 1 foundation`.

## Inputs and reconciliation

| Source | Commit | Changed paths | Parent |
| --- | --- | ---: | --- |
| Phase 2A | `24d4aaaacc57c359be7726d5ec0df05b16884b50` | 49 | B1 |
| Phase 2B | `77fa29606f600344e2ce500bb09dafd666f90588` | 54 | B1 |
| Phase 2C | `d3d4f2976249d45ce0355ec4823efc4a05bcb405` | 78 | B1 |

Each named branch is exactly one direct child of B1 with the requested subject. All source worktrees were clean and remain read-only inputs. No merge, cherry-pick, rebase, branch replacement or cleanup is used. Source commits remain independent evidence inputs; the authoritative lineage is B1 -> I2 -> B2. Neither future commit hash is embedded in its own content.

The complete 178-path classification and overlap matrix are in `repositories/cca-conformance/evidence/mo1305-phase2d/integration-review.json`. Every source file identity is checked against its Git blob. There are exactly three shared paths:

| Path | 2A | 2B | 2C | Resolution |
| --- | --- | --- | --- | --- |
| `repositories/memoryos-rest/src/server.mjs` | yes | no | yes | Exact 2A lifecycle implementation plus the exact 2C comment and `requireHostHeader:false` edit. |
| `repositories/memoryos-rest/distribution-manifest.json` | yes | yes | yes | Regenerated after final integrated bytes. |
| `.gitattributes` | no | yes | yes | Union of the existing narrowly scoped 2B executed-byte and 2C EOF rules. |

There are no evidence or documentation overlaps. All original reports, receipts, catalogs and harnesses remain byte-identical to their source commits. Source validator commands and outputs are retained as `2a-validation.*`, `2b-validation.*`, and `2c-validation.*`. The 2B validator used a read-only output comparison to avoid rewriting its validation receipt.

`src/config.mjs` and `bin/memoryos-rest.mjs` are exact 2A Git bytes. They retain explicit remote opt-in, canonical assigned RFC1918 validation, startup signal handling, Windows supervisor input handling and bounded shutdown. `src/server.mjs` keeps 2A lifecycle/state/worker/socket cleanup and 2C authentication before missing-Host rejection. The `.gitattributes` reconciliation introduces no broader exemption.

The full production diff is limited to those three runtime files, the README, dependency manifest, distribution manifest and SPDX SBOM. Runtime changes map only to 2A and 2C. README and metadata changes map to 2B distribution requirements. The README accurately describes the integrated remote behavior and trusted Phase 2D archive verification.

## Integrated artifact

| Identity | Value |
| --- | --- |
| Package | `memoryos-rest@0.1.0` |
| Archive | `.cache/mo1305-phase2d/build/memoryos-rest-0.1.0.tgz` |
| Archive bytes | 189787 |
| Archive SHA-256 | `af99ba13fa96c5b5ded130a871c671243fb3fadd07f74eefa9b6ae2e601d182a` |
| Production manifest digest (canonical 58 artifact references) | `1e7445d6bddcf28fe59a896e66a74084c0dfa0f3ba5a8c62e74f0578a7a6c590` |
| Source tree SHA-256 | `8c34ecc1bfa885422de67401f0fdd2449566a4f48ff93afa2e19865bf11d486f` |
| Distribution manifest SHA-256 | `f2693ef0f5585ca4e3156407497143188412cf46c07637751c122ec210d8262a` |
| Package files / runtime closure files | 58 / 25 |
| npm production/development dependencies | 0 / 0 |

The integrated builder preserves 2B archive parsing, exact allowlist, closure, ownership/notices, dependency and SBOM semantics. Only the three reviewed executable pins change. Generated dependency provenance uses B1 and the integrated source tree digest. The SPDX namespace binds that digest, and gateway files remain distinguished from the authoritative semantic closure and external Node/npm tooling. SPDX and distribution metadata avoid self hashes; the archive binds all members. Two independent assemblies are byte-identical.

The isolated 2B archive remains historical: 188890 bytes, SHA-256 `9ebe8bba35e04069def1348659f6df066247ca1e81e2990d04655ca065f9df63`. It is not presented as the integrated artifact. Archive bytes remain local build artifacts; committed evidence binds their identities and validates the local bytes.

## Integrated acceptance

All ten integrated execution modules passed against binding `2120595e30f811bef4ebc552d731ed43295763aee2323ca78da31036a79f3fde`. Each attempt records monotonic and correlated UTC time, independent Windows host-event observations, exact input identities and retained results. There were zero host-interrupted attempts and no failed execution attempts. Host evidence was AVAILABLE for every accepted module.

| Module | Fresh result | Purpose |
| --- | --- | --- |
| lifecycle | 30/30 | Startup, supervisor control, readiness, cancellation, draining, semantic shutdown, worker cleanup, integrity poisoning, socket cleanup/rebind, local/remote connection limits and 11 normative vectors. |
| transport | 164/164 | TLS, HTTP framing, bearer authentication, Host/proxy and missing Host, content negotiation, logging/secrets. |
| dispatch | 23/23 | Integrated routing, strict JSON, schema and dispatch observations. |
| startup | 5/5 | Startup and TLS/authentication restart behavior. |
| resources | 45/45 | Targeted admission, ownership, timeout and error mapping; no characterization campaign. |
| interoperability | 51/51 | 17 raw TLS, 17 Node fetch and 17 curl checks with an independent authoritative SDK oracle. |
| REST regression | 27/27 | Six affected REST unit-test files. |
| distribution | 142/142 | Archive structure, allowlist, metadata, closure, substitution/tamper, installed runtime verification. |
| installation | 2 methods, 36 requests | Offline direct extraction + npm ci, and offline archive npm install; each has 13 loopback and 5 remote requests. |
| reproducibility | byte-identical | Independent fresh assembly of the integrated candidate. |

The selected security modules total 288 records. They are newly executed integrated evidence, not relabeled Phase 2C receipts. The original 2C result validator checks the nested records, closed case catalogs, process provenance, normative products and independent oracle. Outer receipts bind the integrated production and harness inputs.

Offline installs used distinct empty explicit caches, `--offline --ignore-scripts --no-audit --no-fund`, isolated user/global npm configuration, copied verified archive and Node/npm tools, copied fixtures/probe and a fresh empty service working directory outside the checkout. No source-checkout module fallback is possible. The checkout was not hidden by an OS mount; source independence is proved by closed import membership, identical installed inventory, external service cwd and minimal process environment. Both installed forms match all 58 members before and after execution. Temporary private test credentials were removed.

Installed execution verifies real entry-point startup, readiness, all nine routes, all six capabilities, shutdown and runtime/contracts/OpenAPI/FINAL-limits integrity. Both local and remote listeners demonstrate authenticated missing Host -> 403 MO1305_FORBIDDEN; missing bearer plus missing Host -> 401 MO1305_UNAUTHENTICATED. TLS 1.3, HTTP/1.1 ALPN, CA and IP-SAN validation are real. Remote evidence is same-host traffic to an actually assigned RFC1918 address; it makes no off-host reachability claim.

Semantic parity covers PASS, FAIL and COULD_NOT_EVALUATE in both the independent SDK interoperability oracle and installed fixtures. Exact canonical response bodies and normative products/digests are validated; the eleven lifecycle vectors additionally cover Policy Sets and maximal preparation inputs.

## Preservation and reuse

The nine-route/six-capability catalog, API identity/version, package version, TLS 1.3, HTTP/1.1, bearer authentication, strict JSON, delegation, authoritative closure and normative fixture bytes remain unchanged from B1. Limits stay FINAL: 31400 ms semantic deadline, 60000 ms ceiling; worker young/old/external 32/112/25 MiB, parent heap/external 124/34 MiB and RSS 393 MiB. No new resource characterization or 450-observation campaign was run. Targeted admission and lifecycle checks passed within frozen budgets.

Unchanged remote configuration, native Windows CTRL-C and capability restrictions are supported by validated 2A/2C historical evidence, with integrated lifecycle/remote/security interactions freshly exercised. Predecessor sources and relevant test inputs remain unchanged, so the valid branch regression receipts (2A 235, 2B 247, 2C 283 in their respective scopes) are reused, not added as new executions. Original validator evidence (2A 29, 2B 68 negative witnesses, 2C 76) remains historical. The newly affected REST regressions ran 27/27.

`baseline-preserved.json` records the original working-tree identities of 2359 files outside the branch integration scope. Forty-one pre-existing text checkouts contain CRLF differences from Git blobs; the gate checks their original raw working bytes and LF-normalized equality to B1, without rewriting them. All other protected files match B1 directly. The later B2 inventory and test-registration changes are the only explicit exceptions to the working-tree preservation check.

`index.json` binds production, package, all integrated modules, original historical evidence, source tree and resource reuse disposition. The actual evidence validator checks result contents, membership, digests, commands, offline flags, expected wire bodies, lifecycle observations, host classification and process provenance. Historical reports are not rewritten. The final implementation manifest binds the entire reviewed I2 scope before I2 exists.

## Validation and phase boundary

Pre-I2 acceptance and workspace/diff checks are recorded separately in `pre-i2.json`. The graph-aware Phase 2 suite is run after I2 exists, followed by a conformance-only B2 and a bounded post-B2 validation. See `docs/mo1305-phase2-binding.md` for I2 and the non-self-referential binding procedure.

Phase 1 remains COMPLETE. Phase 2D execution is complete; Phase 2 closure requires successful I2/B2 conformance. Phase 3 and Windows release certification remain PENDING until that closure. Ubuntu/Linux, VM and cross-platform parity remain NOT_REQUIRED. Final release binding remains PENDING. The `memoryos-1.3-mo1305` tag is absent. No push or tag is performed; all three source branches/worktrees are retained for Phase 3.

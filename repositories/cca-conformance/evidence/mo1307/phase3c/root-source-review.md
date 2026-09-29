# Root security source review

This is an independent review of exact B2 production bytes, scoped to command dispatch, JavaScript key lookup, parsing, resource/error/output controls and package boundaries. Source hashes are in production-baseline.json; B2 byte verification checked every 2,489 I2 bound member and all 89 package members. Primary tests are root-corpus-plan.json/root-corpus-results.json. The independent second reviewer assessed this harness and public-to-private trust transitions separately.

## Prototype/key lookup inventory

All production src/*.mjs were searched for computed key reads/writes, own-property tests, object construction, `in`, dynamic evaluator/import selection and inherited command names. Generated constants/schema data are fixed shipped frozen tables, not input-selected schemas.

| High-risk site | Classification and controlling validation |
|---|---|
| cli-args.mjs COMMANDS[command] | Own-property check precedes lookup. Fourteen unsupported/prototype/case/long command variants rejected by parser and native entrypoint. |
| cli-args.mjs options[flag] | Null-prototype dictionary; closed allowlist and duplicate-own-key checks. |
| canonical.mjs out[key] | Parsed objects have null prototype; duplicate keys rejected. No assignment to Object.prototype. |
| schema.mjs SCHEMAS[next], schema[key] | Fixed local schema references; own-property check at every schema lookup. |
| schema.mjs properties[k], v[k] | Own-property check selects property schema; additionalProperties false; canonical parser produces own data properties. |
| schema.mjs equal/stable object reads | Keys enumerated from own properties; schema validation consumes already canonical bounded records. Not an attacker-selected function dispatch. |
| foundation.mjs sortKeys[key] | Own-property check. Selected inner field names are fixed reviewed strings. |
| foundation.mjs countCaps[k] | Own-property check; count admission precedes recursive schema validation. |
| foundation.mjs coverage[c.type] | Precheck uses own-property; later lookup follows full closed Evidence schema/type enum. |
| readiness-core.mjs coverage[c.type] | Explicit own-property check precedes access. |
| readiness-core.mjs reasonRank[reasonCode] | Internal fixed reason arguments and validated blocker reasons; no caller-defined ranking or string ordering. |
| api-input.mjs input[pin/key] | Fixed bootstrap field names after exact own-data descriptor validation; intrinsic typed-array admission; no accessor-authorized values. |
| api-input.mjs parsed[name], validated[name] | Null-prototype maps with fixed four names and own checks. |
| acquisition.mjs snapshots[entry.id] | Null-prototype snapshot map; helper response IDs exactly match request declarations. |
| helper-protocol.mjs caps[file.id] | IDs must already exactly equal frozen authority/config, candidate/manifest or decision/result sets for capped slots. Slot3 does not use this table. |
| errors.mjs evaluationExits[state] | Own-property guard. Error catalog is a Map; unknown exception text is discarded. |
| evidence graph/verifier/history | User logical IDs index Map/Set structures, not inherited dictionaries. Object.fromEntries in verifier uses a fixed four-key list. |
| readiness-result.mjs fragment/aggregate reads | Fixed collection names and exact aggregate own-field admission; records validated before construction. |
| windows-paths.mjs identity reads | Fixed IDENTITY_KEYS, closed identity validation and exact stable comparisons. |

No high-risk lookup lacks a preceding closed-domain/own-property or Map/null-prototype boundary. This does not claim to secure an embedding JavaScript host that already runs arbitrary hostile code capable of replacing built-ins; trusted launch excludes preload/loader manipulation. The public API rejects inherited top-level authority, unknown/symbol/non-enumerable fields, getters, file-array accessors, shared memory and proxied byte arrays. Null-prototype own-data inputs remain valid.

## Parser/resource layer distinctions

The independently generated parser corpus rejects duplicate/nested duplicate keys, exponents/fractions/negative zero, unsafe integers, malformed UTF-8, BOM, surrogate/control/DEL values, non-ASCII keys, extra JSON and noncanonical whitespace/key order/escapes. Exact depth16, values131072, string4096, key64 and members64 are admitted; each +1 rejects RESOURCE_LIMIT. Source legacy bytes remain opaque, not new JSON.

Byte admission is tested at and one over config16KiB, candidate512KiB, manifest256KiB, authority1MiB, source2MiB, envelope256KiB, result4MiB, decision8KiB. Manifest schema tests cover128/+1 files and8MiB/+1 aggregate. List admission probes distinguish permitted capacity followed by schema rejection from semantic acceptance; a malformed wrapper at a capacity boundary is never represented as an authorized evidence document. The fixed22-gate contract need not permit simultaneously attaining every independent maximum.

Graph boundary/long-cycle evidence is in trust-graph. Output construction has two supplementary exact-B2 regression checks, after dependency byte verification: exact4MiB and128KiB outputs retain all rows; +1 returns OUTPUT/EVALUATION. These reused checks are explicitly not counted as independent new tests. Fresh writeSummary probes prove exact131072-byte LF-terminated transport success, +1 and partial-line refusal. They do not claim a result can be safely truncated.

## Error/output audit

The21-code table is compiled/frozen with exits10 through30 in the stated order. Each code's serialized record and exit is exercised independently, retaining only code, fixed kind/version, bounded logical reference and closed stage. Unknown Error text/cause is redacted to INTERNAL. Public error objects are nonwritable own data properties. Reference IDs are deliberate bounded logical identifiers, not raw paths/body/exception text; suppliers must not use secret material as normative IDs.

All nine phase names are closed. Selection tests independently pair each earlier phase with a smaller-exit later phase, plus same-phase numeric and lexical ties. Fresh public API multi-failure probes confirm configuration before missing files and malformed bootstrap before pin mismatch. Trust/graph and governance/runtime receipts provide semantic phase/error observations. The original Phase2D failed priority probe remains byte-identical and historical. Serializing a code at a closed stage is a formatting test, not proof that every code is meaningful at every stage.

Error records are <=1024 bytes and emitted once by bin/runCli; aggregate stderr4096 is an outer ceiling, not a target to fill with repeated messages. No arbitrary diagnostic append/truncation path exists. Final committed-file transport errors are OUTPUT and retain committed bytes. This exception is distinguished from pre-publication operational failure. Runtime receipts cover no false TIMEOUT/CANCELLED after rename admission.

## Scope and retained diagnostics

Root primary corpus:156/157 matched on the original run. The native Verify command row hit a five-second engineering process wait and retained only an assertion. It is HARNESS_OBSERVATION_INSUFFICIENT, not evidence of a product security failure or product timing success. One bounded follow-up with full child transport capture returned USAGE/LAUNCH/10, empty stdout, in1482.59ms. Original failure remains. Native dispatch rows use harness accept=true to mean assertions about a rejected product invocation succeeded; the composite corpus explicitly reclassifies them as product rejections.

Public safe-root/environment determinism uses two fresh processes, absolute pinned Node, different working roots and fake PATH/PATHEXT/HOME/USERPROFILE/proxy/provider credentials. Exact59987-byte result and both digests agree, stderr empty, no sentinel in emitted output. No OS-wide network sandbox or actual provider-account use is implied.

No production edits, release mutation, push or tag is part of this review. Full runtime certification and full package/supply-chain certification remain Phase3A/3B responsibilities.

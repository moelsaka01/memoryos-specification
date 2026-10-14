# MIP-001 Conformance Matrix

## Purpose

This matrix maps every mandatory requirement in the frozen CCA-MIP-1.0
`requirements.yaml` to the MO-1201 implementation and the automated evidence
that exists in this repository. It is an evidence index, not a replacement for
the frozen specification.

The assessment terms are deliberately narrow:

- **Covered** — a named automated test directly exercises the requirement's
  central success and failure behavior.
- **Review** — the requirement is an assurance or policy boundary that cannot
  be established by package bytes alone; the cited evidence is architectural
  or documentary.

All 64 mandatory requirements are mapped: 62 are **Covered** by direct
automated evidence and two are **Review** requirements whose truth is external
to runtime package bytes.

Implementation surfaces use these abbreviations:

- **CAN** — [`web/js/mip-canonical.js`](../web/js/mip-canonical.js), including
  `decodeUtf8`, `parseStrictJson`, `canonicalize`, `sha256Hex`, `mipDigest`,
  `cloneCanonical`, and `deepFreeze`.
- **MIP** —
  [`web/js/memory-investigation-package.js`](../web/js/memory-investigation-package.js),
  including its structure/model/provenance/derived-artifact validators,
  integrity computation, staged verifier/importer, and atomic value/byte
  exporter.

## Automated test key

Each key below gives the exact Node test name and file. Parameterized published
vector tests are listed once with their exact generated names.

### Canonical primitives — [`mip_canonical_test.mjs`](../tests/mip_canonical_test.mjs)

- **C01** — `strict UTF-8 round-trips Unicode and rejects BOM, malformed bytes, and lone surrogates`
- **C02** — `strict JSON parsing preserves exact members and reports duplicate names with paths`
- **C03** — `strict JSON rejects syntax extensions, invalid Unicode, and invalid MIP numbers`
- **C04** — `canonical serialization follows RFC 8785 ordering and the MIP numeric subset`
- **C05** — `canonical serialization rejects non-JSON and non-interoperable values`
- **C06** — `pure JavaScript SHA-256 and MIP domain separation match known vectors`
- **C07** — `canonical clone and deep freeze produce detached immutable JSON values`
- **C08** — `published MIP vector minimal-observation.mip.b64 has canonical bytes and exact commitments`
- **C09** — `published MIP vector complete-investigation.mip.b64 has canonical bytes and exact commitments`
- **C10** — `published MIP vector noncritical-extension.mip.b64 has canonical bytes and exact commitments`

### Package behavior — [`memory_investigation_package_test.mjs`](../tests/memory_investigation_package_test.mjs)

- **P01** — `CCA-MIP-001..010: all published packages import headlessly with exact golden integrity`
- **P02** — `CCA-MIP-004,037..044: import/export round trips exact bytes and digest scopes remain distinct`
- **P03** — `CCA-MIP-008..010,016,019,039,050..052,064: deterministic export stages accepted source truth atomically`
- **P04** — `CCA-MIP-005,048: .mip file envelopes enforce name and media type`
- **P05** — `CCA-MIP-005..007,037,045..046: lexical, duplicate, canonical, version, and closed-core diagnostics follow phase precedence`
- **P06** — `CCA-MIP-041..043: checksum changes are rejected before semantic publication`
- **P07** — `CCA-MIP-011..020: identity, ordering, Workspace, closure, and provenance are validated`
- **P08** — `CCA-MIP-021..028: Trace and Replay are independently reconstructed`
- **P09** — `CCA-MIP-029..036: Evolution and Comparative Reconstruction are independently recomputed`
- **P10** — `CCA-MIP-047..049: semantic failures and resource limits publish no partial state`
- **P11** — `CCA-MIP-053..058: extension bijection, preservation, critical handling, and same-major compatibility`
- **P12** — `CCA-MIP-054,059..064: presentation, media, Runtime, executable, and generated content are rejected`
- **P13** — `MIP implementation remains headless and renderer-independent`

### Adversarial conformance — [`mip_adversarial_conformance_test.mjs`](../tests/mip_adversarial_conformance_test.mjs)

- **A01** — `integrity validation independently rejects section, cognition, and package commitment mismatches`
- **A02** — `provenance validation enforces role grammar, cardinality, relationship use, and connectivity`
- **A03** — `Trace and Replay reconstruction reject bad bindings, indices, terminals, and payload`
- **A04** — `reverse relationship orientation reconstructs into reverse Trace and Replay directions`
- **A05** — `Evolution recomputation covers every record difference kind and modified relationships`
- **A06** — `Evolution recomputation covers added and removed evidence and relationships`
- **A07** — `Comparative Reconstruction deterministically emits A-only divergence when the earlier Trace has extra cognition`
- **A08** — `same-phase diagnostics are deterministically sorted and an earlier phase wins`
- **A09** — `extension contract enforces reverse-DNS names, shape, bijection, versions, and critical support`
- **A10** — `prohibited content detects security material, runtime residue, active media, and copied cognition`
- **A11** — `hostile inputs fail safely without draft spoofing, stack overflow, raw errors, or path traversal`
- **A12** — `Producer trust, versions, critical support, timestamps, and artifact envelopes remain explicit`
- **A13** — `Workspace ownership is enforced for every persisted cognitive artifact`

### Scalar, identity, and ordering conformance — [`mip_ordering_conformance_test.mjs`](../tests/mip_ordering_conformance_test.mjs)

- **O01** — `CCA-MIP-006,038: interoperable integer boundaries and declared decimal strings remain exact`
- **O02** — `CCA-MIP-012: colliding source identities require contiguous occurrences in authoritative order`
- **O03** — `CCA-MIP-012: inconsistent occurrence references fail in their deterministic semantic phase`
- **O04** — `CCA-MIP-018: sequence gaps are valid and preserved exactly`
- **O05** — `CCA-MIP-018: duplicate and descending Observation sequences are rejected`
- **O06** — `CCA-MIP-018: Producer rejects source chronology inversion before canonical normalization`

### Derived-artifact edge conformance — [`mip_derived_edge_conformance_test.mjs`](../tests/mip_derived_edge_conformance_test.mjs)

- **D01** — `CCA-MIP-024: multi-branch Trace reconstruction preserves Reflection and evidence provenance order`
- **D02** — `CCA-MIP-026: multi-branch Replay uses fixed role order and first-seen suppression`
- **D03** — `CCA-MIP-035: an equal-length LCS tie emits Observation A first`
- **D04** — `CCA-MIP-035: relationship revision and Trace binding reasons use the mandated exact order`

### Pipeline and publication conformance — [`mip_pipeline_conformance_test.mjs`](../tests/mip_pipeline_conformance_test.mjs)

- **L01** — `CCA-MIP-045: adjacent multi-defect vectors prove the exact thirteen-phase precedence`
- **L02** — `CCA-MIP-046: every closed diagnostic code has stable shape and an RFC 6901 pointer`
- **L03** — `CCA-MIP-046: multiple diagnostics are deterministically ordered by path then code within a phase`
- **L04** — `CCA-MIP-051..052: detached-byte publication is atomic and never mutates caller-owned state`
- **L05** — `CCA-MIP-051..052: artifact publication failure returns nothing and preserves all preexisting state`
- **L06** — `CCA-MIP-052: failed import and verification preserve existing package and expose no partial state`
- **L07** — `CCA-MIP-055: every public round-trip preserves an unknown noncritical extension exactly`
- **L08** — `CCA-MIP-058: compatibility is explicit, lossless, and never silently coerces a wire version`

### Independent schema evidence — [`mip_schema_conformance_test.mjs`](../tests/mip_schema_conformance_test.mjs)

- **S01** — `vendored MIP-001 schema is the exact frozen publication`
- **S02** — `independent JSON Schema validation accepts published vector minimal-observation.mip.b64`
- **S03** — `independent JSON Schema validation accepts published vector complete-investigation.mip.b64`
- **S04** — `independent JSON Schema validation accepts published vector noncritical-extension.mip.b64`
- **S05** — `independent JSON Schema validation rejects closed-core and profile violations`

## Requirement coverage

| Requirement | Implementation surface | Automated evidence | Assessment and evidence |
|---|---|---|---|
| CCA-MIP-001 | MIP `validateModel`; all derived validators | P01, P07–P09, A13 | **Covered** — same-Workspace packages succeed and changing the Workspace on an Observation, Trace, Replay, Evolution, or Comparative Reconstruction independently fails with `WORKSPACE_MISMATCH`. |
| CCA-MIP-002 | MIP closed derived schemas; `constructTrace`, `constructReplay`, `constructEvolution`, `constructComparative` | A03, P08, P09, S03, S05 | **Covered** — the frozen closed schemas enforce reference/digest/order-only derived values, the complete vector exercises every derived artifact, and injected Trace payload is rejected; the suite uses representative rather than Cartesian payload injection. |
| CCA-MIP-003 | CAN + MIP dependency-free modules | P01, P13 | **Covered** — verification/import execute with no Runtime, Studio, renderer, or Provider dependency. |
| CCA-MIP-004 | CAN canonical clone/freeze; MIP integrity and export | C07–C10, P02, A01 | **Covered** — imported packages are deeply immutable, every frozen section commitment is recomputed, and semantic, metadata, and extension changes demonstrate new canonical bytes/package commitments. |
| CCA-MIP-005 | CAN strict decoding/parsing/JCS; MIP file-envelope APIs | C01–C04, P04, P05, A10 | **Covered** — BOM, duplicate, multi/syntax, noncanonical, archive/binary signatures, exact `.mip` name, and exact media type boundaries are exercised; the API accepts one byte document and has no sidecar/container path. |
| CCA-MIP-006 | CAN JSON parser and serializer restrictions | C01, C03–C05, O01 | **Covered** — excluded lexical and numeric forms fail, safe integer boundaries succeed, and source-declared decimal strings beyond the interoperable integer range are preserved exactly as strings. |
| CCA-MIP-007 | MIP `validateStructure`; frozen schema evaluator | P05, S01–S05 | **Covered** — the exact frozen schema hash, all published vectors, required/unknown members, header/profile constants, and representative closed-core failures are independently exercised. |
| CCA-MIP-008 | MIP `validateManifest`, `validateModel`, `normalizedSections` | P01, P03, A08, A09 | **Covered** — golden profiles, caller-supplied stable identity, deterministic inventory/features, feature bijection, and inventory mismatch rejection are exercised; equivalent inventory counters share one generic validator. |
| CCA-MIP-009 | MIP `validateMetadata`, `normalizedSections` | P03, P13, S05, A12 | **Covered** — omission-by-default, explicit UTC/leap-second validation, closed members, deterministic repeat export, and the absence of an implicit clock dependency are exercised. |
| CCA-MIP-010 | MIP `normalizedSections` and export | P01, P03, C08 | **Covered** — the canonical Observation-only vector retains every optional artifact array as empty. |
| CCA-MIP-011 | MIP `validateReference`, `compareReference`, `validateModel` | P07, S01, S03, S05 | **Covered** — exact typed tuple shape is independently schema-validated, complete record/relationship tuples round-trip, and duplicate tuple identity is rejected. |
| CCA-MIP-012 | MIP `validateOccurrences` and derived-reference closure | P07, O02, O03 | **Covered** — colliding record and relationship identities preserve source-assigned contiguous occurrences; gaps, duplicates, source-order inversions, and inconsistent occurrences in every derived artifact fail in the deterministic semantic phase. |
| CCA-MIP-013 | CAN exact strings; MIP tuple comparisons/round trip | C01, C04, P02, P03 | **Covered** — Unicode strings, ordinal scalar comparison, exact golden bytes, and byte-identical import/export establish preservation without trimming, case folding, normalization, locale comparison, or presentation identity substitution. |
| CCA-MIP-014 | MIP uniqueness, indexes, endpoint and derived closure | P07–P09, A03 | **Covered** — duplicate identity, dangling relationship endpoint, wrong derived binding, and complete unambiguous Observation/Trace/Replay/Evolution/Comparative closure are exercised through the generic identity indexes. |
| CCA-MIP-015 | MIP Observation/record/relationship structural validators | S01, S03, S05, P07 | **Covered** — the exact frozen schema and complete vector exercise all five roles and relationship shape, while independent and implementation validators reject representative closed-shape violations. |
| CCA-MIP-016 | MIP export attestations, detached canonical clone, staged publication | P03, A11 | **Covered** — accepted detached input succeeds; explicit rejected-source and malformed/partial drafts fail before bytes or package state are published. Acquisition is represented by the explicit Producer boundary rather than an implementation-specific adapter. |
| CCA-MIP-017 | MIP `scanProhibited` | P12, A10, A12 | **Covered** — observing query, transient result, route, highlight, layout/view/control, renderer, cache, diagnostics, Provider, and Runtime residue are exercised in extensible source-revision and extension locations. |
| CCA-MIP-018 | MIP Observation sort and strict sequence checks in `validateModel` | P01, O04–O06 | **Covered** — noncontiguous increasing sequences are valid and preserved, while duplicate/descending package chronology and Producer source chronology inversion fail before normalization can hide the error. |
| CCA-MIP-019 | MIP canonical Observation/record/relationship sorting | P02, P03, P07, C08–C10 | **Covered** — deliberately reversed record insertion is normalized to exact golden bytes, repeated exports match, scalar comparison is locale-independent, and revision/provenance arrays survive byte-identical round trip. |
| CCA-MIP-020 | MIP `validateProvenance`; export/import preservation | P02, A02, A04 | **Covered** — all role cardinalities, ordered evidence, relationship reuse/connectivity, exact revision round trip, and forward/reverse direction are exercised. The closed tiered role grammar makes a cycle necessarily violate a tested role/connectivity invariant. |
| CCA-MIP-021 | MIP `constructTrace`, `validateTraces` | P07, P08, A03 | **Covered** — included Observation/Workspace/target closure succeeds, non-Reflection target and wrong binding fail, and independent reconstruction requires every branch to terminate at the exact target. |
| CCA-MIP-022 | MIP Trace structural validation and reconstruction | P08, A03 | **Covered** — fixed role grammar, reordered steps, noncontiguous branch/step indices, target terminal behavior, and exact reconstruction are exercised; structural variants share the same closed validator. |
| CCA-MIP-023 | MIP `relationshipDirection`, `constructTrace` | P08, A02–A04 | **Covered** — forward and reverse stored endpoints, role/connectivity consistency, terminal relationship omission, and null terminal direction are exercised; generic reconstruction handles endpoint permutations. |
| CCA-MIP-024 | MIP independent `constructTrace` equality check | P08, A03, A04, D01, S03 | **Covered** — stored-vs-rebuilt equality, forward/reverse relationships, ordered evidence, shared evidence, multiple semantic branches, Reflection fan-in, branch order, and exact reconstruction are exercised. |
| CCA-MIP-025 | MIP Replay schema, binding, and `constructReplay` | P07, P08, A03, S03 | **Covered** — complete binding succeeds; wrong Trace/side binding, non-Trace projection, and injected semantic payload fail through closure, reconstruction, or the closed schema. |
| CCA-MIP-026 | MIP independent first-seen Replay projection | P08, A04, D02, S03 | **Covered** — forward/reverse projection, fixed role ordering, multi-branch traversal, and first-seen node/relationship suppression are reconstructed and checked exactly. |
| CCA-MIP-027 | MIP contiguous Replay index/final-target validation | A03, P08 | **Covered** — missing final target and deterministic projection/index behavior are exercised. |
| CCA-MIP-028 | MIP closed Replay schema and prohibited scan | P12, A10, S03, S05 | **Covered** — closed Replay shape plus camera, Follow, navigation, control, route, timer-like and renderer-state representatives establish the controller/presentation exclusion boundary. |
| CCA-MIP-029 | MIP Evolution dependency and chronology validation | P07, P09, A05, A06 | **Covered** — same-Workspace ordered, nonadjacent Observation pairs are accepted and independently reconstructed; Workspace and strict chronology use the same tested model boundaries. |
| CCA-MIP-030 | MIP `DIFFERENCE_KINDS`, `constructEvolution` | A05, A06, P09 | **Covered** — all eleven record/relationship difference kinds, including replacement as add/remove, are exercised. |
| CCA-MIP-031 | MIP record/relationship revision digests and Evolution reconstruction | P09, A05, A06 | **Covered** — exact added/removed null semantics and modified-relationship digests are exercised. |
| CCA-MIP-032 | MIP independent `constructEvolution` equality check | P09, A05, A06 | **Covered** — recomputation, kind ordering, subject ordering, contiguous indices, and mismatch rejection are exercised across the difference kinds. |
| CCA-MIP-033 | MIP closed Evolution schema and prohibited scan | P09, P12, A05, A06, A10, S03, S05 | **Covered** — Evolution accepts only closed ordered digest records; renderer, summary, unchanged-world, presentation, and generated-content representatives are rejected generically across extensible locations. |
| CCA-MIP-034 | MIP `validateComparatives` dependency closure | P07, P09, P10, A07 | **Covered** — the complete dependency graph succeeds, derived-artifact inconsistency fails before publication, and reconstruction resolves the exact two Trace, Observation, and ordered Evolution identifiers rather than trusting stored moments. |
| CCA-MIP-035 | MIP `alignSides`, reason ordering, `constructComparative` | P09, A07, D03, D04, S03 | **Covered** — shared, A-only, B-only, semantic-revision, relationship-revision, and Trace-binding divergence are exercised; equal-length LCS ties choose Observation A and combined reason codes use the mandated exact order. |
| CCA-MIP-036 | MIP independent Comparative reconstruction/equality | P09, A07, P12, A10, S03 | **Covered** — independently rebuilt moments, A/B divergence, ordered divergence indices, exact mismatch rejection, and the closed controller/projection-free model are exercised. |
| CCA-MIP-037 | CAN JCS equality; MIP canonical-byte phase | C04, C08–C10, P02, P05 | **Covered** — exact vectors round-trip and noncanonical input is rejected rather than repaired. |
| CCA-MIP-038 | CAN exact Unicode and safe-number domain | C01, C03–C05, O01, P02 | **Covered** — exact Unicode strings, safe integer extrema, rejected unsafe numeric tokens/values, and source-declared decimal strings beyond the interoperable integer range are exercised without coercion. |
| CCA-MIP-039 | MIP scalar comparator and all collection-specific sorting | P03, P13, C04, C08–C10 | **Covered** — insertion-order independence, exact published collection order, repeat export, ordinal scalar comparison, and absence of clock/random/renderer dependencies are exercised. |
| CCA-MIP-040 | MIP fixed verification structure/evidence and Producer attestations | P03, P06–P12, S01–S05 | **Covered** — exact six-check order/profile/status, wrong and extra check rejection, independent recomputation of the mechanically decidable checks, and explicit Producer source-authorship attestation are exercised. Source authorship remains an external truth asserted at the Producer boundary, as the requirement mandates. |
| CCA-MIP-041 | CAN `mipDigest`; MIP `computeMipIntegrity` | C06, C08–C10, P06, A01 | **Covered** — every frozen section golden digest, fixed name order, domain separation, lowercase encoding, and independent embedded section mismatch are exercised. |
| CCA-MIP-042 | MIP cognition commitment selection | C08–C10, P02, A01 | **Covered** — exact golden cognition digests and semantic-vs-metadata scope separation are exercised. |
| CCA-MIP-043 | MIP package commitment | C08–C10, P02, A01 | **Covered** — exact golden computation commits all three header values and every section digest; metadata, semantic, and extension-distinct vectors plus an independent package mismatch exercise the commitment boundary. |
| CCA-MIP-044 | MIP exposes recomputable digests only; documentation assurance boundary | C06, A01; [integrity documentation](memory-investigation-packages.md#integrity-and-compatibility) | **Review** — tests demonstrate locally recomputable commitments and documentation distinguishes integrity from authenticity; authenticity necessarily requires external trust or a separately specified critical extension. |
| CCA-MIP-045 | MIP `PHASE`, staged `verifyMemoryInvestigationPackage`, private result publication | P05, P06, P10, A08, L01 | **Covered** — adjacent multi-defect vectors instrument all thirteen normative phases and prove that each earlier phase wins before any partial package can be published. |
| CCA-MIP-046 | MIP stable diagnostic creation/sort/public projection | P05, A08, A11, L02, L03 | **Covered** — every closed diagnostic code is exercised with code/path-only immutable shape and valid RFC 6901 pointers; multi-diagnostic results are deterministically ordered by path then code within a phase. |
| CCA-MIP-047 | MIP independent reconstruction in all four derived validators | P08–P10, A03, A05–A07 | **Covered** — checksum-valid semantic mismatches are rejected for Trace, Replay, Evolution, and Comparative Reconstruction, so schema and integrity cannot substitute for semantic validity. Dependency negatives are representative rather than Cartesian. |
| CCA-MIP-048 | MIP staged verify/import, exact clone/freeze, noncritical preservation | C07, P02, P04–P06, P10, P11, A08, A11, L01–L03, L06–L08 | **Covered** — every validation phase and stable diagnostic family is exercised; invalid input is not repaired, no partial state is exposed, exact identity/order/extensions/version are preserved, and only deeply immutable verified state is returned. |
| CCA-MIP-049 | MIP preflight/parser/resource policy | P10, A11 | **Covered** — byte, nesting-depth, hard parser depth, value-count, and comparative-alignment ceilings all return `RESOURCE_LIMIT_EXCEEDED` with no package publication or caller-state mutation. |
| CCA-MIP-050 | MIP export attestations, normalization, closure, reconstruction, policy validation | P03, P07–P12, A02–A12 | **Covered** — coherent truth-preserving export, deterministic ordering, identity/closure, independent derivation, extension, prohibited-content, malformed-input, and explicit trust failures are exercised before publication. |
| CCA-MIP-051 | MIP private create → integrity → verify → detached-byte return pipeline | P02, P03, A11, L04, L05 | **Covered** — the public Producer publishes only a newly allocated detached byte value after complete verification; failures return no bytes and cannot mutate caller-owned input or a preexisting destination sentinel. The module intentionally performs no filesystem replacement and makes no claim about host storage transactions. |
| CCA-MIP-052 | MIP immutable inputs/results and throw-before-return failures | C07, P03, P06, P10, A11, L04–L06 | **Covered** — export, artifact, verification, import, semantic, integrity, prohibited-content, version, and resource failures publish neither bytes nor package state and preserve caller-owned and preexisting state. JavaScript allocator and host-filesystem fault injection are outside this detached-value API; atomicity is established at its actual publication boundary. |
| CCA-MIP-053 | MIP extension schema, reverse-DNS rule, and feature bijection | P11, A09, S01, S04, S05 | **Covered** — exact frozen extension shape, valid optional payload, invalid namespace/version, feature-only, extension-only, critical support, and bijection behavior are exercised. |
| CCA-MIP-054 | MIP closed core, `scanExtensionDuplications`, prohibited scan | P12, A09, A10, S05 | **Covered** — core-like payload members, exact semantic payload duplication, executable/opaque values, invalid names/shapes, and prohibited-content evasion representatives are rejected. |
| CCA-MIP-055 | MIP canonical extension preservation and round trip | P02, P11, C10, L07, S04 | **Covered** — the frozen unknown noncritical extension survives serialize, re-export, artifact, and new-publication paths exactly; its canonical payload and committed bytes are unchanged. Because the pure JSON API has no lossy extension conversion path, success itself proves preservation and any invalid/unrepresentable value fails before publication. |
| CCA-MIP-056 | MIP critical extension support check | P11, A09, A12 | **Covered** — unsupported rejection, supported acceptance, and atomic package-null failure are exercised. |
| CCA-MIP-057 | MIP stable wire-version and extension-version syntax | P05, P11, A09, A12 | **Review** — syntax/independence are executable; the normative MAJOR/MINOR/PATCH change-classification matrix is a specification/governance review, not a runtime operation, and has no dedicated automated policy test. |
| CCA-MIP-058 | MIP same-major compatibility and closed unknown-member policy | P05, P11, A09, A12, L07, L08 | **Covered** — newer same-major input is preserved byte-for-byte, unknown major/core input fails, optional and critical extension behavior is explicit, a caller-requested representable downgrade preserves every semantic section and extension, and implicit/lossy version coercion is rejected. |
| CCA-MIP-059 | MIP prohibited key/value scan | P12, A10 | **Covered** — screenshots, data/media URIs, active media, archive/binary signatures, and front-end state representatives are rejected in source revisions and extensions. The test is category-based rather than every-format-by-every-location Cartesian expansion. |
| CCA-MIP-060 | MIP prohibited key/value scan and closed derived schemas | P12, A10, S05 | **Covered** — graph/camera/layout/view/control/highlight/Follow/navigation/inspector/route and renderer-state representatives are rejected while source-authored homonyms remain valid. |
| CCA-MIP-061 | MIP prohibited generated/inferred-content and duplication scan | P12, A10, A12 | **Covered** — display summaries, AI/LLM-generated text, generated explanations, derived payload duplication, and source-authored homonyms are distinguished and exercised. |
| CCA-MIP-062 | MIP prohibited operational/security scan | P12, A10, A11, A12 | **Covered** — cache/index/log/history/diagnostics, Runtime/event-bus/registry/injector, Provider details, credentials, endpoint/transport, path, and storage-configuration representatives are rejected. |
| CCA-MIP-063 | MIP prohibited executable/opaque value scan | P12, A10, A12 | **Covered** — executable source/forms, script/data URIs, compressed/archive/native/binary signatures, and opaque payload representatives are rejected; safe source-authored text is retained. |
| CCA-MIP-064 | MIP Producer `sourceAuthorshipAttested` boundary and duplication scan | P03, P12, A10, A12 | **Covered** — exact source-authored text, including potentially ambiguous field names, is preserved; missing attestation, copied semantic payload, credentials, media, and executable content fail. Whether text truly originated in the source remains Producer conformance evidence and is intentionally not inferred from bytes. |

## Evidence assets

The frozen schema and three published golden vectors are vendored under
[`tests/fixtures/mip/`](../tests/fixtures/mip/) as Base64 text fixtures. Tests
decode them to their exact original bytes and assert the frozen schema SHA-256,
golden file SHA-256 values, canonical bytes, section digests, cognition digest,
and package digest. Base64 is a repository transport encoding only; decoded
bytes are the conformance inputs.

This keeps the implementation repository's test run independent of a sibling
specification checkout while making accidental fixture drift detectable. The
frozen specification package remains authoritative and is not modified by
MO-1201.

## Assurance boundary

The final suite provides direct automated evidence for the central normative
behavior of every mechanically decidable MIP-001 requirement. Generic schema,
ordering, and prohibited-content rules are tested by representative category
and deterministic shared validator, rather than by an unbounded Cartesian
product of equivalent field mutations.

Two requirements are classified as **Review**:

1. **CCA-MIP-044** distinguishes checksum integrity from producer authenticity.
   Package bytes can prove the former; authenticity requires external trust or
   a separately specified critical extension.
2. **CCA-MIP-057** classifies future specification changes as MAJOR, MINOR, or
   PATCH. Runtime tests cover version syntax and compatibility behavior, while
   classification of a future specification revision is a governance review.

The module publishes detached JavaScript values and byte arrays. Its atomicity
claims end at that public API boundary: it does not write files, replace durable
destinations, or expose allocator hooks. Likewise, source-authorship
attestation is explicit Producer evidence and is never inferred from package
text. These boundaries prevent the conformance record from claiming host or
external assurances that MIP bytes cannot establish.

# MemoryOS Reference Implementation Conformance Report

## Purpose

This deterministic report evaluates MemoryOS Reference Implementation 1.2.1 against CCA-MEMORYOS-1.0.

## Assessment

- Standard publication: CCA-MEMORYOS-1.0 1.0 (2026-09-05; sha256:f77246da755e67c5e7e73706504c6d63641eeb711fbbe9c381b10d197a3dc716)
- Conformance specification: 1.0.0
- Conformance suite: memoryos-conformance 1.0.0
- Scope: complete (AI Runtime Adapter, CLI, Cognitive Investigation Explorer, Cognitive Regression, Investigation Core, MIP Integration, Native Investigation Artifacts, Runtime Observation Boundary, SDK)
- Native projection profile: cca-studio-native-observation 1.1.0
- Evidence root: evidence/reference-implementation-1.2.1.json
- Evidence digest: sha256:d2c03068ccf0e3e4aab8d82c9cb1f831010630445605ee27e566b1a0ad3074ec
- Assessor: MemoryOS v1.2.1 Restoration Review
- Assessment date: 2026-09-11
- Assessment level: C2

## Summary

- PASS: 218
- FAIL: 0
- NOT APPLICABLE: 0
- Total normative requirements: 218

## Evidence

| Group | Method | Status | Durable evidence |
| --- | --- | --- | --- |
| MOS-EVID-ADAPT-001 | deterministic requirement-mapped conformance execution | PASS | evidence/reference-implementation-1.2.1.json#/evidence/0 |
| MOS-EVID-ART-001 | deterministic requirement-mapped conformance execution | PASS | evidence/reference-implementation-1.2.1.json#/evidence/1 |
| MOS-EVID-CLI-001 | deterministic requirement-mapped conformance execution | PASS | evidence/reference-implementation-1.2.1.json#/evidence/2 |
| MOS-EVID-COMP-001 | deterministic requirement-mapped conformance execution | PASS | evidence/reference-implementation-1.2.1.json#/evidence/3 |
| MOS-EVID-CONF-001 | deterministic requirement-mapped conformance execution | PASS | evidence/reference-implementation-1.2.1.json#/evidence/4 |
| MOS-EVID-CORE-001 | deterministic requirement-mapped conformance execution | PASS | evidence/reference-implementation-1.2.1.json#/evidence/5 |
| MOS-EVID-EXPL-001 | deterministic requirement-mapped conformance execution | PASS | evidence/reference-implementation-1.2.1.json#/evidence/6 |
| MOS-EVID-LIFE-001 | deterministic requirement-mapped conformance execution | PASS | evidence/reference-implementation-1.2.1.json#/evidence/7 |
| MOS-EVID-MIP-001 | deterministic requirement-mapped conformance execution | PASS | evidence/reference-implementation-1.2.1.json#/evidence/8 |
| MOS-EVID-REG-001 | deterministic requirement-mapped conformance execution | PASS | evidence/reference-implementation-1.2.1.json#/evidence/9 |
| MOS-EVID-RT-001 | deterministic requirement-mapped conformance execution | PASS | evidence/reference-implementation-1.2.1.json#/evidence/10 |
| MOS-EVID-SDK-001 | deterministic requirement-mapped conformance execution | PASS | evidence/reference-implementation-1.2.1.json#/evidence/11 |
| MOS-EVID-VER-001 | deterministic requirement-mapped conformance execution | PASS | evidence/reference-implementation-1.2.1.json#/evidence/12 |

## Requirement results

| Requirement | Title | Status | Evidence group | Evidence reference | Reason |
| --- | --- | --- | --- | --- | --- |
| CCA-MIP-001 | Single-Workspace package boundary | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/0 | — |
| CCA-MIP-002 | Observation payload ownership | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/1 | — |
| CCA-MIP-003 | Runtime and presentation independence | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/2 | — |
| CCA-MIP-004 | Immutable package identity | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/3 | — |
| CCA-MIP-005 | Single canonical JSON document | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/4 | — |
| CCA-MIP-006 | Closed JSON value domain | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/5 | — |
| CCA-MIP-007 | Exact core package layout | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/6 | — |
| CCA-MIP-008 | Deterministic manifest contract | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/7 | — |
| CCA-MIP-009 | Technical metadata boundary | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/8 | — |
| CCA-MIP-010 | No manufactured investigation artifacts | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/9 | — |
| CCA-MIP-011 | Typed reference identity tuple | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/10 | — |
| CCA-MIP-012 | Deterministic occurrence assignment | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/11 | — |
| CCA-MIP-013 | Exact source identifier preservation | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/12 | — |
| CCA-MIP-014 | Unique closed references | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/13 | — |
| CCA-MIP-015 | Closed Observation record model | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/14 | — |
| CCA-MIP-016 | Coherent detached Observation acceptance | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/15 | — |
| CCA-MIP-017 | Observation semantic-only payload | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/16 | — |
| CCA-MIP-018 | Observation chronology | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/17 | — |
| CCA-MIP-019 | Canonical Observation member order | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/18 | — |
| CCA-MIP-020 | Observation role and revision fidelity | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/19 | — |
| CCA-MIP-021 | Trace Observation and Reflection binding | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/20 | — |
| CCA-MIP-022 | Trace branch and role grammar | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/21 | — |
| CCA-MIP-023 | Trace relationship traversal integrity | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/22 | — |
| CCA-MIP-024 | Exact deterministic Trace reconstruction | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/23 | — |
| CCA-MIP-025 | Replay reference-only binding | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/24 | — |
| CCA-MIP-026 | Deterministic Replay projection | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/25 | — |
| CCA-MIP-027 | Replay contiguity and terminal target | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/26 | — |
| CCA-MIP-028 | Replay controller-state exclusion | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/27 | — |
| CCA-MIP-029 | Ordered Evolution binding | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/28 | — |
| CCA-MIP-030 | Closed Evolution difference kinds | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/29 | — |
| CCA-MIP-031 | Evolution revision-digest semantics | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/30 | — |
| CCA-MIP-032 | Exact deterministic Evolution reconstruction | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/31 | — |
| CCA-MIP-033 | Evolution semantic-only difference boundary | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/32 | — |
| CCA-MIP-034 | Comparative Reconstruction dependency closure | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/33 | — |
| CCA-MIP-035 | Deterministic comparative alignment | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/34 | — |
| CCA-MIP-036 | Exact comparative reconstruction | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/35 | — |
| CCA-MIP-037 | Canonical-byte acceptance | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/36 | — |
| CCA-MIP-038 | Scalar canonical fidelity | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/37 | — |
| CCA-MIP-039 | Complete semantic array ordering | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/38 | — |
| CCA-MIP-040 | Fixed verification evidence | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/39 | — |
| CCA-MIP-041 | Section digest computation | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/40 | — |
| CCA-MIP-042 | Cognition digest computation | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/41 | — |
| CCA-MIP-043 | Package digest computation | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/42 | — |
| CCA-MIP-044 | Checksum assurance boundary | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/43 | — |
| CCA-MIP-045 | Ordered atomic validation pipeline | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/44 | — |
| CCA-MIP-046 | Stable deterministic diagnostics | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/45 | — |
| CCA-MIP-047 | Conditional artifact validity | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/46 | — |
| CCA-MIP-048 | Untrusted staged import | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/47 | — |
| CCA-MIP-049 | Resource-limit import failure | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/48 | — |
| CCA-MIP-050 | Truth-preserving export preparation | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/49 | — |
| CCA-MIP-051 | Canonical atomic export publication | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/50 | — |
| CCA-MIP-052 | Failure-state preservation | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/51 | — |
| CCA-MIP-053 | Namespaced extension shape | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/52 | — |
| CCA-MIP-054 | Extension semantic boundary | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/53 | — |
| CCA-MIP-055 | Unknown noncritical extension preservation | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/54 | — |
| CCA-MIP-056 | Unknown critical extension rejection | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/55 | — |
| CCA-MIP-057 | Independent semantic wire versioning | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/56 | — |
| CCA-MIP-058 | Deterministic version compatibility | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/57 | — |
| CCA-MIP-059 | Media and front-end asset exclusion | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/58 | — |
| CCA-MIP-060 | Presentation and controller-state exclusion | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/59 | — |
| CCA-MIP-061 | Generated and inferred content exclusion | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/60 | — |
| CCA-MIP-062 | Operational state and secret exclusion | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/61 | — |
| CCA-MIP-063 | Executable and opaque payload exclusion | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/62 | — |
| CCA-MIP-064 | Source-authored cognition fidelity | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/63 | — |
| CCA-MOS-ADAPT-001 | Provider-independent adapter contract | PASS | MOS-EVID-ADAPT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/64 | — |
| CCA-MOS-ADAPT-002 | External Runtime ownership | PASS | MOS-EVID-ADAPT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/65 | — |
| CCA-MOS-ADAPT-003 | Settled source requirement | PASS | MOS-EVID-ADAPT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/66 | — |
| CCA-MOS-ADAPT-004 | Explicit deterministic adapter request | PASS | MOS-EVID-ADAPT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/67 | — |
| CCA-MOS-ADAPT-005 | Source-authorship attestation | PASS | MOS-EVID-ADAPT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/68 | — |
| CCA-MOS-ADAPT-006 | Context-only truth-preserving projection | PASS | MOS-EVID-ADAPT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/69 | — |
| CCA-MOS-ADAPT-007 | Observation-only MIP output | PASS | MOS-EVID-ADAPT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/70 | — |
| CCA-MOS-ADAPT-008 | Deterministic atomic adapter output | PASS | MOS-EVID-ADAPT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/71 | — |
| CCA-MOS-ADAPT-009 | Stable adapter diagnostics | PASS | MOS-EVID-ADAPT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/72 | — |
| CCA-MOS-ART-001 | Observation Frame binding | PASS | MOS-EVID-ART-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/73 | — |
| CCA-MOS-ART-002 | Trace identity and shape | PASS | MOS-EVID-ART-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/74 | — |
| CCA-MOS-ART-003 | Trace reconstruction | PASS | MOS-EVID-ART-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/75 | — |
| CCA-MOS-ART-004 | Trace validation | PASS | MOS-EVID-ART-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/76 | — |
| CCA-MOS-ART-005 | Replay construction | PASS | MOS-EVID-ART-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/77 | — |
| CCA-MOS-ART-006 | Replay state machine | PASS | MOS-EVID-ART-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/78 | — |
| CCA-MOS-ART-007 | Evolution input binding | PASS | MOS-EVID-ART-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/79 | — |
| CCA-MOS-ART-008 | Evolution difference classes | PASS | MOS-EVID-ART-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/80 | — |
| CCA-MOS-ART-009 | Evolution comparison and order | PASS | MOS-EVID-ART-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/81 | — |
| CCA-MOS-ART-010 | Evolution identity and world | PASS | MOS-EVID-ART-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/82 | — |
| CCA-MOS-ART-011 | Comparative input binding | PASS | MOS-EVID-ART-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/83 | — |
| CCA-MOS-ART-012 | Comparative alignment | PASS | MOS-EVID-ART-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/84 | — |
| CCA-MOS-ART-013 | Comparative divergence | PASS | MOS-EVID-ART-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/85 | — |
| CCA-MOS-ART-014 | Comparative value and validation | PASS | MOS-EVID-ART-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/86 | — |
| CCA-MOS-ART-015 | Comparative Replay | PASS | MOS-EVID-ART-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/87 | — |
| CCA-MOS-ART-016 | Artifact independence and atomicity | PASS | MOS-EVID-ART-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/88 | — |
| CCA-MOS-CLI-001 | CLI executable and commands | PASS | MOS-EVID-CLI-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/89 | — |
| CCA-MOS-CLI-002 | SDK-only CLI dependency | PASS | MOS-EVID-CLI-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/90 | — |
| CCA-MOS-CLI-003 | Explicit noninteractive CLI | PASS | MOS-EVID-CLI-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/91 | — |
| CCA-MOS-CLI-004 | Human and JSON output modes | PASS | MOS-EVID-CLI-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/92 | — |
| CCA-MOS-CLI-005 | Deterministic JSON framing | PASS | MOS-EVID-CLI-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/93 | — |
| CCA-MOS-CLI-006 | Deterministic exit codes | PASS | MOS-EVID-CLI-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/94 | — |
| CCA-MOS-CLI-007 | Investigation command fidelity | PASS | MOS-EVID-CLI-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/95 | — |
| CCA-MOS-CLI-008 | Regression and Explorer forwarding | PASS | MOS-EVID-CLI-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/96 | — |
| CCA-MOS-CLI-009 | Session and checkpoint isolation | PASS | MOS-EVID-CLI-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/97 | — |
| CCA-MOS-CLI-010 | Output stream integrity | PASS | MOS-EVID-CLI-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/98 | — |
| CCA-MOS-COMP-001 | Observable behavioral compatibility | PASS | MOS-EVID-COMP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/99 | — |
| CCA-MOS-COMP-002 | Backward-compatible evolution | PASS | MOS-EVID-COMP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/100 | — |
| CCA-MOS-COMP-003 | Closed-contract forward handling | PASS | MOS-EVID-COMP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/101 | — |
| CCA-MOS-COMP-004 | Incorporated MIP compatibility | PASS | MOS-EVID-COMP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/102 | — |
| CCA-MOS-COMP-005 | Independent compatibility identities | PASS | MOS-EVID-COMP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/103 | — |
| CCA-MOS-COMP-006 | No silent compatibility conversion | PASS | MOS-EVID-COMP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/104 | — |
| CCA-MOS-CONF-001 | Complete conformance coverage | PASS | MOS-EVID-CONF-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/105 | — |
| CCA-MOS-CONF-002 | Scoped claim labeling | PASS | MOS-EVID-CONF-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/106 | — |
| CCA-MOS-CONF-003 | Deterministic conformance evidence | PASS | MOS-EVID-CONF-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/107 | — |
| CCA-MOS-CONF-004 | Attributable evidence manifest | PASS | MOS-EVID-CONF-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/108 | — |
| CCA-MOS-CONF-005 | Closed conformance result vocabulary | PASS | MOS-EVID-CONF-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/109 | — |
| CCA-MOS-CONF-006 | No schema-only semantic evidence | PASS | MOS-EVID-CONF-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/110 | — |
| CCA-MOS-CONF-007 | Complete conformance claim identity | PASS | MOS-EVID-CONF-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/111 | — |
| CCA-MOS-CORE-001 | Single Investigation Core authority | PASS | MOS-EVID-CORE-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/112 | — |
| CCA-MOS-CORE-002 | Isolated Core ownership | PASS | MOS-EVID-CORE-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/113 | — |
| CCA-MOS-CORE-003 | Closed Core operations | PASS | MOS-EVID-CORE-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/114 | — |
| CCA-MOS-CORE-004 | Immutable canonical Core values | PASS | MOS-EVID-CORE-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/115 | — |
| CCA-MOS-CORE-005 | Native derivation fidelity | PASS | MOS-EVID-CORE-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/116 | — |
| CCA-MOS-CORE-006 | MIP authorship fidelity | PASS | MOS-EVID-CORE-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/117 | — |
| CCA-MOS-CORE-007 | Core package boundary | PASS | MOS-EVID-CORE-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/118 | — |
| CCA-MOS-CORE-008 | Read-only Regression and Explorer | PASS | MOS-EVID-CORE-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/119 | — |
| CCA-MOS-CORE-009 | Renderer-independent Core | PASS | MOS-EVID-CORE-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/120 | — |
| CCA-MOS-CORE-010 | Ambient-state independence | PASS | MOS-EVID-CORE-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/121 | — |
| CCA-MOS-CORE-011 | Core resource bounds | PASS | MOS-EVID-CORE-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/122 | — |
| CCA-MOS-CORE-012 | Stable atomic Core failure | PASS | MOS-EVID-CORE-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/123 | — |
| CCA-MOS-EXPL-001 | Existing-report Explorer navigation | PASS | MOS-EVID-EXPL-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/124 | — |
| CCA-MOS-EXPL-002 | Closed Explorer query | PASS | MOS-EVID-EXPL-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/125 | — |
| CCA-MOS-EXPL-003 | Lexical transition normalization | PASS | MOS-EVID-EXPL-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/126 | — |
| CCA-MOS-EXPL-004 | Explorer result identity | PASS | MOS-EVID-EXPL-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/127 | — |
| CCA-MOS-EXPL-005 | Deterministic Explorer match order | PASS | MOS-EVID-EXPL-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/128 | — |
| CCA-MOS-EXPL-006 | Exact Explorer evidence endpoints | PASS | MOS-EVID-EXPL-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/129 | — |
| CCA-MOS-EXPL-007 | No alternate Explorer cognition | PASS | MOS-EVID-EXPL-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/130 | — |
| CCA-MOS-EXPL-008 | Deterministic atomic Explorer failure | PASS | MOS-EVID-EXPL-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/131 | — |
| CCA-MOS-LIFE-001 | Closed lifecycle state set | PASS | MOS-EVID-LIFE-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/132 | — |
| CCA-MOS-LIFE-002 | Closed lifecycle transitions | PASS | MOS-EVID-LIFE-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/133 | — |
| CCA-MOS-LIFE-003 | Authoritative transition log | PASS | MOS-EVID-LIFE-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/134 | — |
| CCA-MOS-LIFE-004 | Atomic state derivation | PASS | MOS-EVID-LIFE-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/135 | — |
| CCA-MOS-LIFE-005 | Atomic Trace and Replay preparation | PASS | MOS-EVID-LIFE-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/136 | — |
| CCA-MOS-LIFE-006 | Replay action set and no-op | PASS | MOS-EVID-LIFE-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/137 | — |
| CCA-MOS-LIFE-007 | Comparison flow and restoration | PASS | MOS-EVID-LIFE-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/138 | — |
| CCA-MOS-LIFE-008 | Point-in-time verification | PASS | MOS-EVID-LIFE-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/139 | — |
| CCA-MOS-LIFE-009 | Terminal archive | PASS | MOS-EVID-LIFE-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/140 | — |
| CCA-MOS-LIFE-010 | Return-to-world behavior | PASS | MOS-EVID-LIFE-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/141 | — |
| CCA-MOS-LIFE-011 | Integrity-bound checkpoint restoration | PASS | MOS-EVID-LIFE-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/142 | — |
| CCA-MOS-LIFE-012 | Source-authored MIP capability availability | PASS | MOS-EVID-LIFE-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/143 | — |
| CCA-MOS-MIP-001 | Complete MIP requirement incorporation | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/144 | — |
| CCA-MOS-MIP-002 | Baseline export identity | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/145 | — |
| CCA-MOS-MIP-003 | Strict atomic MIP import | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/146 | — |
| CCA-MOS-MIP-004 | Exact authored MIP export | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/147 | — |
| CCA-MOS-MIP-005 | Single portable package semantics | PASS | MOS-EVID-MIP-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/148 | — |
| CCA-MOS-REG-001 | Read-only compatible Regression operands | PASS | MOS-EVID-REG-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/149 | — |
| CCA-MOS-REG-002 | Regression report identity | PASS | MOS-EVID-REG-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/150 | — |
| CCA-MOS-REG-003 | Closed ordered Regression categories | PASS | MOS-EVID-REG-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/151 | — |
| CCA-MOS-REG-004 | Closed ordered Regression differences | PASS | MOS-EVID-REG-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/152 | — |
| CCA-MOS-REG-005 | Digest-only Regression facts | PASS | MOS-EVID-REG-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/153 | — |
| CCA-MOS-REG-006 | Authoritative Regression fact basis | PASS | MOS-EVID-REG-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/154 | — |
| CCA-MOS-REG-007 | Exact Regression overall result | PASS | MOS-EVID-REG-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/155 | — |
| CCA-MOS-REG-008 | Deterministic atomic Regression | PASS | MOS-EVID-REG-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/156 | — |
| CCA-MOS-RT-001 | Runtime Foundation incorporation | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/157 | — |
| CCA-MOS-RT-002 | Runtime source authority | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/158 | — |
| CCA-MOS-RT-003 | Settled Observation acceptance | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/159 | — |
| CCA-MOS-RT-004 | Deterministic Runtime boundary | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/160 | — |
| CCA-MOS-RT-005 | Workspace isolation | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/161 | — |
| CCA-MOS-RT-006 | Runtime and presentation independence | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/162 | — |
| CCA-MOS-SDK-001 | SDK facade and Core ownership | PASS | MOS-EVID-SDK-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/163 | — |
| CCA-MOS-SDK-002 | SDK version identity | PASS | MOS-EVID-SDK-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/164 | — |
| CCA-MOS-SDK-003 | Immutable same-client handles | PASS | MOS-EVID-SDK-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/165 | — |
| CCA-MOS-SDK-004 | SDK operation parity | PASS | MOS-EVID-SDK-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/166 | — |
| CCA-MOS-SDK-005 | Explicit SDK inputs | PASS | MOS-EVID-SDK-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/167 | — |
| CCA-MOS-SDK-006 | Exact SDK package transport | PASS | MOS-EVID-SDK-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/168 | — |
| CCA-MOS-SDK-007 | Exact Core forwarding | PASS | MOS-EVID-SDK-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/169 | — |
| CCA-MOS-SDK-008 | Cross-binding deterministic equivalence | PASS | MOS-EVID-SDK-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/170 | — |
| CCA-MOS-SDK-009 | SDK error preservation | PASS | MOS-EVID-SDK-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/171 | — |
| CCA-MOS-SDK-010 | No implicit SDK retry | PASS | MOS-EVID-SDK-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/172 | — |
| CCA-MOS-VER-001 | Independent version declarations | PASS | MOS-EVID-VER-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/173 | — |
| CCA-MOS-VER-002 | Baseline contract version fidelity | PASS | MOS-EVID-VER-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/174 | — |
| CCA-MOS-VER-003 | Incompatible Standard change classification | PASS | MOS-EVID-VER-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/175 | — |
| CCA-MOS-VER-004 | Compatible Standard change classification | PASS | MOS-EVID-VER-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/176 | — |
| CCA-MOS-VER-005 | Assessment and Reference Implementation versioning | PASS | MOS-EVID-VER-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/177 | — |
| CCA-RF-001 | Single Runtime Foundation boundary | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/178 | — |
| CCA-RF-002 | Architecture-first contracts | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/179 | — |
| CCA-RF-003 | Deterministic boundary outcomes | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/180 | — |
| CCA-RF-004 | Dependency Injection for required collaboration | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/181 | — |
| CCA-RF-005 | No mutable global state | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/182 | — |
| CCA-RF-006 | Explicit lifecycle contract | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/183 | — |
| CCA-RF-007 | Service Contract resolution | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/184 | — |
| CCA-RF-008 | Explicit Event Bus boundary | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/185 | — |
| CCA-RF-009 | Documented configuration model | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/186 | — |
| CCA-RF-010 | Documented observability model | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/187 | — |
| CCA-RF-011 | Runtime API philosophy | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/188 | — |
| CCA-RF-012 | Conformance evidence | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/189 | — |
| CCA-RF-013 | Headless Runtime | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/190 | — |
| CCA-RF-014 | Official Runtime host | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/191 | — |
| CCA-RF-015 | Multiple Runtime instances | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/192 | — |
| CCA-RF-016 | Independent execution contexts | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/193 | — |
| CCA-RF-017 | No global Runtime singleton | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/194 | — |
| CCA-RF-018 | Exact Runtime Foundation components | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/195 | — |
| CCA-RF-019 | Canonical CCA layer model | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/196 | — |
| CCA-RF-020 | Inter-layer dependency direction | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/197 | — |
| CCA-RF-021 | Normal Runtime lifecycle sequence | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/198 | — |
| CCA-RF-022 | Runtime immutability after Freeze | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/199 | — |
| CCA-RF-023 | Freeze before service startup | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/200 | — |
| CCA-RF-024 | Compile-time type-safe service resolution | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/201 | — |
| CCA-RF-025 | No string-based service lookup | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/202 | — |
| CCA-RF-026 | Internal Providers | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/203 | — |
| CCA-RF-027 | Contract provider cardinality | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/204 | — |
| CCA-RF-028 | Supported provider cardinalities | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/205 | — |
| CCA-RF-029 | Event Bus asynchronous notification | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/206 | — |
| CCA-RF-030 | Startup dependency graph | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/207 | — |
| CCA-RF-031 | Sequential startup dependency levels | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/208 | — |
| CCA-RF-032 | Optional same-level startup concurrency | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/209 | — |
| CCA-RF-033 | Reverse dependency shutdown | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/210 | — |
| CCA-RF-034 | Explicit Failed state | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/211 | — |
| CCA-RF-035 | Failure Rollback | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/212 | — |
| CCA-RF-036 | Deterministic failure cleanup | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/213 | — |
| CCA-RF-037 | Service registration documentation | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/214 | — |
| CCA-RF-038 | Dependency declaration documentation | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/215 | — |
| CCA-RF-039 | Error reporting documentation | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/216 | — |
| CCA-RF-040 | Thread-safety documentation | PASS | MOS-EVID-RT-001 | evidence/reference-implementation-1.2.1.json#/requirementEvidence/217 | — |

A passing report is verification evidence. Certification remains a separate governance decision.

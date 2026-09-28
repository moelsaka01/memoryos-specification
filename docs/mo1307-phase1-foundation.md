# MO-1307 Phase 1 readiness foundation

This report describes the implementation candidate for [Contract Freeze 1](mo1307-contract-freeze-1.md), rooted at `e0cb8e9cc6aa73e26945db30756a6667a8d9e322`. It is not the final task report or an I1/B1 acceptance assertion. Execution receipts, characterization, workspace verification and commit binding are recorded separately in the [Phase 1 evidence](../repositories/cca-conformance/evidence/mo1307/phase1). Phase 2 and Phase 3 are not started; release is not ready.

## Package and foundation

The separate private offline ESM package is [memoryos-readiness@0.1.0](../repositories/memoryos-readiness/package.json), implementing `memoryos.readiness@1.0.0`. It has zero external production npm dependencies, no lifecycle hooks and an exact 75-member allowlist. Runtime is externally supplied Node 24.21.0 win-x64. The pinned `node.exe` is 93,580,104 bytes, SHA-256 `ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32`. Windows PowerShell 5.1 is the fixed acquisition dependency; npm 11.19.0 is engineering/install tooling only. No runtime downloader, registry publication, network acquisition or provider account is introduced.

[definitions.json](../repositories/memoryos-readiness/contracts/definitions.json) centralizes four readiness states, six gate states, rest/cicd profiles, 22 gate definitions, 14 evidence types, seven qualification codes, 21 errors/exits, versions and all resource ceilings. The schema set has 52 Draft 2020-12 files and 96 shared definitions. Generated runtime constants/schema modules undergo exact byte-agreement checks. They load no filesystem or remote schemas at runtime.

Implemented foundations include strict duplicate-safe parsing/J encoding, SHA-256 identities, candidate cardinality/profile/component references, explicit manifest and envelope structures, snapshot/pin/byte integrity, bounded typed graph validation, external decision binding, exact output projections and reference readiness precedence. Provider representation checks reject false full-hosted certification while admitting known lower-minimum unsupported facts without fabricated hosted observations. These checks establish no provider execution lineage.

## Public and internal interfaces

The package root exports exactly two async functions:

```text
evaluateReadiness({configurationBytes,candidateBytes,manifestBytes,
 authorityBytes,files,expectedCandidateDigest,trustedAuthorityDigest},
 {signal}?)

verifyReadiness({configurationBytes,candidateBytes,manifestBytes,
 authorityBytes,files,expectedCandidateDigest,trustedAuthorityDigest,
 resultBytes,decisionBytes:null|Uint8Array}, {signal}?)
```

All Bytes arguments are `Uint8Array`; files is the sorted exact `[{id,bytes}]` manifest set. Closed own data properties, copied bounded snapshots, independent pins and SharedArrayBuffer rejection are foundation checks. The frozen eventual evaluate return is `{resultBytes,readinessDigest,proofBindingDigest}`; verify additionally returns `decision:null|{decision,consistency,authenticity}`. **Current valid Phase 1 inputs reach an explicit INTERNAL guard and return no readiness result.**

The CLI recognizes only `evaluate` and `verify`, exact Freeze flags and json/text format. Prototype-sensitive invented commands, extra/missing/duplicate flags and forbidden launch state reject. It performs no complete acquisition/evaluation pipeline. The fixed PowerShell helper validates its protocol and returns a closed error guard; it never reports fabricated successful handle inspection.

The exact current private module exports are enumerated in [requirements.json](../repositories/cca-conformance/evidence/mo1307/phase1/requirements.json). They are not additional package-root APIs. Later streams share these interfaces and the existing closed records:

| Module / interface | Established behavior and ownership |
|---|---|
| `canonical.mjs` | `canonicalBytes`, `parseCanonical`, `snapshotBytes`, raw/canonical/candidate/claim/readiness/proof digest helpers and `blockerId`. One shared canonical implementation; no stream-specific serializer. |
| `schema.mjs`, `constants.mjs`, `errors.mjs` | Closed `validateSchema(definition,value,options)`, structural equality, deeply frozen definitions, read-only error fields, exact exits and safe diagnostic serialization. Shared files remain centrally reconciled. |
| `inspectFoundationInputs(input,verify=false)` | Returns `{copies,parsed}`. Copies contains admitted control/file bytes and optional verification bytes; parsed contains configuration, candidate, manifest and authority. This is structural foundation integrity, not a complete verified authority projection. |
| Candidate/envelope/manifest/graph validators | Return candidate/claim digest or the validated record. Phase 2B owns complete authority, dependency closure, selective reuse, history and graph derivation, using the same representations. |
| `aggregateReference({gates,blockers,qualifications,cneReasons,history,providers})` | Returns detached retained arrays plus readiness for the complete 22-gate vector. It locks blocker > mandatory CNE > release qualification > READY. Phase 2A owns complete gate computation. |
| `validateResultIdentity` and `checkDecisionBinding` | Check internal identity consistency and downstream decision binding. Self-consistent hashes are insufficient authority. Full 2B/2C recomputation must precede acceptance. Verification shape failures use RESULT_MISMATCH/DECISION_MISMATCH; resource admission retains its operational category. |
| `summaryProjection` and `textProjection` | Render supplied verified result data in exact frozen order with complete bounded output. Phase 2A owns content; 2C owns transport. |
| `windows-paths.mjs` | Validates lexical paths, containment, distinctness and supplied identities/chains. Phase 2C supplies trustworthy checked native identity observations. |
| `helper-protocol.mjs` | Request/response validate/encode/decode functions; `createHelperSequence(command)` returns `{begin,complete,abort}`. Four serial slots; no overlap, fifth request or retry. |
| `publication.mjs` | `createPublication(root,{inspect,checkpoint})` returns an opaque token; `stagePublication(token,bytes)` and `finalizePublication(token)` enforce single-use staging/finalization. Phase 2C provides trusted inspection and operational checkpoints. |

The private helper request is `{kind,version,sequence,operation,roots:[{id,path}],files:[{id,maxBytes,path,root}]}`. Response is `{kind,version,sequence,operation,status,code,roots:[{id,identity}],files:[{id,identity,bytes}]}`. Identity is `{attributes,byteLength,fileId,finalPath,isDirectory,linkCount,volumeSerial}`. Frames contain a four-byte big-endian body length followed by J bytes. Snapshot data uses canonical base64 chunks of at most 4096 characters, with separate encoded/decoded limits. These are Freeze-permitted private framing choices, not public commands.

Phase 1 does not introduce a new claim of verified authority between streams. Phase 2B must replace the currently missing complete verification behind the foundation seams before 2A/2C treat evidence as approved. Shared schemas, errors, ordering, exact bytes and fixture expectations remain centrally owned; branch-local alternatives are not allowed.

## Windows and publication boundaries

Only explicit ordinary local drive roots are admitted. Relative paths remain slash-separated and contained. Absolute-root separator normalization preserves the same Windows path and performs no discovery. Reparse, hardlink, wrong-type and identity-change policies are tested using closed supplied identity records. Actual checked-handle acquisition remains Phase 2C; no Node-lstat-only routine is presented as proof against every Windows reparse type.

Publication requires `inspect(root,relative|null)`, a trusted native hook returning the complete ancestor/root/descendant identity chain. An optional synchronous checkpoint supplies operational deadline/abort checks. The primitive exclusively creates one output directory, stages only `memoryos-readiness-result.json.pending`, verifies exact bytes/identities and finalizes `memoryos-readiness-result.json` once. Failure retains owned pending bytes. No completion marker, duplicate graph or multi-file assessment bundle is introduced.

Nonreplacement depends on Freeze section 17's private immutable roots and absence of concurrent adversarial namespace mutation. Node's Windows rename can replace at kernel level; this primitive checks absence and stable identity within that explicit precondition. It does not claim a syscall guarantee against an excluded concurrent attacker. Complete deadline, cancellation and stdout handling remain Phase 2C.

Native engineering tests invoke the reviewed fixed PowerShell artifact with process-scoped `-ExecutionPolicy Bypass`. This changes no persistent execution policy and adds no product launch override. Later production orchestration must use the frozen trusted installation path and sanitized SystemRoot/WINDIR environment. The Phase 1 product helper remains guarded.

## Requirements and fixtures

The machine [requirements catalog](../repositories/cca-conformance/evidence/mo1307/phase1/requirements.json) covers exactly the 21 task-section-57 categories: contracts, schemas, candidate identity, canonicalization, profiles, errors/exits, evidence representations, graph structure, qualifications, history, human decisions, tag records, provider limitations, MO-1306 vector, filesystem, helper protocol, publication primitive, resources, determinism, package integrity and security negatives. Each row names concrete test selectors, schema/fixture references and later-phase boundaries.

The finite [fixture catalog](../repositories/cca-conformance/fixtures/mo1307/catalog.json) has 485 entries: 443 positive and 42 negative. The negatives comprise 12 schema, five foundation, nine parser and 16 future-semantic entries. It binds 581 files excluding the catalog itself. There are 16 complete bundles and 476 schema-testable entries; parser-byte vectors are excluded from ordinary JSON Schema validation. Native/security/resource tests contain additional cases beyond these fixture-entry counts. Execution receipts own exact executed test counts.

A successful foundation test proves its stated schema, structure, reference or primitive property. The PHASE2 fixture classification does not claim those semantic negatives are already rejected by a full verifier. Candidate/authority substitution, omitted qualifications/history and self-hashed false results remain available for full 2B integration. No schema-valid negative is relabeled a successful certification assertion.

## V18 and preserved history

The [MO-1306 qualified fixture](../repositories/cca-conformance/fixtures/mo1307/bundles/mo1306-qualified) binds production C3CB `701d48ee2012675966360dda775ab13013c09ab9`, M3 `85a0f85c1ebd013c545ccf2b3efe58a760e6cf37`, S3 `6e562c578f86022ee28911f7b91a8b3aa209da17`, I3 `f8e19fc5427cf3acfe60d5e2717dc87d0c74e04a` and BF `332ab0d2c35643ea8d155bcbea9c5019b304bbe3`. It preserves the actual annotated release-tag observation, package/SBOM/provenance sources, all 19 raw history rows and 12 failure/unclosed-history projections.

Generic remains real-execution-certified in validation and execution. GitHub remains OFFLINE_VALIDATED/HOSTED_EXECUTION_NOT_CERTIFIED with original NOT_CERTIFIED source label and hosted support limitation. GitLab, Jenkins and Azure remain contract validated and not live-provider certified. The reference expectation is READY_WITH_QUALIFICATIONS with ten disclosures. This neither certifies hosted PASS nor supplies new execution. Unresolved/exhausted hosted and native publication history remains unchanged, and no predecessor campaign is rerun.

## Resource structure and enforcement

All 52 `definitions.limits` keys are listed below without changing their numbers. The machine catalog adds each enforcement explanation and later responsibility. Admission/representation limits are active now. Guarded and future-orchestrator classifications explicitly distinguish complete 2C orchestration from the currently implemented finite interfaces.

Boundary checks exercise shared byte caps, parser/value limits, path/protocol bounds, graph validation and publication bytes. The maximum admitted characterization fixture combines bounded identities; it does not assert that every independent maximum can be attained simultaneously under the aggregate evidence/input/output ceilings.

The finite characterization uses small, MO-1306-shaped and maximum admitted vectors. [characterization.mjs](../repositories/cca-conformance/tools/mo1307-phase1/characterization.mjs) runs foundation operations in one worker using 128/16 MiB old/young heap limits. [measure.ps1](../repositories/cca-conformance/tools/mo1307-phase1/measure.ps1) externally samples native Windows processes. Final characterization receipts own timings, sizes, RSS, process observations and sampling limitations; no measurement numbers are inferred here.

The engineering retained-buffer hold is 2000 ms, outside measured pure duration and within the unchanged 10-second enclosing limit. The observer requires at least two samples and one active Node sample at or after 250 ms, avoiding startup-only RSS claims. Console-host observations come from the external observer, not a hard-coded child count. Failed sandbox observer and insufficient-sampling attempts remain preserved under the finite repeat policy. No normative cap is tuned from measurements; observed RSS is not a hard OS memory sandbox.

| Frozen key | Value | Current enforcement | Check references |
|---|---|---|---|
| `aggregateEvidenceBytes` | 8388608 | ADMISSION_ENFORCED | C23,N11,N14 |
| `apiDeadlineMs` | 10000 | GUARDED_CHECKPOINT_AND_CHARACTERIZATION | C18,C29,characterization.mjs |
| `assumptions` | 32 | REPRESENTATION_AND_ADMISSION | C02,C23,C26,C31,fixture schema corpus |
| `authorityBytes` | 1048576 | ADMISSION_ENFORCED | C09,C23,N11 |
| `authoritySources` | 32 | REPRESENTATION_AND_ADMISSION | C02,C23,C26,C31,fixture schema corpus |
| `blockers` | 128 | REPRESENTATION_AND_ADMISSION | C02,C23,C26,C31,fixture schema corpus |
| `candidateBytes` | 524288 | ADMISSION_ENFORCED | C09,C23,N11 |
| `candidateComponents` | 1024 | REPRESENTATION_AND_ADMISSION | C02,C23,C26,C31,fixture schema corpus |
| `claims` | 64 | REPRESENTATION_AND_ADMISSION | C02,C23,C26,C31,fixture schema corpus |
| `cleanupAllowanceMs` | 2000 | FROZEN_FUTURE_ORCHESTRATOR | N15,N16,N17,N23 |
| `cliDeadlineMs` | 30000 | FROZEN_FUTURE_ORCHESTRATOR | N15,N16,N17,N23 |
| `configurationBytes` | 16384 | ADMISSION_ENFORCED | C09,C23,N11 |
| `decisionActorCodeUnits` | 128 | REPRESENTATION_AND_ADMISSION | C08,C30,C33,fixture schema corpus |
| `decisionBytes` | 8192 | ADMISSION_ENFORCED | C09,C23,N11 |
| `decisionReasonCodeUnits` | 1024 | REPRESENTATION_AND_ADMISSION | C08,C30,C33,fixture schema corpus |
| `dependenciesPerClaim` | 1024 | REPRESENTATION_AND_ADMISSION | C02,C23,C26,C31,fixture schema corpus |
| `engineeringAggregateRssBytes` | 536870912 | EXTERNAL_ENGINEERING_ACCEPTANCE | measure.ps1,characterization.mjs |
| `envelopeBytes` | 262144 | ADMISSION_ENFORCED | C09,C23,N11 |
| `errorRecordBytes` | 1024 | FIXED_RECORD_ENFORCED | C12,N17 |
| `fullPathCodeUnits` | 240 | PATH_ADMISSION_ENFORCED | N06,N07 |
| `gates` | 128 | REPRESENTATION_AND_ADMISSION | C02,C23,C26,C31,fixture schema corpus |
| `grants` | 64 | REPRESENTATION_AND_ADMISSION | C02,C23,C26,C31,fixture schema corpus |
| `graphEdges` | 8192 | ADMISSION_ENFORCED | C26,negative.graph-node-limit |
| `graphNodes` | 2048 | ADMISSION_ENFORCED | C26,negative.graph-node-limit |
| `helperDeadlineMs` | 5000 | FROZEN_FUTURE_ORCHESTRATOR | N15,N16,N17,N23 |
| `helperRequestBytes` | 65536 | PROTOCOL_ENFORCED | N09,N10,N11,N12,N13,N14 |
| `helperRequestPaths` | 128 | PROTOCOL_ENFORCED | N09,N10,N11,N12,N13,N14 |
| `helperRequests` | 4 | PROTOCOL_ENFORCED | N09,N10,N11,N12,N13,N14 |
| `helperResponseBytes` | 16777216 | PROTOCOL_ENFORCED | N09,N10,N11,N12,N13,N14 |
| `historyDispositionChars` | 256 | SCHEMA_ENFORCED | fixture schema corpus |
| `historyRecords` | 128 | REPRESENTATION_AND_ADMISSION | C02,C23,C26,C31,fixture schema corpus |
| `jsonDepth` | 16 | PARSER_ENCODER_ENFORCED | C05,C07,C08,C09,C21 |
| `jsonSummaryBytes` | 1024 | PROJECTION_ENFORCED | canonical result identities and summaries match exact independently constructed fixture bytes |
| `jsonValues` | 131072 | PARSER_ENCODER_ENFORCED | C05,C07,C08,C09,C21 |
| `keyCodeUnits` | 64 | PARSER_ENCODER_ENFORCED | C05,C07,C08,C09,C21 |
| `manifestBytes` | 262144 | ADMISSION_ENFORCED | C09,C23,N11 |
| `manifestFiles` | 128 | ADMISSION_ENFORCED | C23,N11,N14 |
| `metadataCodeUnits` | 256 | REPRESENTATION_AND_ADMISSION | C08,C30,C33,fixture schema corpus |
| `objectMembers` | 64 | PARSER_ENCODER_ENFORCED | C05,C07,C08,C09,C21 |
| `qualifications` | 128 | REPRESENTATION_AND_ADMISSION | C02,C23,C26,C31,fixture schema corpus |
| `rawSourceBytes` | 2097152 | ADMISSION_ENFORCED | C09,C23,N11 |
| `relativePathChars` | 180 | PATH_ADMISSION_ENFORCED | N06,N07 |
| `resultBytes` | 4194304 | PUBLICATION_PRIMITIVE_ENFORCED | C21,N21 |
| `sourceKindChars` | 128 | SCHEMA_ENFORCED | fixture schema corpus |
| `sourceVersionChars` | 64 | SCHEMA_ENFORCED | fixture schema corpus |
| `stderrBytes` | 4096 | GUARDED_SURFACE | C12,N15,N17 |
| `stringCodeUnits` | 4096 | PARSER_ENCODER_ENFORCED | C05,C07,C08,C09,C21 |
| `tagNameChars` | 128 | SCHEMA_ENFORCED | fixture schema corpus |
| `temporaryOutputBytes` | 4194304 | PUBLICATION_PRIMITIVE_ENFORCED | C21,N21 |
| `textStdoutBytes` | 131072 | PROJECTION_ENFORCED | canonical result identities and summaries match exact independently constructed fixture bytes |
| `workerOldHeapMiB` | 128 | CHARACTERIZATION_WORKER_LIMITS | characterization.mjs |
| `workerYoungHeapMiB` | 16 | CHARACTERIZATION_WORKER_LIMITS | characterization.mjs |

## Package validation and remaining phases

The [contract manifest](../repositories/memoryos-readiness/contracts/contract.json) binds 53 schema/constants files. The [distribution manifest](../repositories/memoryos-readiness/distribution-manifest.json) covers 74 members excluding itself. [SPDX 2.3](../repositories/memoryos-readiness/sbom.spdx.json) records 73 files, explicitly excluding itself and distribution metadata to avoid circular hashes. The distribution independently binds the complete SBOM. Licensing remains pending; no product license grant is introduced.

The engineering [package tool](../repositories/cca-conformance/tools/mo1307-phase1/package.mjs) checks exact allowlist, generated module byte agreement before refreshing manifests, lengths/hashes, local schema references, exports/dependencies/hooks and static import closure. Eight package test groups cover deterministic regeneration and negative mutations. Pinned offline JSON Schema tooling uses jsonschema 4.26.0 and the retained SPDX 2.3 schema. These are foundation checks, not archive/offline-install reproducibility or Phase 3B certification.

[Development evidence](../repositories/cca-conformance/evidence/mo1307/phase1/development) retains original findings and corrections: error precedence/reference handling, graph fixture-name correction, lower-minimum GitHub representation, ambient-encoding schema-read failure and the corrected SPDX comment property. Original failures are not erased or converted into released passes.

Phase 2A owns full gate/aggregation/result computation; 2B owns complete reviewed authority/dependency/reuse/history verification and DAG derivation; 2C owns checked native acquisition, wrappers, worker isolation, deadlines/cancellation and output transport. All use the same closed representations and fixture bytes. No Phase 2 branch/worktree is created by this work. Only after separately verified B1 may those streams begin from that exact existing commit. This report embeds no future/self commit, pushes nothing and authorizes no tag.

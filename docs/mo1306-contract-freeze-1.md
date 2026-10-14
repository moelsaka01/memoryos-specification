# MemoryOS 1.3 MO-1306 — Provider-Neutral CI/CD Integration Contract Freeze 1

Status: **CONTRACT FREEZE 1 WITH CORRECTION A / PHASE 1 RESUME AUTHORIZED**.

Correction A preserves the original freeze at 3537b037e4ea70a726a249d7397f1df15daa2167.
Only Windows attributable process accounting is corrected. See the
[process correction record](mo1306-contract-freeze-1-process-correction.md) for
the original two-process assumption, fresh diagnostics and resume gates.

## 1. Authority, scope and baseline

This is the implementation contract under the owner-authorized
[MO-1306 roadmap authority](mo1306-provider-neutral-cicd.md), commit
`33c0612e9ed03d714568354d2d7b2545344f95c1`. The verified starting workspace is
`C:\Users\melsa\Documents\Codex\cca-workspace`, clean `main`, at that commit,
subject `docs(memoryos-1.3): authorize MO-1306 provider-neutral CI/CD`, parent
`5955af062152a84c10de17860ba0bcabe8b3555f`. Annotated tag
`memoryos-1.3-mo1305` still peels to that parent. This freeze changes no
production implementation, dependency, provider file, receipt or released tag.
It establishes no execution or certification PASS.

MUST and MUST NOT are binding. Tables of fields are closed schemas: every
listed field is required unless marked optional, and no unlisted member is
accepted at any depth. Union alternatives are exclusive. Implementation must
materialize the specified schemas and cross-field checks before adapters use
them. Internal function organization is free only within these boundaries.

The [ROADMAP](../ROADMAP.md) supplies current status. Earlier MO-1306 authority
status/next-task text records its authorization stage; its hard constraints
remain binding, while this document closes its A–AF decisions. The reviewed
source chain is the authority's sections 5, 13 and 16 and their linked
MO-1301–MO-1305 specifications, corrections, guides, inventories and release
records. Existing [architecture](../ARCHITECTURE.md) boundaries remain intact.

No phase requires Linux, Ubuntu, WSL, VirtualBox, VMware, Hyper-V VM, or any
user-created/administered VM. No GitLab account/subscription/runner, Jenkins
server/installation/account/plugins, Azure account/subscription/DevOps
organization/hosted pipeline, or paid external CI resources are prerequisites.
Their absence cannot block MO-1306 or require the owner to provision them.
Generic real execution uses native Windows 11 x64. The separately allowed
GitHub-hosted witness uses `windows-2022` x64; GitHub's managed infrastructure
does not create a local VM requirement. There is no Linux fallback.

MO-1307 release-governance semantics, MO-1308 durable Investigation History,
MO-1309 cloud/dashboard/SaaS, arbitrary workflows/deployment, shell services,
URL fetching, account administration, secret management, and VS Code/MCP/REST
expansion are excluded. This product evaluates existing Policies and gates a
job; it does not decide higher-level release readiness.

## 2. Architecture and semantic authority

```text
MO-1301 SDK / Core / Policy / Regression authority (unchanged)
                          |
             provider-neutral CI/CD core
       acquisition -> bounded SDK child -> verified result
                          |
              normalized invocation / projection
          +---------+---------+---------+---------+
        generic   GitHub    GitLab    Jenkins    Azure
```

The shared core owns configuration, trusted acquisition, boundaries, worker
lifetime, operational errors, evidence, publication and exit mapping. Adapters
only normalize allowed provider metadata, generate provider configuration and
present the common result. No adapter may evaluate rules, aggregate Policy
results, derive Regression facts, construct authoritative contexts, reinterpret
COULD_NOT_EVALUATE, or substitute a provider job result for semantic evidence.

| Existing surface | Decision and reason |
|---|---|
| Public JavaScript SDK 1.1.0 | **Sole production semantic invocation.** Direct local delegation to the released facade and its existing 25-file authoritative closure; no service, provider SDK or CLI serialization layer. |
| CLI 1.1.0 | Independent engineering parity oracle only. Preserve its acquisition recipe and numeric exits; no production fallback or subprocess invocation of the CLI. |
| REST | Test/reference authority only; no server, bearer token, HTTP client or fallback. Its six operations do not implicitly define this product's scope. |
| MCP | Test/reference authority only; no MCP server/client/framing or fallback. |
| Python/C++ SDK bindings, Studio and other surfaces | No production invocation or fallback. Existing cross-language semantic evidence may be reused with exact unchanged-source binding. |

One public operation family is supported: `evaluatePolicy` or
`evaluatePolicySet`. Validation, preparation, verification and identity reads
are internal prerequisites, not new CI operations. Preserve the
[MO-1301 contract](investigation-policies.md), all 31 semantic limits,
canonical bytes, document/semantic/Evaluation Identity/outcome digests,
registered rules and resource identities. The contract-identities pin is the
exact 933-byte
[released identity file](../repositories/memoryos-rest/contracts/policy-contract-identities-1.0.0.json),
SHA-256 `d81c0b8aece4a106324131d4d356c7d0aac0e8618fac080c6b8b5e3a2381ee65`.
The SDK's live `policyContractIdentities()` must match it before evaluation.

Copy the exact source files enumerated by the released
[25-file closure](../repositories/memoryos-rest/runtime/runtime-closure-manifest.json)
into the new package's own `runtime/authoritative/` directory. Verify each
source and destination length/digest; no semantic file changes. Generate a
new `MemoryOSCICDRuntimeClosureManifest`, version `1.0.0`, from those rows;
the REST manifest's own kind/hash is not the new manifest's identity.

## 3. Versions, serialization and contract identities

| Surface | Frozen value |
|---|---|
| Package | `memoryos-ci` / `0.1.0`, private offline distribution |
| Common contract | `memoryos.cicd` / `1.0.0` |
| Configuration | `MemoryOSCICDConfiguration` / `1.0.0` |
| Deployment/generation input | `MemoryOSCICDDeployment` / `1.0.0` |
| Normalized invocation | `MemoryOSCICDInvocation` / `1.0.0` |
| Result / evidence / artifact manifest | `MemoryOSCICDResult`, `MemoryOSCICDEvidence`, `MemoryOSCICDArtifacts` / `1.0.0` each |
| Completion marker / stdout | `MemoryOSCICDComplete`, `MemoryOSCICDSummary` / `1.0.0` each |
| Limits | `MemoryOSCICDResourceLimits` / `1.0.0` |
| Generator | `memoryos.cicd.generator` / `1.0.0` |
| Adapters | `memoryos.cicd.adapter.<provider>` / `1.0.0`, provider in `generic`, `github`, `gitlab`, `jenkins`, `azure` |

CI schemas use JSON Schema Draft 2020-12 plus the cross-field rules here.
`Digest` means `sha256:` followed by exactly 64 lowercase hexadecimal digits.
`Revision` is 40 lowercase hexadecimal digits. `RunId` is a lowercase UUID v4
generated by the core for each invocation, never selected by provider input.
All counts are nonnegative safe integers; sizes mean bytes unless stated.

Operational JSON serialization `J` recursively sorts object keys by ASCII
key order, preserves array order, uses JSON string escaping, no insignificant
spaces, UTF-8 without BOM and exactly one trailing LF. Reject duplicate keys,
invalid UTF-8, unpaired surrogates, non-finite/fractional numbers, forbidden
controls, unsupported versions and unknown fields before normalization.
Optional defaults are inserted before `J` and configuration hashing. No
Unicode normalization, locale sorting, timestamp, host path or randomness is
inserted in generation. Hash exact `J` bytes including LF. This is an
**operational** serialization; never apply it to SDK-produced normative bytes.

`contracts/contract.json` is `{kind:"MemoryOSCICDContract",version:"1.0.0",
id:"memoryos.cicd",files:[{path,byteLength,sha256}]}`. Rows are path-sorted,
contain every first-party schema, errors, fixed projection table, generator
grammar/template and limits file, and exclude the manifest itself. Its hash
is `contractDigest`; the limits-file hash is `limitsDigest`. Package manifest
hash, adapter module/template closure hashes and runtime-closure hash are
separate identities. No file contains its own hash or a future commit hash.

Patch releases may fix internals without changing accepted bytes/behavior;
their distribution identities still change and affected evidence is refreshed.
An accepted-field, error/exit, generation, limits, trust or projection change
requires explicit contract correction/version review and matching schemas.
Unknown versions fail closed; no silent downgrade, migration or fallback.
Semantic versions and identities remain those of MO-1301.

## 4. Configuration and launch contract

The conventional filename is `memoryos-ci.json`. The entry point is
`bin/memoryos-ci.mjs`; the npm bin name is `memoryos-ci`. Native execution uses
an operator-selected, absolute, verified Node executable and an absolute entry
point, never PATH/npm/npx lookup. Public commands are exactly:

```text
node.exe --max-old-space-size=128 <package>/bin/memoryos-ci.mjs run --workspace <absolute-directory> --config <absolute-file> [--provider generic|github|gitlab|jenkins|azure]
node.exe --max-old-space-size=128 <package>/bin/memoryos-ci.mjs generate --config <absolute-file> --deployment <absolute-file> --output <absolute-new-directory>
node.exe --max-old-space-size=128 <package>/bin/memoryos-ci.mjs verify --bundle <absolute-run-directory>
```

These are argv descriptions, not shell command strings. Each flag occurs once;
no positional extras, abbreviations, response files, `--eval`, module selectors
or arbitrary Node flags. `run` defaults to `generic`; provider adapters pass
their literal provider. `verify` validates a complete local evidence bundle
without evaluating or publishing. `generate` and `verify` return 0 on success
and the applicable operational exit otherwise; they emit the same bounded
diagnostic records, and no evaluation summary. Provider-generated jobs invoke
only `run` and the fixed publication verifier.

The shown fixed Node heap flag is required by the trusted launcher. The npm bin
mapping identifies the entry point; a default npm-generated Windows shim that
omits this flag is not the certified invocation. No npm/POSIX shim is needed.

Configuration schema, with `?` marking the only optional members:

```text
{
  kind: "MemoryOSCICDConfiguration", version: "1.0.0",
  operation: "evaluatePolicy" | "evaluatePolicySet",
  policy?:    {path: RelativeFile, expectedSemanticDigest: Digest},
  policySet?: {path: RelativeFile, expectedSemanticDigest: Digest},
  context: {candidateMip: RelativeFile, baselineMip?: RelativeFile},
  output: {directory: ".memoryos-ci/out"},
  timeoutMs?: Integer[1000,60000],
  providerExtensions?: {}
}
```

Exactly `policy` for `evaluatePolicy`, exactly `policySet` for
`evaluatePolicySet`; both/neither/mismatched operation is invalid. Default
`timeoutMs=60000`, `providerExtensions={}`. Output is a required literal so
all provider publication steps share a fixed allowlist. Evidence and artifacts
share that output root; there is no second independently selectable evidence
path. No environment override exists for any configuration value. Precedence
is explicit launch arguments for launch capabilities, then the one config
file, then the two stated defaults; they do not override one another's fields.

The config is trusted operator/workflow input. In gated provider use its
normalized digest is pinned in the generated provider file; the configuration
must come from a protected installation or reviewed immutable tool checkout,
not a fork/data checkout. Untrusted configuration fails closed and cannot choose
code, runtime, external paths, credentials, semantic registries or rule engines.
Generic local callers explicitly supply their trusted configuration. There is
no auto-discovery by walking directories and no merge of multiple configs.

## 5. Acquisition, Policy, context and Regression

| Source | Allowed use |
|---|---|
| Trusted config file | Closed configuration and explicit workspace-relative Policy/Set and MIP references only |
| Workspace-relative regular file | Exact Policy/Set bytes, candidate MIP and optional baseline MIP |
| stdin | **Excluded** from public input; stdin is ignored/closed. Worker stdin is a private protocol only. |
| Environment | Only launch bootstrap capabilities and enumerated provider metadata; no semantic bytes, config override, interpolation or secret references |
| Provider metadata | Operational association only; cannot supply facts, Policy, context or Regression authority |
| Generated provider files | Invoke the fixed runner with the pinned common configuration; cannot provide semantic implementations |
| Previous/provider-uploaded artifacts | No artifact download/acquisition service in v1; an operator may deliberately place a regular MIP file in the current workspace before invocation, which receives ordinary validation |
| URLs, glob patterns, directory discovery, inline context, detached context JSON | Excluded |

Read each bounded input once into memory after filesystem checks, hash that
snapshot and pass those same bytes to the worker. The raw input digest and
length are operational evidence, not new semantic identities. The Policy/Set
pin is compared to the prepared SDK `semanticDigest`; mismatches fail before
evaluation. Malformed semantic artifacts retain the SDK's stable error code
under `SEMANTIC_VALIDATION`; an adapter never repairs them.

Regression **is included**, using exactly the released
[CLI acquisition recipe](../repositories/memoryos-cli/src/policy-commands.js):
create a fresh `MemoryOS` facade; `preparePolicy` or `preparePolicySet`; import
the candidate MIP with identifier `memoryos-policy-evaluation-candidate`.
Without baseline, call `capturePolicyFactContext(candidate)` and evaluate with
`{}`. With baseline, import it with identifier
`memoryos-policy-evaluation-baseline`; call
`captureRegressionPolicyFacts(baseline,candidate)` and use its
`policyFactContext` and `{regressionSource: bundle.regressionPolicyFactSource}`
in `evaluatePolicy` or `evaluatePolicySet`. All capabilities stay within that
same facade/worker. Baseline and candidate may contain identical bytes but
are separate owner-bound imports. No detached Regression report is accepted.

Obtain `evaluationIdentityBytes()` and `canonicalOutcomeBytes()` unchanged;
verify using `verifyEvaluationIdentityArtifact` and
`verifyPolicyEvaluationOutcomeArtifact` against their exact expected digests,
and context-bound `verifyEvaluationIdentityForEvaluation` and
`verifyPolicyEvaluationOutcomeForEvaluation` using the same prepared artifact,
context and Regression options. Reject any identity/decision inconsistency.
Missing Regression facts remain subject to existing Policy semantics; the
adapter must not invent a baseline or convert a valid COULD_NOT_EVALUATE to an
operational error. Provider metadata contributes **zero semantic fields**.

## 6. Normalized invocation and adapter interface

The shared input object is precisely:

```text
{
  kind:"MemoryOSCICDInvocation", version:"1.0.0", runId:RunId,
  provider:Provider, configuration:NormalizedConfiguration,
  configurationDigest:Digest,
  inputs:{policy:Bytes|null, policySet:Bytes|null, candidateMip:Bytes, baselineMip:Bytes|null},
  metadata:OperationalMetadata,
  identities:{contractDigest:Digest, limitsDigest:Digest, distributionDigest:Digest,
              adapterDigest:Digest, runtimeClosureDigest:Digest, nodeDigest:Digest}
}
```

`Bytes` is an immutable bounded byte sequence in memory, not a filepath or JS
object reconstructed by the adapter: the internal representation is Uint8Array;
the invocation schema's JSON inspection representation uses canonical base64
strings for those members, with decoded-size bounds. That representation is
engineering inspection only, never a public acquisition endpoint. Exactly one
Policy byte member is nonnull
and matches config. The core alone adds runId, verifies identities/acquires
bytes and constructs this object. An adapter cannot submit a fabricated
normalized invocation through the public CLI.

The package-internal provider interface is fixed as
`normalizeMetadata(environment) -> OperationalMetadata`,
`project(classification) -> Projection`, and
`generate(configuration,deployment) -> [{path,bytes}]`. Functions are pure,
take closed data, do not read ambient state or perform I/O, and return in
path order; the common core owns all actual I/O. Each provider module exports
`id`, `version` and those three functions. `environment` is a plain record of
only that provider's listed raw environment fields (string or null), populated
by the core; it is not `process.env`. `classification` is the section 8 enum.
Adapter generation returns only its primary provider file; generic returns an
empty array. The shared generator adds canonical config and generation manifest
for every target. Common validation/projection is
shared; per-provider wrappers may add no semantic branches.

Private worker protocol is one UTF-8 `J` JSON request on stdin, then EOF:
`{kind:"MemoryOSCICDWorkerRequest",version:"1.0.0",runId,operation,
expectedSemanticDigest,policyBase64,policySetBase64,candidateMipBase64,
baselineMipBase64}`; nonselected/absent members are null. Strict standard
base64 is required (canonical padding, no whitespace). One response and EOF
on stdout is `{kind:"MemoryOSCICDWorkerResponse",version:"1.0.0",runId,
semantic,error}`. Success `semantic` is the result semantic object plus
`evaluationIdentityBase64` and `outcomeBase64`, and `error=null`; on failure
`semantic=null` and error is the closed result error object. Only bytes and
the policy pin cross this boundary; no metadata, config paths or credentials.
Unexpected output, extra frames, truncation, oversized bytes, wrong generation,
nonzero child exit or malformed response is an operational failure.

## 7. Provider metadata classification

No listed field is SEMANTIC. Classification applies to normalized public
metadata, not the core's private launch capability for its workspace.

| Candidate field | Class | Retention and reason |
|---|---|---|
| provider | OPERATIONAL | Closed provider enum; receipt scope and projection only |
| repository | OPERATIONAL | Bounded identifier for association, never fetched |
| revision | OPERATIONAL | Optional 40-hex association; does not prove checkout/input identity |
| ref | DIAGNOSTIC | Discard from retained result/evidence; never interpolated |
| pipeline/run ID | OPERATIONAL | Association only, distinct from core RunId |
| job ID | OPERATIONAL | Association only |
| attempt | OPERATIONAL | Positive bounded integer; no automatic retry semantics |
| event type | OPERATIONAL | Bounded provider event name, no semantic routing |
| actor | DIAGNOSTIC | Discard; neither authorization nor normative evidence |
| pull/merge request identity | OPERATIONAL | Optional decimal association, not authority |
| workspace path | FORBIDDEN | Never serialized as provider metadata; private filesystem capability only |
| runner identity | DIAGNOSTIC | Excluded from product evidence; certification may independently record actual OS/runtime |
| timestamp | DIAGNOSTIC | Excluded from product identities/evidence; engineering receipt timestamps are nonsemantic |
| provider URL | FORBIDDEN | No supplied URLs, network selectors, query tokens or clickable annotations |

`OperationalMetadata` has exactly `provider`, `repository`, `revision`,
`runId`, `jobId`, `attempt`, `event`, `changeRequest`. All except provider are
nullable. Nonnull identifiers use ASCII `[A-Za-z0-9_./:@-]`, length 1–256;
runId/jobId length <=128, event <=64; revision is Revision; attempt is 1–1000;
changeRequest is 1–20 decimal digits. Empty/unset environment values become
null; a present invalid/oversized value is `METADATA_INVALID`, never silently
truncated. Paths/URLs are not accepted merely because a string matches an
identifier alphabet: reject `://`, leading `/`, any backslash, a drive-letter
colon prefix, or a `.`/`..` slash-delimited segment. No links are rendered from
repository values. Metadata revision input alone may contain uppercase hex;
validate exactly 40 hexadecimal digits and normalize to lowercase.

Read only these predefined environment variables, in listed field order:

| Provider | repository; revision; runId; jobId; attempt; event; changeRequest |
|---|---|
| generic | All null; no environment-derived metadata |
| github | `GITHUB_REPOSITORY`; `GITHUB_SHA`; `GITHUB_RUN_ID`; `GITHUB_JOB`; `GITHUB_RUN_ATTEMPT`; `GITHUB_EVENT_NAME`; null |
| gitlab | `CI_PROJECT_PATH`; `CI_COMMIT_SHA`; `CI_PIPELINE_ID`; `CI_JOB_ID`; null; `CI_PIPELINE_SOURCE`; `CI_MERGE_REQUEST_IID` |
| jenkins | `JOB_NAME`; `GIT_COMMIT`; `BUILD_NUMBER`; `BUILD_TAG`; null; null; `CHANGE_ID` |
| azure | `BUILD_REPOSITORY_NAME`; `BUILD_SOURCEVERSION`; `BUILD_BUILDID`; `SYSTEM_JOBID`; `SYSTEM_JOBATTEMPT`; `BUILD_REASON`; `SYSTEM_PULLREQUEST_PULLREQUESTID` |

Do not parse event files, dump all environment variables, or infer missing
values. Case normalization is limited to a validated revision's hexadecimal
digits. Provider-provided metadata is always untrusted data; hostile content
may cause a bounded adapter error but cannot select an executable or Policy.

## 8. Results, exits and job projection

`memoryos-ci-result.json` is an operational record, not a new Policy artifact:

```text
{
 kind:"MemoryOSCICDResult",version:"1.0.0",runId:RunId,provider:Provider,
 classification:Classification,
 semantic:null | {artifactKind:"policy"|"policySet",documentDigest:Digest,
   semanticDigest:Digest,decision:"PASS"|"FAIL"|"COULD_NOT_EVALUATE",
   evaluationIdentityDigest:Digest,outcomeDigest:Digest},
 error:null | {code:ErrorCode,stage:Stage,semanticCode:String|null},
 process:{exitCode:Integer,termination:"NORMAL"|"TIMEOUT"|"CANCELLED"|"ABNORMAL"},
 projection:{class:ProjectionClass,jobStatus:"SUCCESS"|"FAILURE"|"CANCELLED"},
 configurationDigest:Digest|null,inputDigest:Digest|null,
 contractDigest:Digest,limitsDigest:Digest,adapterDigest:Digest
}
```

Stages are `LAUNCH`, `CONFIGURATION`, `ACQUISITION`, `METADATA`, `GENERATION`,
`INTEGRITY`, `SEMANTIC`, `PUBLICATION`, `VERIFICATION`, `CLEANUP`, `INTERNAL`.
`semanticCode` is null except an allowlisted existing SDK stable error code,
maximum 128 ASCII characters; no SDK message/details/stack enters this field.
`artifactKind` maps the prepared Policy/Set to the literal `policy`/`policySet`;
this operational shorthand does not replace the SDK's artifact kind/version.
`inputDigest` hashes `J` of the role-ordered input descriptors in section 9.
Null configuration/input digests mean the relevant validation never completed.
If contract/runtime identity cannot be trusted, publish no bundle at all.

| Classification | Exit | Projection class | Job status | Semantic field |
|---|---:|---|---|---|
| PASS | 0 | SUCCESS | SUCCESS | Verified PASS |
| FAIL | 6 | POLICY_FAIL | FAILURE | Verified FAIL |
| COULD_NOT_EVALUATE | 7 | NOT_EVALUATED | FAILURE | Verified COULD_NOT_EVALUATE |
| CONFIGURATION_ERROR | 10 | ADAPTER_ERROR | FAILURE | null |
| INPUT_ERROR | 11 | ADAPTER_ERROR | FAILURE | null |
| SEMANTIC_ERROR | 12 | ADAPTER_ERROR | FAILURE | null |
| TIMEOUT | 13 | TIMEOUT | FAILURE | null |
| CANCELLED | 14 | CANCELLED | CANCELLED | null |
| INTEGRITY_ERROR | 15 | ADAPTER_ERROR | FAILURE | null |
| INTERNAL_ERROR | 16 | ADAPTER_ERROR | FAILURE | null |
| ARTIFACT_ERROR | 17 | ADAPTER_ERROR | FAILURE | null |

All providers use the same numeric process exits. Deliberate reuse of 0/6/7
matches completed CLI evaluations; operational exits 10–17 belong only to this
new executable. Do not change CLI or MO-1302 exits. For completed semantics,
error is null, termination NORMAL, and projection follows the table. Other
rows have error nonnull; TIMEOUT/CANCELLED use matching termination, unexpected
child/internal crashes ABNORMAL, other handled errors NORMAL. The table is a
total function, not provider-configurable. No `continue-on-error`, allow-failure,
Jenkins UNSTABLE or Azure SucceededWithIssues conversion is permitted.

A provider UI may show FAILURE when a process exits 14 rather than a platform
cancellation. Preserve common class CANCELLED and record the actual provider
conclusion separately in certification evidence. Force-killed jobs may have
no result: the provider's cancellation/timeout is not fabricated as semantic
COULD_NOT_EVALUATE or a complete adapter bundle. Publication failure overrides
the runner classification to ARTIFACT_ERROR, retaining any verified semantic
bytes only as uncommitted attempt data; it cannot publish a misleading PASS.

## 9. Evidence, artifact integrity and publication

Each run exclusively creates `.memoryos-ci/out/<RunId>/`. Complete evaluation
bundles contain exactly these six regular files:

1. `memoryos-ci-result.json` — `J`, <=8192 bytes.
2. `memoryos-ci-evidence.json` — `J`, <=16384 bytes.
3. `evaluation-identity.json` — exact SDK bytes, <=4060 bytes.
4. `policy-outcome.json` — exact SDK bytes, <=4060 bytes.
5. `memoryos-ci-artifacts.json` — `J`, <=8192 bytes.
6. `memoryos-ci-complete.json` — `J`, <=1024 bytes, created last.

Handled operational failures, if safe publication initialized, have exactly
four files (omit both semantic files); no placeholder normative artifacts.
Total published bytes <=49152. Diagnostic logs and raw inputs/configuration
are not bundled. Normative evidence is only the two SDK artifacts and their
existing semantic identities. All CI JSON is operational evidence.

Evidence schema:

```text
{
 kind:"MemoryOSCICDEvidence",version:"1.0.0",runId:RunId,
 contract:{id:"memoryos.cicd",version:"1.0.0",sha256:Digest,limitsSha256:Digest},
 configurationSha256:Digest|null,
 adapter:{id:AdapterId,version:"1.0.0",sha256:Digest},
 distributionSha256:Digest,runtimeClosureSha256:Digest,
 semanticContractSha256:Digest,
 inputs:[{role:"policy"|"policySet"|"candidateMip"|"baselineMip",byteLength:Integer,sha256:Digest}],
 runtime:{nodeVersion:"24.21.0",nodeSha256:Digest,platform:"win32",architecture:"x64",osRelease:String},
 metadata:OperationalMetadata,
 resultSha256:Digest,projectionSha256:Digest
}
```

Inputs are in selected Policy/Set, candidate, optional baseline order. On
acquisition failure include only the completely checked prefix, and
`inputDigest=null`. `osRelease` is at most 64 printable ASCII characters,
never hostname/user/path. Hash the exact result file, and `J(result.projection)`
separately. No provider live-validation label is self-asserted by a run.

Artifact manifest is `{kind:"MemoryOSCICDArtifacts",version:"1.0.0",runId,
files:[{path,byteLength,sha256}]}` with basename-sorted rows for result,
evidence and, if present, the two normative files. It excludes itself and
completion marker. Marker is `{kind:"MemoryOSCICDComplete",version:"1.0.0",
runId,manifestSha256:Digest}`. Verify exact cardinality, paths, sizes, schemas,
all digests and cross-links, runId consistency, result/projection/exit agreement,
normative identities and SDK artifact verification. Hashes establish integrity,
not trusted origin; consumers also bind the package/configuration/workflow and
actual process/provider receipt. No self-hash or circular evidence graph.

Stage files with exclusive creation under this run's `.pending/`; close and
verify them, move to final basenames without replacement, remove the empty
staging directory, then exclusively create the final marker. A marker is the
only publication
commit point. Partial writes or missing marker are incomplete attempts, never
usable results. Never overwrite an old marker/run. Provider upload occurs only
after this local verification and only for the exact complete run directory.
Provider upload failure fails the job as transport/publication infrastructure
failure without changing the already completed local semantic result.

Generic local publication is required and sufficient. GitHub upload is
required for hosted certification, after local completion and before final
gate exit, including valid FAIL/CNE and safely completed operational failures.
GitLab/Jenkins/Azure v1 generated files perform **local publication only**;
provider upload steps are excluded. Their users can collect files externally,
but that transport is outside the certified adapter contract. No cross-run
cache, artifact registry, download lookup, overwrite, durable history or
retention promise exists. Provider retention cannot become semantic authority.

## 10. Stdout, stderr and diagnostics

For `run`, stdout is exactly one `J` summary after termination/publication:
`{kind:"MemoryOSCICDSummary",version:"1.0.0",runId,classification,exitCode,
resultSha256:Digest|null,publication:"COMPLETE"|"NONE"}`, <=1024 bytes.
Before RunId allocation, usage errors emit no stdout. No banners, progress,
raw semantic bytes or provider commands go to stdout. A completed bundle's
result is authoritative for operational details; stdout is only a reference.

stderr is UTF-8 JSON Lines, each <=1024 bytes, total <=16384 bytes/32 records:
`{kind:"MemoryOSCICDDiagnostic",version:"1.0.0",code:ErrorCode,
stage:Stage,message:String}`. Messages come from a fixed catalog, contain no
interpolated input, environment values, paths, URLs, stack, Policy/MIP bytes
or provider data. Last reserved record reports `DIAGNOSTICS_TRUNCATED` when
needed. Discard excess rather than retaining an unbounded buffer.
Escape all controls in JSON; reject unpaired Unicode. No raw ANSI/terminal
escape, CR injection, GitHub `::`, Azure `##vso`, or GitLab section command is
emitted. Provider annotations are excluded in v1. A fixed summary may show
only classification, exit and artifact digest using literal text. Redaction
is primarily noncollection/allowlisting, not an unreliable secret regex.

## 11. Filesystem and Windows boundary

The absolute `--workspace` is one existing, local NTFS directory selected by
the trusted caller; it is canonicalized once and is the input root and parent
of the fixed output root. The config file is a separate explicit trusted read
capability; only that file, not its directory contents, may be acquired outside
the workspace. The package and Node paths are trusted, integrity-checked
installation capabilities, never selected by input/config/provider metadata.
The worker's current directory is the trusted package root; parent acquisition
does not depend on the caller's current directory.

`RelativeFile` uses forward slash separated nonempty segments, <=240 ASCII
characters total. Each segment is 1–100 characters from letters, digits,
space, `_`, `-`, `.`; no leading/trailing space, trailing dot, `.`/`..` segment,
reserved DOS device basename (including extension), case-folded collision,
empty/repeated separator, wildcard or output-root reference. Inputs must be
distinct paths; Policy/Set cannot alias either MIP. Identical baseline/candidate
content is allowed in distinct files. Absolute paths in config are forbidden.

Launch absolute paths must be drive-qualified local paths with ordinary
segments; every resolved full path is <=240 UTF-16 code units. Root directories
may contain spaces and Unicode, but not controls,
quotes or shell/expression delimiters. Reject drive-relative `C:foo`, rooted
`\foo`, UNC, extended/device namespaces (`\\?\`, `\\.\`), volume-device
paths, ADS (`:` except the drive colon), `..`, trailing-dot/space and reserved
device names. Resolve containment on full canonical paths with Windows case
rules, never string-prefix-only checks. Config/installation roots cannot lie
inside the untrusted workspace's writable output tree.

Reject symlinks, junctions and **all** reparse points on every existing component
of workspace, config, package, runtime, input, temporary and output paths.
Require regular input files, link count one, bounded size, and stable identity,
length and write metadata before/after read; detect swaps and fail. Check
output ancestors again before each publication operation. Node `lstat` alone
is insufficient to claim detection of every Windows reparse type. The package
therefore contains a fixed `scripts/check-paths.ps1` helper which only reads
Windows `FileAttributes.ReparsePoint` and component/type information using
literal .NET paths. The core invokes the absolute Windows PowerShell executable
with direct argv, `-NoProfile -NonInteractive -EncodedCommand <fixed-code>`,
where fixed-code is the verified helper's UTF-8 text encoded as UTF-16LE then
base64, with no input substitution. This runs fixed trusted code without changing
machine execution policy; it is not an arbitrary script API. Private stdin is
one request `{kind:"MemoryOSCICDPathCheckRequest",version:"1.0.0",
paths:[{path:AbsolutePath,allowMissingLeaf:boolean}]}`, 1–64 entries; the helper
checks every ancestor and permits a missing final leaf only when the caller
explicitly marked a future output leaf. Inputs use false. The caller
still enforces input existence/type with Node. Never embed path text in
PowerShell code. Closed helper response: `{kind:"MemoryOSCICDPathCheck",
version:"1.0.0",safe:boolean}`; helper failure/unknown attributes fail closed.
Its <=16384-byte request, <=1024-byte response and <=2000 ms execution fit
the overall deadline. No user-provided scripts or bypass policy flags.

Race checks supplement an explicit deployment precondition: the caller controls
the host and grants the runner exclusive write access to its workspace/output
for the invocation. An attacker with concurrent host write/debug privileges is
outside the boundary. This is not a kernel sandbox or an atomic no-follow
guarantee against privileged concurrent namespace replacement. Snapshot bytes
and fail-closed rechecks are mandatory even with that precondition.

Create run directories exclusively, with no reuse. Temporary files are only
under `.memoryos-ci/out/<RunId>/.pending/`; use fixed basenames and exclusive
opens. Never use shared OS temp, repository `.git`, user home or unrelated
paths. Remove only this invocation's known temporary files/directories after
rechecking containment and attributes. Keep incomplete attempt files when
failure diagnosis requires them; no completion marker means not published.
Do not recursively delete arbitrary directory trees or clean previous runs.
On forced host interruption, later invocations ignore stale incomplete runs;
the operator may explicitly clean them outside evaluation. Input files and
tracked source files are never modified by `run`.

## 12. Network, secrets and untrusted execution

Core, worker, generator, verifier and offline provider checks require **zero
outbound network**. No DNS, HTTP/TLS, sockets/listeners, UDP, proxy discovery,
remote module, provider API or secret service is part of semantic execution.
Before loading SDK code, install audited denial hooks for networking built-ins,
`fetch`, WebSocket and DNS, synchronize built-in ESM exports and test both
callback/promise and constructor/prototype routes. Audit the immutable import
closure for escapes. Do not misstate Node 24 permission flags as a network
firewall: its documented permission model does not provide malicious-code
isolation. Only trusted shipped code is executable; input remains data.
The [Node permission documentation](https://nodejs.org/docs/latest-v24.x/api/permissions.html)
describes those limits. No OS firewall/admin/VM prerequisite is introduced.

Only the GitHub **workflow bootstrap/transport**, outside the MemoryOS
processes, may contact GitHub for exact pinned tool/data checkouts, the Actions
artifact service for this run, and `https://nodejs.org/dist/v24.21.0/` for the
exact pinned Windows x64 ZIP. No caller-controlled host/path/URL, arbitrary
redirect, runtime npm install or worker fetch is allowed. Enforce ZIP and Node
hashes before execution. Certification tooling may read official public schema,
package and advisory sources during a separately recorded dependency preparation
step; actual offline tests use the retained pins with network disabled.

Generic execution requires **no secret**. No config secret value/reference or
GitLab/Jenkins/Azure credential is accepted. Their templates declare no secret
or service-connection binding. The GitHub job needs only `contents: read` for
checkout and the platform's artifact transport capability; no ordinary secret,
OIDC permission, repository write, check-run creation or secret inheritance.
Checkout uses `persist-credentials: false`. Token-bearing environment variables
never reach the semantic child, logs or evidence. The parent reads only fixed
metadata/bootstrap variable names; it must not enumerate or record the ambient
environment. Deletion is ordinary temporary-file removal, not a secure-erasure
claim. Avoid collecting secrets in the first place.

The generated definitions and installation/configuration are trusted reviewed
code. Candidate repository contents, MIPs, metadata and event values are
untrusted data. Never execute package managers, scripts, hooks, modules or
pipeline files from the data checkout. No `pull_request_target`, `workflow_run`,
fork-controlled reusable workflow, secret-enabled MR job, privileged runner,
checkout of untrusted code as tools, or dynamic command/expression is supported.
GitHub v1 uses manual dispatch of a reviewed workflow and no event-file parsing.
GitLab/Jenkins/Azure deployment requires the owner of that optional existing
service to restrict pipeline definitions and bootstrap variables to trusted
jobs/branches. Running an attacker-controlled Jenkinsfile or YAML is outside
this adapter's security claim; the adapter cannot secure an entire CI service.
Unavailable protected bootstrap capabilities produce failure, never fallback
to executable/configuration discovery in the candidate repository.

## 13. Processes, deadlines, cancellation and concurrency

The supervisor spawns one fresh semantic child using `process.execPath`, after
checking the pinned Node executable digest. Use direct argv, `shell:false`,
`windowsHide:true`, no PATH resolution and fixed trusted worker entry point.
No `exec`, `cmd /c`, Bash, shell-composed command, user module, native addon,
WASI, inspector or executable selection is permitted. Node flags are fixed:
`--permission`, read permission only for the package's shipped code/closure,
`--max-old-space-size=256`, `--max-semi-space-size=16`. Do not grant child,
worker-thread, addon, inspector, WASI or filesystem-write permissions to the
semantic child. Install network/write/process denial hooks before SDK import.
The shipped closure and built-in restrictions are defense in depth for trusted
code, not a claim to safely execute arbitrary JavaScript.

Construct a fresh child environment containing only validated Windows
`SystemRoot` and `WINDIR`; no PATH, TEMP, HOME, NODE_OPTIONS, NODE_PATH,
preload flags, proxy, token, provider metadata or inherited `execArgv`.
Use anonymous pipes, bounded writes/read buffers and explicit EOF; no public
port. The fixed Windows filesystem helper uses the same environment and is
never concurrent with the semantic child. **Correction A:** the whole attributable
Windows tree has at most three role-bound processes: the pinned Node supervisor,
one direct active workload child (the fixed PowerShell filesystem helper OR the
pinned Node semantic worker), and at most one Windows System32/conhost.exe
owned by that active child. The required third role in the helper phase is the
Windows console host, not a simultaneous semantic worker. No arbitrary three-process topology
is accepted; a fourth attributable process fails validation. Extra helpers,
semantic workers, substituted executables and all other descendants are denied.

The validated headless supervisor launch uses Windows DETACHED_PROCESS with
redirected private pipes and no supervisor-owned console host. The PowerShell
helper itself remains non-detached with its frozen direct argv and private
protocol. A console-owning supervisor that adds another attributable console
host is outside this profile and must fail; never hide it from accounting.
An existing-console launch is admissible only if the same role/ownership
witness passes. Runtime flags and public CLI argv remain unchanged.
The independent Windows observer validates executable identities, PID/parent
and creation identity, command line and phase exclusivity. It fails unexpected
topology; this is not a new kernel process sandbox or arbitrary shell service.
Production denies executable selection and child descendants through the
trusted closure and permission boundary. No broad taskkill targets unrelated
processes. At normal completion, helper/child failure, timeout and handled
cancellation all observed authorized roles must exit within the existing cleanup
allowance. Test parent termination where safe and report externally observed
cleanup; never infer clean cancellation from a killed supervisor alone.
Fixed PowerShell launchers are provider presentation/bootstrap only; they
use literal code plus argv arrays, never `Invoke-Expression` or concatenated
commands. Their checked absolute paths exclude embedded quotes/control syntax.

Semantic deadline is normalized config `timeoutMs`, measured monotonically
from successful child creation through verified response and exit. Overall
deadline is `timeoutMs + 15000` ms from accepted launch, covering acquisition,
metadata, integrity, semantic execution, publication and cleanup; maximum
75000 ms. Both are wall-clock deadlines, not CPU-time claims. Cleanup has a
2000 ms termination allowance reserved inside the overall deadline. Work stops
no later than overall deadline minus 2000 ms so child cleanup does not extend
the 75000 ms maximum; publication must also fit the remaining budget. At a
deadline or
handled cancellation, mark the generation terminal first, close input, kill
the direct child, await close/reap within that allowance and reject late bytes.
If cleanup cannot be confirmed, emit failure and publish no completion marker.
Never issue a result before child exit and integrity verification.
Recheck the shipped runtime/contract closure after child exit and before marker
publication; a changed file invalidates the attempt regardless of its outcome.

Cancellation sources are SIGINT/console Ctrl+C where delivered, SIGTERM where
delivered by the host, or a supervisor AbortSignal in the internal execution
API. No cancellation URL/file/metadata value is accepted. A forced provider
kill may prevent any cleanup handler or receipt; record interruption externally
and do not assert clean cancellation. Completed marker publication is the
linearization point: cancellation before it wins; after it, the already complete
result is immutable. A later provider cancellation is recorded separately.

One invocation evaluates once: one active semantic child, zero queue, no
in-process retries/batching. Distinct supervisors can run independently with
distinct RunIds/output directories; each keeps the same limits. No global
resource reservation or multi-job scheduling is promised. Provider attempts
and manual reruns get fresh RunIds, never reuse/overwrite evidence. No automatic
retry or cancellation of another invocation; provider supersession cannot
relabel old results. Input/semantic digests allow comparison; RunId and metadata
identify the operational attempt only. No cross-run cache of prepared inputs,
contexts, evaluations, provider outputs or MemoryOS-specific dependencies.

## 14. Limits and bounded measurement

`contracts/limits.json` starts with state `PRELIMINARY`, then `FINAL` after the
Phase 1 resource review records actual witnesses. Fixed transport limits below
are frozen now; changing them or timeouts needs a correction. Measurement may
finalize the engineering RSS acceptance ceiling downward with rationale; it
may not silently expand scope/limits. No adapter rewrites semantic limits.

| Resource | Ceiling / enforcement / rationale |
|---|---|
| Config / deployment | 16384 bytes each; bounded read and closed parser before allocation-heavy work |
| Operational JSON structure | depth 8, 256 object members total, 1024 nodes, key <=64 code units; duplicate rejection; per-string field bounds apply |
| Policy / Policy Set | 2048 / 4096 raw bytes, selected existing integration transport envelope, not a new semantic rule |
| Each MIP / sum of semantic input | 524288 / 1052672 bytes (two MIPs plus maximum Set); existing bounded MIP envelope allows Regression without an unbounded batch |
| Worker request / response | 1410000 / 24576 bytes, covers base64 and fixed framing; stop reads at cap+1 |
| Metadata | 4096 aggregate bytes, per-field limits in section 7 |
| Identity / outcome | <=4060 bytes each, exact SDK bytes, preserve authoritative outcome bound |
| Result / evidence / manifest / marker | 8192 / 16384 / 8192 / 1024 bytes; published sum <=49152 |
| Stdout / diagnostics | 1024 summary; 1024 per diagnostic, 16384 total and <=32 records |
| Generated file / generation bundle | 32768 per provider file, 131072 total first-party generated bytes; <=3 generated files |
| Processes / concurrency | Correction A: at most 3 attributable role-bound processes, one direct helper OR semantic child plus its required Windows console host; one semantic evaluation, no queue/retry |
| Supervisor / worker V8 old space | 128 / 256 MiB launch ceilings; worker semi-space 16 MiB; V8 heap caps are not total RSS caps |
| Engineering aggregate peak RSS | Preliminary acceptance <=768 MiB for the entire attributable tree (supervisor, active helper OR semantic child, and console host), observed externally on Windows; no false claim of an OS-enforced product RSS ceiling |
| Time | semantic 1000–60000 ms, default 60000; overall semantic+15000; helper/termination <=2000 each within overall |
| Temporary disk | <=2097152 bytes per invocation including partial writes and complete artifacts, no raw MIP copy to disk |

The exact limits-file shape is `{kind:"MemoryOSCICDResourceLimits",
version:"1.0.0",state:"PRELIMINARY"|"FINAL",fixed:{...},engineering:{...}}`.
`fixed` has exactly these integer-valued members:

```text
configBytes:16384, deploymentBytes:16384, jsonDepth:8, jsonMembers:256,
jsonNodes:1024, jsonKeyCodeUnits:64, policyBytes:2048, policySetBytes:4096,
mipBytes:524288, semanticInputBytes:1052672, workerRequestBytes:1410000,
workerResponseBytes:24576, metadataBytes:4096, identityBytes:4060,
outcomeBytes:4060, resultBytes:8192, evidenceBytes:16384, manifestBytes:8192,
markerBytes:1024, bundleBytes:49152, stdoutBytes:1024, diagnosticBytes:1024,
diagnosticsBytes:16384, diagnosticRecords:32, generatedFileBytes:32768,
generationBytes:131072, generationFiles:3, processCount:3, semanticWorkers:1,
semanticQueue:0, supervisorOldMiB:128, workerOldMiB:256, workerSemiMiB:16,
semanticMinMs:1000, semanticDefaultMs:60000, semanticMaxMs:60000,
overallAllowanceMs:15000, helperMs:2000, terminationMs:2000,
helperRequestBytes:16384, helperResponseBytes:1024, helperPaths:64,
temporaryBytes:2097152, fullPathCodeUnits:240
```

`engineering` has exactly `aggregateRssMiB:768`. The authorized preliminary-to-
final transition and any documented downward engineering ceiling produce a
new limits/contract identity and refreshed dependent evidence; no fixed member
changes under that transition. Per-field metadata/path grammar bounds remain
schema constants. Operational JSON structural limits apply to CI envelopes,
not to the embedded SDK artifacts/MIPs, whose authority is preserved.

Contract manifest, schema corpus and package verification have fixed package
byte inventories; do not count the large upstream engineering schemas as
semantic request input. Package input files and schema import closure are
bounded by their locked manifests, not a recursive directory scan.

Phase 1 measurement has **maximum 60 minutes elapsed for the entire measurement
task**, including setup, diagnostics and repeats; stop earlier if insufficient
remaining budget. First validate structure/limits mathematically, then run one
small PASS, one Set, one Regression and one maximum admitted transport/semantic
boundary case. Add at most three cold and three warm runs only for a case whose
variance prevents a decision. One optional <=5-minute stress segment may probe
cancellation/publication or simultaneous independent runs; no universal soak
and no cartesian repetition over all semantic vectors/providers.

Correction A counts every attributable role, including trusted PowerShell and
its Windows console host, in aggregate RSS. Wall-clock time includes helper
startup, protocol, semantic execution, publication and cleanup; no memory or
time ceiling is increased. Preserve failure evidence from the original ceiling.

Use monotonic elapsed clocks, external Windows RSS/process observation and
actual immutable inputs. Record sample interval, gaps, measurement overhead,
peaks and clock basis; endpoint samples alone cannot claim an in-call peak.
Separate functional parity, limit enforcement and characterization. Reuse
unchanged semantic evidence only with explicit source/identity binding.
Timeout/RSS insufficiency is diagnosed as a bounded implementation/resource
issue; do not inflate budgets or perform a multi-hour campaign. Preserve the
attempt and obtain an authority correction if frozen behavior cannot meet it.

## 15. Generation and deployment contract

One normalized `memoryos-ci.json` is the semantic/configuration source for all
providers. A separate `memoryos-ci.deployment.json` supplies only deployment
data; it cannot override semantics. Its exact schema is:

```text
{
 kind:"MemoryOSCICDDeployment",version:"1.0.0",provider:Provider,
 distributionDigest:Digest,
 options: {}                                      // generic
   | {runnerTag:Label}                            // gitlab
   | {agentLabel:Label}                           // jenkins
   | {pool:Label}                                 // azure
   | {repository:RepositorySlug,toolRevision:Revision,configPath:RelativeFile} // github
}
```

The comments/union describe a schema, not literal JSON. `Label` is 1–64 ASCII
letters/digits/underscore/hyphen; `RepositorySlug` is two slash-separated
1–100-character ASCII alphanumeric/underscore/dot/hyphen segments, no leading
dot or `..`. `toolRevision` must identify an already existing reviewed commit
when deployed; it is never a moving branch/tag or an invented future hash.
`configPath` points within that trusted GitHub tool checkout to the common
config. Other providers acquire the same config from protected provisioning.
The generator embeds its normalized config digest and distribution digest
as constants. These pins are deliberately supplied externally to the package
manifest, avoiding a package/config/workflow self-reference.

Generated outputs, relative to the newly created `--output` directory:

| Provider | Primary usable artifact | Other generated files |
|---|---|---|
| generic | `memoryos-ci.json` | `memoryos-ci-generation.json` |
| github | `.github/workflows/memoryos-ci.yml` | canonical `memoryos-ci.json`, `memoryos-ci-generation.json` |
| gitlab | `.gitlab-ci.yml` | canonical `memoryos-ci.json`, `memoryos-ci-generation.json` |
| jenkins | `Jenkinsfile` | canonical `memoryos-ci.json`, `memoryos-ci-generation.json` |
| azure | `azure-pipelines.yml` | canonical `memoryos-ci.json`, `memoryos-ci-generation.json` |

The generator owns no installation into an existing checkout. Output directory
must not exist; no `--force`, overwrite, merge, backup or interactive replacement.
Generate and validate in memory, exclusively reserve the requested directory,
and write only under its `.pending/` child until every file verifies. Move the
verified files to their final names and write the generation manifest last,
then remove the empty staging directory. An output lacking a valid manifest
is incomplete and must never be installed as a workflow. Failure never
replaces a usable definition. Repeated generation into
different fresh directories from the same normalized config/deployment and
generator identity produces byte-identical files, including manifest.
Production generation uses the dependency-free closed first-party structural
validator. The full upstream schema/independent-parser layers in section 17
are mandatory engineering conformance, not a Python runtime requirement for
the installed generator.

Manifest: `{kind:"MemoryOSCICDGeneration",version:"1.0.0",
generator:{id:"memoryos.cicd.generator",version:"1.0.0",sha256:Digest},
configurationSha256:Digest,deploymentSha256:Digest,provider:Provider,
files:[{path,byteLength,sha256}]}`; rows sorted by path, self excluded.
Generator SHA hashes `J` of path-sorted `{path,byteLength,sha256}` rows for
`src/generator.mjs`, its statically imported first-party generator helpers,
provider modules and templates/grammar. Adapter SHA uses the same construction
for the selected provider module, its static first-party helper closure and
selected template; generic has no template. Rows are drawn from the verified
distribution inventory and exclude manifest/receipt files. Shared execution
code is additionally bound by `distributionDigest`. Neither digest includes
itself, this generated manifest or a future result. No absolute output path,
timestamp or random ID.

YAML is a deliberately restricted single-document subset: spaces only,
two-space mapping indentation, ordered keys as section 16, explicit single
quoted ordinary strings with doubled quote escaping, fixed literal block
scripts, decimal integers and literal booleans. Quote `on` in GitHub YAML to
avoid YAML 1.1 boolean ambiguity. No anchors, aliases, merge keys, tags, custom
types, duplicate keys, flow collections, includes or user-written expressions.
Generated templates may contain only the exact fixed provider expressions
listed below. Jenkins uses a restricted Declarative Pipeline AST and fixed
single/triple-single-quoted literals; no interpolated GString or arbitrary
Groovy expression. All files UTF-8 without BOM and LF with exactly one final
LF. Normalized config/manifest use `J`. Never paste candidate data into code.

## 16. Provider files and usable deployment profiles

The following defines implemented scope required later, not current
implementation status. Optional live deployments naturally need that provider's
own runner/service; these are **consumer deployment conditions only**, never
MO-1306 development, certification, release or user-provisioning requirements.
Offline conformance supplies synthetic bootstrap environments and runs the
same launcher/core on native Windows.

### 16.1 Shared Windows launcher

Package `scripts/Invoke-MemoryOSCI.ps1` is fixed reviewed PowerShell 5.1-compatible
code. It accepts literal provider, workspace, config digest and distribution
digest arguments. Protected bootstrap variables are exactly
`MEMORYOS_CI_NODE`, `MEMORYOS_CI_HOME`, `MEMORYOS_CI_CONFIG`, absolute trusted
Node executable, package directory and config file. No defaults or PATH lookup.
Validate paths/pins before invoking code, remove Node preload/search variables
before starting Node, use argv arrays and capture `$LASTEXITCODE` immediately.
The package must be provisioned from a verified distribution by a trusted
operator; a malicious package cannot verify its own trust. The launcher verifies
its manifest/config/Node pins again and delegates `run`. The provider script
does not interpolate these values into executable text. It exits with the exact
common code after local verification; stderr alone is not failure authority.

Generated GitLab/Jenkins/Azure definitions refer to the protected absolute
launcher via `MEMORYOS_CI_HOME`; they never execute a launcher from their data
checkout. Their immutable script skeleton selects workspace from the provider's
documented workspace variable (`CI_PROJECT_DIR`, `WORKSPACE`, `BUILD_SOURCESDIRECTORY`),
passes constant provider and digest literals, and propagates the launcher exit.
The fixed host-capability environment reads additionally permit `SystemRoot`,
`WINDIR`, the listed provider workspace variable, and in GitHub bootstrap only
`GITHUB_WORKSPACE`/`GITHUB_OUTPUT`. They are validated filesystem capabilities,
never serialized metadata or values interpolated into executable code.
The generator emits no credential placeholders and no user-supplied script.
Pre-provisioning instructions must explain these three ordinary nonsecret
variables, exact pinned Node/package/config and trusted-branch restriction.

### 16.2 GitLab

`.gitlab-ci.yml` contains only, in order: `stages: [test]` (rendered as a block
sequence), then job `memoryos_policy`. Job keys in order: `stage: test`,
`tags: [<runnerTag>]`, `when: manual`, `allow_failure: false`, `timeout: 5m`,
`retry: 0`, and `script` containing one fixed literal PowerShell block.
The consumer's tagged runner must use Windows PowerShell or pwsh, with the
three protected bootstrap variables. No image, service, include, dynamic child
pipeline, cache, artifact-upload or secret section. Manual execution avoids
implicitly authorizing arbitrary MR/fork jobs. The job's final command exits
the captured common numeric status.

GitLab documents these job keys and Windows PowerShell execution in its
[CI YAML reference](https://docs.gitlab.com/ci/yaml/) and
[runner shell documentation](https://docs.gitlab.com/runner/shells/).
An official editor JSON schema **does exist**. Validate the generated parsed
mapping against the pinned schema in section 17, then enforce this smaller
closed subset and an independent job-to-invocation projection. The schema
does not simulate scheduling, protected-variable administration or a real runner.

### 16.3 Jenkins

`Jenkinsfile` uses Declarative Pipeline only. Closed AST, in order:
`pipeline { agent { label '<agentLabel>' }; options { skipDefaultCheckout();
timeout(time: 5, unit: 'MINUTES') }; stages { stage('MemoryOS Policy') {
steps { checkout scm; powershell(encoding: 'UTF-8', script: '''<fixed script>''')
} } } }`. Semicolons here separate AST elements; the renderer emits conventional
newlines. Only these identifiers, named arguments, constant literals, braces,
parentheses and the constant embedded script are legal. The script invokes the
protected launcher and exits its status; Jenkins' step failure preserves a
nonzero gate. No `script {}`, evaluation of Groovy data, shared library, dynamic
agent, shell `sh`/`bat`, parameters, credentials, post-upload or plugin install.

The optional consumer Jenkins service must already offer Declarative Pipeline,
checkout and the PowerShell step on its labelled Windows agent. These existing
service capabilities are not plugin-install requirements on the owner. Validate
with an independent tokenizer/parser and exact AST grammar, never execute
Groovy. No complete offline Jenkins service/plugin schema is claimed. The
[Declarative syntax](https://www.jenkins.io/doc/book/pipeline/syntax/) and
[PowerShell step](https://www.jenkins.io/doc/pipeline/steps/workflow-durable-task-step/)
are the source contract. Service/plugin combinations and live behavior remain
NOT EXECUTED.

### 16.4 Azure DevOps

`azure-pipelines.yml` contains `trigger: none`, `pr: none`, `pool` with
`name: <pool>` and `demands: [Agent.OS -equals Windows_NT]`, then `jobs` with
one `job: memoryos_policy`, `timeoutInMinutes: 5`, `cancelTimeoutInMinutes: 1`,
and `steps`. First step: `checkout: self`, `persistCredentials: false`,
`submodules: false`, `lfs: false`. Second: `powershell: <fixed literal script>`,
`displayName: MemoryOS Policy`, `failOnStderr: false`, `ignoreLASTEXITCODE: false`.
No service connection, variable group, expression parameters, template include,
container, cache or artifact-upload task. Existing optional consumer Windows
pool and protected bootstrap variables supply runtime/config; none is needed
for offline release validation.

Validate against Microsoft's pinned official editor schema and the smaller
closed subset. The documented
[PowerShell step](https://learn.microsoft.com/en-us/azure/devops/pipelines/yaml-schema/steps-powershell)
supports explicit exit-code propagation; the
[YAML schema reference](https://learn.microsoft.com/en-us/azure/devops/pipelines/yaml-schema/)
defines the selected job/checkout keys. Structural validity does not prove
service queueing, authentication, task installation or live execution.

### 16.5 GitHub and MO-1302 preservation

Select a **new provider-neutral runner invoked from GitHub Actions**. Do not
wrap or edit MO-1302's released Action/workflow, rename its check, change its
pins, or turn its historical Ubuntu job into an MO-1306 prerequisite. Preserve
the [MO-1302 gate contract](../repositories/cca-conformance/docs/mo1302-github-policy-gate.md)
and its exact artifacts. New workflow name is `MemoryOS Provider-Neutral CI`,
job identifier `memoryos_ci`, display name `MemoryOS CI`; it does not replace
`memoryos-policy-gate / MemoryOS Policy Gate` in branch protection.

New workflow top-level keys: `name`, quoted `on` with `workflow_dispatch: {}`
(render as an empty mapping, the sole permitted flow-mapping literal),
`permissions` with `contents: read`, then `jobs.memoryos_ci`. No user dispatch
inputs, automatic PR/push trigger, inherited secrets or reusable-call inputs.
Job keys: `name`, `runs-on: windows-2022`, `timeout-minutes: 10`, `steps`.
Use `shell: powershell` for fixed bootstrap/gate steps. Ordered operations:
Step IDs are respectively `tools`, `data`, `bootstrap`, `evaluate`, `upload`,
`gate`. The tool repository must be the workflow repository or an existing
public repository accessible without an extra secret; cross-private-repository
credentials are outside v1.

1. Pinned checkout of `deployment.options.repository` at `toolRevision` into
   `_memoryos/tool`, credentials not persisted, submodules/LFS disabled.
2. Pinned checkout of the current workflow repository at `${{ github.sha }}`
   into `_memoryos/data`, same protections; treat it solely as data.
3. Fixed bootstrap downloads only the pinned Node ZIP, verifies hash/length
   and extraction entries, verifies Node and the trusted package manifest,
   and locates `repositories/memoryos-ci` and the pinned config under tool.
4. Evaluate with literal `github`, workspace `_memoryos/data` and trusted
   bootstrap variables. Capture exit and verify the complete bundle. Emit only
   allowlisted `GITHUB_OUTPUT` values `complete=true|false`, `exit-code=<integer>`
   and `run-id=<RunId>`; no input/metadata expression enters shell text.
   This transport step returns normally to permit uploading a failed gate's
   evidence; the final step below always projects the original result.
5. Pinned upload-artifact, only if a complete verified bundle exists, with
   `if: always() && steps.evaluate.outputs.complete == 'true'`,
   `if-no-files-found: error`, `include-hidden-files: true`, `retention-days: 7`.
   Use artifact name `memoryos-ci-${{ github.run_id }}-${{ github.run_attempt }}`.
   Upload only the six/four allowed basenames under that verified run directory;
   output RunId is validated before use. No entire checkout or recursive wildcard
   collection. Verify exact file cardinality immediately before upload.
6. Final `if: always()` gate fails if execution/completion or upload failed;
   otherwise revalidate the bundle and exit with the recorded common code.

Fixed expression slots are only `github.sha`, `github.run_id`,
`github.run_attempt`, `steps.evaluate.outputs.complete`,
`steps.evaluate.outputs.exit-code`, `steps.evaluate.outputs.run-id`,
`steps.evaluate.outcome`, `steps.upload.outcome`, and the stated `always()`
condition. The gate receives the two step outcomes as fixed environment data;
both must be `success` as well as completion true before it returns the common
code. Missing/failed upload returns 17, missing/failed evaluation without a
complete bundle returns the captured valid common error or 16 if unavailable.
Any other expression is rejected.
The exit value is data via a fixed environment assignment, parsed against the
closed numeric catalog, never embedded in a command string. No cache or
setup-node action. The ordinary bootstrap checkout/transport may use provider
credentials; the worker does not receive them.

Use the already reviewed immutable Action revisions as initial selected pins:
`actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1` and
`actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a`.
Phase 3 supply-chain review must freshly inspect their actual bytes/runtime and
advisories; an unacceptable pin requires a correction, not a floating upgrade.
GitHub lists `windows-2022` as an x64 hosted runner in its
[runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
Receipt records the actual Windows Server image/build; it is not a Windows 11
local-execution witness. Hosted allocation/billing restrictions cannot silently
introduce paid resources, Linux or a local VM; record NOT EXECUTED and use the
explicit disposition process in section 20.

## 17. Offline validation, schemas and injection defenses

Official-source research on 2026-09-25 found both editor schemas. These are
engineering inputs, not a claim that a JSON Schema implements either service.
The bytes below were read through the public GitHub API and hashed in memory;
no schema/dependency/provider fixture is added by this freeze.

| Source | Exact selected snapshot | Size / SHA-256 |
|---|---|---|
| [GitLab editor schema, official mirror](https://github.com/gitlabhq/gitlabhq/blob/a725331f22234d3078d7300944b9454da103e73c/app/assets/javascripts/editor/schema/ci.json) | `a725331f22234d3078d7300944b9454da103e73c`, `app/assets/javascripts/editor/schema/ci.json`; compare origin attribution to the [GitLab source](https://gitlab.com/gitlab-org/gitlab/-/raw/master/app/assets/javascripts/editor/schema/ci.json) when retaining it | 128034 / `a4dc2b155aa574575fbfd51dcca99388db5ba1b563ab5e05ce8df005e7eb9ced` |
| [Microsoft Azure Pipelines editor schema](https://github.com/microsoft/azure-pipelines-vscode/blob/9e40e814abd20917f273dd587497086f0476a563/service-schema.json) | `9e40e814abd20917f273dd587497086f0476a563`, `service-schema.json` | 1640523 / `f00a9630f6550204148634d9a13f634b5750a225559886effe09a751482f0459` |

Retain exact upstream bytes, URL, commit, digest and applicable notices in
engineering fixtures; resolve references only from a pinned local registry.
Do not fetch schemas while validating or silently update a schema to make a
failure pass. The service-schema vocabulary includes editor annotations; record
which are annotations and separately enforce behavioral constraints such as
Azure's first-key ordering. An unsupported assertion is a validator failure,
not silently ignored coverage. There is no complete official Jenkins offline
service schema or selected official GitHub machine schema in this freeze;
their documented restricted grammar is the declared local scope.

Validation layers, in order:

1. Bounded bytes/encoding, safe paths, control scanning, no duplicate keys,
   aliases/anchors/tags/includes or unauthorized expression tokens.
2. Independent YAML token/AST parse or Jenkins lexer/parser to the closed
   provider representation. Reject extra jobs/steps/keys, modified fixed script
   bodies, forbidden constructs and malformed scalar types. Check that only
   designated data slots differ from the frozen skeleton.
3. Full Draft-07 validation against retained official GitLab/Azure schemas;
   full Draft 2020-12 checks for CI JSON schemas; then custom closed-subset,
   ordering, cross-field, script-AST and security constraints.
4. Byte-identical generation across repeated calls, key-order permutations,
   new output roots/locales and normalized defaults; independent checked-in
   golden files and negative fixtures, not only generator self-comparison.
5. An independently implemented AST-to-normalized-launch decoder compares
   provider, argv, trusted config digest, workspace capability, deadline,
   metadata mapping, publication and exit projection with the generic contract.
6. Execute the fixed PowerShell launch skeleton on native Windows with synthetic
   provider variables and the real generic runner. Compare exact SDK normative
   bytes/digests for Policy/Set, Regression, PASS/FAIL/CNE and stable errors.
   Vary all operational/diagnostic metadata without changing semantic inputs.

Use PowerShell's parser in parse-only mode to validate the fixed generated
scripts and compare their permitted ASTs; never execute submitted script text.
No regex-only validator, general Groovy interpreter, self-agreeing encoder/
decoder, or fake provider simulator can substitute for these layers.

Engineering-only parser/standards dependencies are explicitly justified:
[PyYAML 6.0.3](https://pypi.org/project/PyYAML/6.0.3/) for independent token/AST
parsing (no unsafe constructors), and
[jsonschema 4.26.0](https://pypi.org/project/jsonschema/4.26.0/) for complete
Draft-07/2020-12 assertion validation. The existing small conformance validator
does not implement `oneOf`/`patternProperties` fully and must not be presented
as complete validation of the provider schemas. These two dependencies and
their exact transitive wheels/licenses are locked with hashes in the Phase 1
engineering environment, reused by 2B/2C, and excluded from shipped/runtime
package dependencies. No schema remote reference/network or optional format
download is allowed. The restricted YAML profile treats `on` as a string and
checks scalar kinds independently of PyYAML's general YAML 1.1 coercions.

Mandatory negative corpus: LF/CR/NUL/ANSI injection; YAML key/sequence injection;
anchors, aliases, merge keys and tags; duplicate keys at every object level;
Groovy quotes/triple quotes/GStrings/interpolation; PowerShell quotes/backticks,
`$()`, semicolons, pipelines and newline commands; option/argv smuggling;
`${{ }}`, `$[]`, `$(...)`, GitLab variable references and Jenkins `${...}` in
data slots; provider log commands; multiline labels; malformed Unicode;
secret-looking sentinel values; path traversal/ADS/UNC/device/reparse/hardlink
and replacement races; altered digest pins; changed runtime/module/schema;
late child responses; partial evidence; stale/wrong-run uploads; provider
metadata that resembles a URL, executable, context or authority token.

Reject forbidden data rather than escaping it into a larger language. Only
fixed, reviewed provider expression/PowerShell code is executable. Ordinary
path spaces are transported as arguments; labels, hashes and repository slots
have restrictive alphabets. No user-controlled expression or multiline script
is a supported feature.

## 18. Closed error catalog

All machine error codes have prefix `MO1306_`; earlier sections use the suffix
as shorthand. The following is the exact machine-readable source for
`contracts/errors.json` (pretty-printed here; implementation uses `J`). Tuple
positions are `[classification,exitCode,stage]`. Diagnostic truncation is the
sole diagnostic-only code and is never a product failure or result error.

```json
{
  "kind": "MemoryOSCICDErrorCatalog",
  "version": "1.0.0",
  "errors": {
    "MO1306_USAGE": ["CONFIGURATION_ERROR", 10, "LAUNCH"],
    "MO1306_CONFIG_READ": ["CONFIGURATION_ERROR", 10, "CONFIGURATION"],
    "MO1306_CONFIG_INVALID": ["CONFIGURATION_ERROR", 10, "CONFIGURATION"],
    "MO1306_VERSION_UNSUPPORTED": ["CONFIGURATION_ERROR", 10, "CONFIGURATION"],
    "MO1306_PROVIDER_UNSUPPORTED": ["CONFIGURATION_ERROR", 10, "CONFIGURATION"],
    "MO1306_METADATA_INVALID": ["CONFIGURATION_ERROR", 10, "METADATA"],
    "MO1306_GENERATION_INVALID": ["CONFIGURATION_ERROR", 10, "GENERATION"],
    "MO1306_INPUT_READ": ["INPUT_ERROR", 11, "ACQUISITION"],
    "MO1306_INPUT_LIMIT": ["INPUT_ERROR", 11, "ACQUISITION"],
    "MO1306_FILESYSTEM_BOUNDARY": ["INPUT_ERROR", 11, "ACQUISITION"],
    "MO1306_INPUT_CHANGED": ["INPUT_ERROR", 11, "ACQUISITION"],
    "MO1306_SEMANTIC_VALIDATION": ["SEMANTIC_ERROR", 12, "SEMANTIC"],
    "MO1306_SEMANTIC_INVOCATION": ["SEMANTIC_ERROR", 12, "SEMANTIC"],
    "MO1306_WORKER_PROTOCOL": ["SEMANTIC_ERROR", 12, "SEMANTIC"],
    "MO1306_WORKER_EXIT": ["SEMANTIC_ERROR", 12, "SEMANTIC"],
    "MO1306_TIMEOUT": ["TIMEOUT", 13, "SEMANTIC"],
    "MO1306_OVERALL_TIMEOUT": ["TIMEOUT", 13, "CLEANUP"],
    "MO1306_CANCELLED": ["CANCELLED", 14, "CLEANUP"],
    "MO1306_RUNTIME_INTEGRITY": ["INTEGRITY_ERROR", 15, "INTEGRITY"],
    "MO1306_CONFIG_INTEGRITY": ["INTEGRITY_ERROR", 15, "INTEGRITY"],
    "MO1306_POLICY_PIN": ["INTEGRITY_ERROR", 15, "INTEGRITY"],
    "MO1306_SEMANTIC_INTEGRITY": ["INTEGRITY_ERROR", 15, "INTEGRITY"],
    "MO1306_BUNDLE_INTEGRITY": ["INTEGRITY_ERROR", 15, "VERIFICATION"],
    "MO1306_INTERNAL_FAILURE": ["INTERNAL_ERROR", 16, "INTERNAL"],
    "MO1306_CLEANUP_FAILED": ["INTERNAL_ERROR", 16, "CLEANUP"],
    "MO1306_OUTPUT_LIMIT": ["ARTIFACT_ERROR", 17, "PUBLICATION"],
    "MO1306_OUTPUT_EXISTS": ["ARTIFACT_ERROR", 17, "PUBLICATION"],
    "MO1306_ARTIFACT_WRITE": ["ARTIFACT_ERROR", 17, "PUBLICATION"]
  },
  "diagnostics": ["MO1306_DIAGNOSTICS_TRUNCATED"]
}
```

All messages are presentation-only. Config byte/shape limits map to
CONFIG_INVALID; deployment/schema/grammar failure to GENERATION_INVALID;
unknown config versions to VERSION_UNSUPPORTED; generated-output existence to
OUTPUT_EXISTS. A path-boundary violation is FILESYSTEM_BOUNDARY even if the
target happens to exist; an ordinary missing/denied semantic file is INPUT_READ.
Output-boundary violations during publication map to ARTIFACT_WRITE. SDK
deterministic validation errors map to SEMANTIC_VALIDATION and preserve the
stable allowlisted SDK code; unexpected facade throw maps to
SEMANTIC_INVOCATION, worker abnormal exit/OOM to WORKER_EXIT. Integrity mismatches
are never converted to CNE. Helpers unable to establish safe paths fail with
FILESYSTEM_BOUNDARY; helper execution exceeding the remaining total deadline
is OVERALL_TIMEOUT.

Evaluation order is launch/runtime integrity, config, metadata, filesystem/input
acquisition, Policy pin/SDK acquisition/evaluation, verification, publication.
Report the first failing gate in that order. Within a closed object validate
schema fields in ASCII order, input roles in section 9 order. After terminal
timeout/cancellation ignore late errors; only inability to clean up or publish
may supersede its operational code, and no completion marker may be published
if cleanup is uncertain. If timeout and cancellation are observed in the same
event turn before publication, cancellation wins. Output overflow stops output
production immediately; it does not truncate a normative artifact into success.

## 19. Distribution, dependency and supply-chain scope

Create one future repository package at `repositories/memoryos-ci`, version
`0.1.0`, `type: module`, private, zero npm runtime dependencies, no lifecycle
install hooks, no provider SDK. Product layout is frozen as follows:

| Path within package | Responsibility |
|---|---|
| `bin/memoryos-ci.mjs` | Public argv/exit boundary |
| `src/core.mjs`, `src/generic.mjs` | Shared normalized execution and reference runner |
| `src/worker.mjs`, `src/worker-boundary.mjs` | Isolated SDK delegation and denial boundary |
| `src/generator.mjs` | Pure deterministic provider generation |
| `src/providers/{generic,github,gitlab,jenkins,azure}.mjs` | Exact adapter interface, no evaluator copies |
| `templates/{github.yml,gitlab.yml,jenkins.groovy,azure.yml}.tpl` | Fixed reviewed grammars/skeleton bytes |
| `schemas/` | `<configuration,deployment,invocation,result,evidence,artifacts,complete,generation,summary>-1.0.0.schema.json` |
| `contracts/` | `contract.json`, `errors.json`, `projection.json`, `limits.json`, `policy-contract-identities-1.0.0.json` |
| `runtime/authoritative/`, `runtime/runtime-closure-manifest.json` | Exact 25-file semantic closure and provenance |
| `scripts/Invoke-MemoryOSCI.ps1`, `scripts/check-paths.ps1` | Fixed Windows bootstrap/path checks |
| `scripts/verify-distribution.mjs`, `scripts/pack.mjs` | Offline inventory verification and deterministic packaging |
| `package.json`, `package-lock.json`, `distribution-manifest.json`, `sbom.spdx.json` | Exact package graph/content/supply-chain records |
| `README.md`, `NOTICES.md`, `LICENSE-NOTICE.md`, `notices/` | Usable deployment instructions and preserved rights/notices |

Helper modules inside `src/` may be added without changing external surfaces;
all are inventoried. Engineering tests, validators, fixtures and upstream schemas
live in `repositories/cca-conformance/tools/mo1306/`, `tests/`, `fixtures/mo1306/`
and the package's `tests/`; never bundle the Python validator environment into
the runtime. Internal helper names beyond those above are safe implementation
details. Distribution schema filenames expand the listed alternatives into
individual literal filenames, not a filename containing angle brackets.

Initial runtime pin: Node **24.21.0 win-x64**, `node.exe` length 93580104,
SHA-256 `ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32`;
official `node-v24.21.0-win-x64.zip` length 37618919, SHA-256
`158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541`.
Engineering pack/install tooling uses npm **11.19.0** and records its full
dependency closure. Do not require npm at product evaluation time. The parent
launcher also applies the 128 MiB old-space cap; direct generic invocation must
check the required launch flag and reject inconsistent runtime configuration.

Ship `memoryos-ci-0.1.0.tgz`, npm-compatible, built by `scripts/pack.mjs` from
an explicit sorted regular-file manifest, fixed owner/mode/mtime and deterministic
gzip metadata; no host path or current time. Two offline builds must match
archive bytes/digest and installed files. Archive digest belongs to external
release evidence, never inside that archive. Distribution manifest excludes
itself and lists every shipped member once; reject unsafe paths/links/duplicate
members, undeclared executable imports and unexpected runtime files. Install
to a new directory and verify before execution; no postinstall hook or online
resolution. If npm installation is exercised, use offline, ignore-scripts and
the exact lock, not registry resolution. No publishing to npm is authorized.

Future Phase 3 review separately inventories shipped product, Node runtime,
npm/engineering Python wheels, GitHub Actions and hosted bootstrap, official
schemas and notices. Every transitive engineering wheel gets exact version,
SHA-256, source/provenance, license and offline availability before tests; that
lock resolution is a safe Phase 1 implementation detail, not permission to
change the selected top-level validators or install optional provider SDKs.
Review current advisories and reachable behavior for all selected components;
zero runtime dependencies is not zero supply-chain risk. Predecessor MCP/REST
dispositions and receipts do not certify this new package. Changed dependency,
Action, Node or template pins require a reviewed correction and affected tests.

## 20. Platform, certification scope and exact labels

| Provider | Required implementation after Phase 2 | Required certification scope | Exact successful label |
|---|---|---|---|
| generic | Executable reference runner | Real installed-package native Windows 11 x64 process execution | `REAL_EXECUTION_CERTIFIED` |
| github | New workflow + adapter preserving MO-1302 | Real `windows-2022` x64 hosted execution where safely feasible with existing GitHub access; mandatory attempt under section 21 | `HOSTED_EXECUTION_CERTIFIED` |
| gitlab | Generated usable `.gitlab-ci.yml` + adapter | All local structure/schema/security/Windows-launch/equivalence layers | `CONTRACT_VALIDATED` |
| jenkins | Generated usable `Jenkinsfile` + adapter | All restricted-grammar/security/Windows-launch/equivalence layers | `CONTRACT_VALIDATED` |
| azure | Generated usable `azure-pipelines.yml` + adapter | All local structure/schema/security/Windows-launch/equivalence layers | `CONTRACT_VALIDATED` |

Before successful relevant evidence, use `NOT_IMPLEMENTED`, `IMPLEMENTED /
VALIDATION_PENDING`, `FAILED`, `NOT_EXECUTED` or `ENVIRONMENT_BLOCKED` with a
reason. No unqualified CERTIFIED/PASS may imply a live provider execution.
Absence of GitLab/Jenkins/Azure infrastructure never changes their required
local status to blocked or excuses incomplete implementation. Native generic
Windows 11 x64 is mandatory. No Linux, Ubuntu, WSL, VM, macOS, ARM or broad
cross-platform parity certification is included. Hosted Windows Server is a
distinct platform witness, not a claim that local Windows 11 ran in Actions.

GitHub hosted execution is required when safely feasible using existing access
and free available capacity. If access/allocation/billing or security prevents
it, preserve the attempted check and report NOT EXECUTED/ENVIRONMENT_BLOCKED;
finish independent local work. Do not pay, create services, substitute Linux,
fake PASS or silently waive the requirement. Final release needs an explicit
owner disposition of that named GitHub limitation before closure. This
conditional handling does not apply to unavailable GitLab/Jenkins/Azure live
services, which were never gates.

Allowed eventual release claims: provider-neutral CI/CD integration; real
Windows generic-runner certification; real GitHub Actions certification only
if actually completed; GitLab adapter contract validation; Jenkins adapter
contract validation; Azure DevOps adapter contract validation. State precise
artifact/runtime/platform/version scope alongside them. No live GitLab/Jenkins/
Azure, Linux/Ubuntu/VM claim without a future separately authorized milestone
or correction and actual execution. This freeze makes none of those PASS claims.

## 21. Hosted GitHub certification and test catalog

Future certification workflow:
`.github/workflows/mo1306-ci-certification.yml`, distinct from product-generated
`.github/workflows/memoryos-ci.yml`. Use a reviewed dedicated certification
branch derived from the integrated implementation, explicit immutable tool
revision and manual dispatch, no untrusted dispatch inputs or secrets. Creating
that branch/workflow, pushing or dispatching is future task scope, not this
freeze's authorization. Product workflows remain reviewed deployment artifacts.

Target **one hosted workflow run** with three small PASS/FAIL/CNE cases using
the product adapter/launcher and independent fixture expectations. Each case's
final provider job must project the actual common code (FAIL/CNE jobs are
expected to be red, not masked as success). Hosted harness may copy the same
reviewed generated job skeleton into three fixed case jobs and use distinct
artifact names including the fixed case ID. This is engineering composition,
not a new product matrix/templating feature. Each job <=10 minutes, total
campaign <=30 minutes elapsed and no paid capacity. Verify exact archive
contents, downloaded digests, SDK bytes, config/tool/runtime identities, run/job/
attempt association and actual GitHub conclusions from outside the job.

Execute bounded hostile metadata/data and no-secret sentinel probes using the
same trusted Windows job where possible; no real secret, malicious executable
or privileged fork job. Real fork/MR service administration remains untested;
state that limitation. Cancellation/late-publication enforcement is mandatory
locally; hosted hard-kill timing is not inferred from a local test. One targeted
hosted rerun is allowed only after diagnosis and if the campaign budget permits;
otherwise split a newly authorized task. Retain failed attempt evidence.
Remove temporary certification branches/workflows only after evidence is
downloaded/bound and the applicable future task authorizes cleanup. Never
delete failed runs/artifacts to manufacture a clean history.

The following test IDs are required inventory categories; Phase 1 assigns
stable individual case IDs under them before implementation relies on PASS.
Each records actual scope/status, tested identity, command, elapsed time and
evidence. A category is complete only when its required cases pass, not because
a similarly named test exists.

| Category | Required independent witnesses | Phase |
|---|---|---|
| CF-CONTRACT | Schema/catalog completeness, closed fields, version rejection, A–AF traceability, no identity cycles | 1; final 3D |
| CF-CONFIG | Both operations, defaults, duplicates, conflicts, forbidden overrides, trusted config pin | 1 |
| CF-GENERIC | Real Windows process, Policy/Set/Regression PASS/FAIL/CNE, missing/invalid input, actual exits | 1, 2A, installed 3A |
| CF-SEMANTIC | Exact normative byte/digest parity against independent SDK and CLI, stable errors, preserved MO-1301 limits | 1, 2D, 3A |
| CF-GENERATION | Independent goldens, idempotency, normalized ordering, overwrite refusal, manifest verification | 1 skeleton; 2B/2C |
| CF-GITLAB | Official schema + subset + Windows launcher + generic equivalence, negative provider files | 2B, 3C |
| CF-JENKINS | Independent closed lexer/AST + PowerShell AST + Windows launcher + equivalence | 2B, 3C |
| CF-AZURE | Official schema + subset/order + Windows launcher + equivalence | 2C, 3C |
| CF-GITHUB-REGRESSION | New neutral contract, unchanged MO-1302 files/pins/required-check/exits and selected existing regression tests | 2C, 2D, 3C |
| CF-GITHUB-HOSTED | Actual three outcome jobs, artifact/identity/conclusion verification, bounded hostile-data sentinel | 3A |
| CF-FILESYSTEM | Each Windows path class, reparse type, hardlink, containment, swap, exclusive output and cleanup | 1, 2A, 3C |
| CF-NETWORK | All denied network routes and audited import closure; semantic execution succeeds offline | 1, 2A, 3C |
| CF-SECRETS | Poisoned ambient environment/preload, synthetic sentinels, no leaks in child/output/evidence, protected bootstrap failure | 1, 2C, 3C |
| CF-INJECTION | Complete section 17 corpus, independent syntax/argv parsing, fixed expression allowlist | 1, 2B/2C, 3C |
| CF-DETERMINISM | Metadata/path/time/locale permutations leave normative bytes unchanged; generation bytes invariant | 1, 2D |
| CF-ERRORS | Every error row, first-failure ordering, stable SDK error passthrough, no fabricated CNE | 1, 2D |
| CF-PROJECTION | Every result/exit/job row, publication failure, forced provider interruption distinction | 1, 2D, 3A/3C |
| CF-EVIDENCE | Sizes/canonical bytes/digests/cardinality, mutations, partial markers, wrong run and upload allowlists | 1, 2D, 3D |
| CF-RESOURCE | Structural byte math, cap-1/cap/cap+1, bounded representative measurement, independent RSS observation | 1, targeted 3A |
| CF-CANCELLATION | Ctrl+C/AbortSignal, timeout, killed child, late response, marker race, no descendant/orphan | 1, 2A, installed 3A |
| CF-CONCURRENCY | Parallel independent attempts, duplicate provider metadata, no overwrite, no cross-run cache | 2A, 2D |
| CF-PACKAGE | Reproducible archive, offline installation, full shipped-file verification, installed entry points | 2D, 3B |
| CF-SUPPLY | Node/npm/Actions/Python/schema/template/closure pins, scripts/notices/provenance/advisory disposition | 1 pins; 3B |
| CF-CONFORMANCE | Inventory/receipt negatives, coverage, acyclic revision/identity binding, honest platform/provider claims | 1 structure; 2D, 3D |

## 22. Phase ownership, gates, budgets and failure handling

| Phase | Owned work and integration gate |
|---|---|
| 1 / B1 | Shared schemas/catalogs/limits, core/SDK child, generic runner, Windows launch/path boundary, baseline generator interface/IR, engineering validator lock, baseline inventory and bounded resource review. Establish shared contracts and tests before parallel work. |
| 2A | Core/generic completion, filesystem/process/cancellation/concurrency hardening; owns shared `src/core`, `src/generic`, worker/boundary and runner tests. |
| 2B | GitLab/Jenkins modules, templates and their provider-specific independent validators/fixtures/tests; no shared schema/semantic changes. |
| 2C | Azure/GitHub modules, templates, MO-1302 preservation and untrusted-workflow security; no shared schema/semantic changes. |
| 2D / B2 | Integrate A/B/C, resolve contract drift before merge, complete generic equivalence, package/closure/generation inventory and selected baseline regressions. No certification inferred from integration. |
| 3A | Installed-package real native Windows generic execution and safely feasible actual Windows GitHub hosted witness. |
| 3B | Package reproducibility/offline install/distribution and supply-chain certification; exact executed archive/member identities. |
| 3C | Independent provider grammar/schema/equivalence, security and release-claim audit; no live-provider fabrication. |
| 3D | Integrate evidence, validate negatives/coverage/acyclic graph, bind tested implementation and receipts, final release review. Tag/push only under a later explicit finalization instruction. |

Shared schema/generator contracts are owned by Phase 1/2D integration; parallel
agents consume them and propose a correction instead of inventing incompatible
shapes. Tests/fixtures for each provider have separate ownership. No agents,
implementation worktree or production branch is created by this freeze.

Structural validation should take minutes and runs first. Focused unit/contract
suites should take minutes. Ordinary phase validation targets <=20 minutes;
each bounded campaign targets <=60 minutes. **Every local implementation or
certification task has a hard 90-minute elapsed stop unless expressly
reauthorized**, including setup/analysis/retries, as established by the
[methodology correction](mo1305-contract-freeze-1-verification-methodology-correction.md).
The stricter 60-minute measurement task and 30-minute hosted campaign limits
apply where specified. Record a monotonic task start and remaining budget;
checkpoint before launching work that cannot fit. Decompose future work rather
than silently run for hours; no Linux/VM campaign is introduced.

Failures keep distinct classifications: product defect, environment blocker,
host interruption, contract blocker and incomplete evidence. Preserve the
first failing attempt's inputs/hashes/commands/logs within engineering bounds;
diagnose before rerun, record the change and reason, and allocate a new attempt
directory. Never overwrite FAIL with PASS, discard valid observations silently,
reinterpret host sleep/crash as SDK failure, or claim a retry validates the
earlier bytes. Reuse valid immutable evidence only for unchanged relevant bytes,
scope and environment with explicit binding. A contract blocker requires
reviewed authority/correction, not an implementation workaround that weakens
security or support claims.

## 23. Conformance and release binding

Future inventory is
`repositories/cca-conformance/mo1306-conformance-inventory.json`, kind
`MemoryOSCICDConformanceInventory`, version `1.0.0`. It contains exactly
`kind`, `version`, `contract`, `implementation`, `categories`, `providers`,
`platforms`, `artifacts`, `receipts`, `exclusions`, `releaseState`.
`contract` is `{authorityRevision,freezeRevision,contractDigest}`;
`implementation` is `{revision,distributionDigest,runtimeClosureDigest}`;
category rows are `{id,status,requiredCaseIds,receiptIds}`; provider/platform
rows `{id,status,scope,receiptIds}`; artifacts `{path,byteLength,sha256}`;
receipts `{id,path,sha256}`; exclusions are the explicit frozen scope strings.
`releaseState` is `IN_PROGRESS`, `BLOCKED`, or `READY_TO_TAG`. All arrays have
unique IDs/paths and deterministic order; no unsupported fields or wildcard
evidence references. Category/provider/platform status is `PENDING`, `PASS`,
`FAIL`, `NOT_EXECUTED`, `ENVIRONMENT_BLOCKED`, or the exact successful provider
label in section 20 where applicable, with valid status/type constraints.

Receipt kind `MemoryOSCICDConformanceReceipt`, version `1.0.0`, contains exactly
`kind`, `version`, `id`, `implementationRevision`, `harnessRevision`,
`contractDigest`, `distributionDigest`, `runtimeClosureDigest`, `scope`,
`environment`, `cases`, `artifacts`, `reusedEvidence`, `limitations`, `status`.
`scope` is `{provider,platform,validationMode}`, mode `REAL_EXECUTION`,
`HOSTED_EXECUTION`, `CONTRACT_VALIDATION`, `PACKAGE`, `SUPPLY_CHAIN`, or `BINDING`.
`environment` is `{os,osBuild,architecture,nodeVersion,nodeSha256,hostedRun}`;
`hostedRun` null or `{repository,revision,runId,attempt,jobIds}` with verified
actual service association. Case rows are `{id,status,command,exitCode,
elapsedMs,evidencePaths}`; statuses `PASS`, `FAIL`, `NOT_EXECUTED`,
`HOST_INTERRUPTED`, `ENVIRONMENT_BLOCKED`. Command is a redacted argv array,
not executable receipt content. Receipt status `PASS`, `FAIL`, `INCOMPLETE`;
artifact rows match the inventory; reuse rows `{receiptId,sha256,reason,
unchangedArtifactDigests}`. Engineering prose strings are bounded to 4096
characters each, arrays to 4096 entries and any engineering JSON record to
2 MiB; product evidence uses the much smaller section 9 limits.

Phase 1 materializes these closed schemas and cross-field validators. Case ID
enumeration, engineering helper filenames and actual future measured/committed
identities are safe deferred details; architecture/status/binding rules are not.
No final receipts or placeholder PASS are created in Freeze.

Require an acyclic dependency graph: implementation commit/archive/member
identities first, executed harness+attempt evidence second, receipts next,
inventory/binding last. Every revision must exist; receipts bind the exact
executed bytes and the committed harness that actually produced them. If a
harness ran uncommitted, retain its exact hash and establish an explicit
subsequent matching-byte binding; never lie about its execution-time revision.
A binding commit cannot include its own future hash. Archive/manifests/receipts
must not form self-hash cycles; final binding references parents and already
existing evidence, and a later annotated tag supplies release identity only
when separately authorized. Preserve MO-1301–MO-1305 snapshots unchanged.

Negative validators must reject missing/extra artifacts, hash/length drift,
wrong revisions/runtime/contract, forged PASS, omitted required cases,
unexecuted platform/provider relabeling, stale run/attempt association, mismatched
projection, incomplete marker, duplicate IDs, unresolved or cyclic references,
wrong reuse claims, and a release-ready inventory with unmet real Windows or
undisposed GitHub requirements. Bind provider-generated file/template/schema/
validator/generator identities as well as product code. A parser-only receipt
cannot satisfy a complete CONTRACT_VALIDATED provider category.

## 24. A–AF decision closure

All 32 entries are **RESOLVED BY CONTRACT FREEZE 1**. `Authority §N` below
refers to the [roadmap authority](mo1306-provider-neutral-cicd.md), not new
provider semantics. Section references without that prefix are this document.
The last column lists only safe deferred implementation details; none permits
an implementation-critical decision to remain OPEN.

| ID | Authority source | Chosen value / reason | Security implications | Testing implications | Safe deferred detail |
|---|---|---|---|---|---|
| A | Authority §§4–7; MO-1301; CLI acquisition | SDK 1.1 in fresh child, Regression included (§§2,5); smallest offline surface | No network service or alternate semantics | SDK/CLI exact-byte parity | Internal helper organization |
| B | Authority §4 | One shared core and closed invocation (§6); prevent provider drift | Adapters cannot mint authority | Cross-provider equivalence | Private nonboundary helpers |
| C | Authority §§3–4 | First-class Windows executable, fixed argv/config/result (§§4–14) | Explicit capabilities and bounded lifetime | Real installed Windows process | Test fixture names |
| D | Authority §§4–5; MO-1302 | New neutral Actions workflow, preserve released gate (§16.5) | No privileged fork workflow or check spoof | Unchanged MO-1302 plus new hosted scope | Actual later reviewed tool revision |
| E | Authority §§2–4,11 | Generated GitLab manual Windows job (§16.2) | Protected bootstrap; no secrets/extra script | Official schema, subset, local equivalence | Golden fixture storage names |
| F | Authority §§2–4,11 | Restricted Declarative Jenkins AST (§16.3) | No Groovy from data or plugin install | Independent parser and launcher parity | Parser function organization |
| G | Authority §§2–4,11 | Generated manual Azure Windows job (§16.4) | No service connection/expression expansion | Official schema/subset/equivalence | Golden fixture storage names |
| H | Authority §10 | Pure deterministic generation, closed deployment (§15) | Exclusive new outputs, no overwrite/code slots | Goldens/idempotency/negatives | Private renderer functions |
| I | Authority §6 | One closed common JSON plus deployment-only data (§§4,15) | No env overrides or config-selected code | Defaults/duplicates/pins/versions | Schema formatting only |
| J | Authority §7; MO-1301 | Explicit Policy/Set and MIP files, SDK Regression (§5) | No detached context/URL/stdin authority | Acquisition and owner-bound negatives | Fixture content selection within catalog |
| K | Authority §§6–7,10 | Exact semantic bytes plus operational result/bundle (§§8–10) | No raw inputs/secrets in output | Exact bytes/caps/manifest verification | Fixed human catalog wording |
| L | Authority §6; CLI/MO-1302 | Uniform 0/6/7 and 10–17 exits (§8) | Operational errors never fabricate CNE | Every row and provider conclusion | None |
| M | Authority §7 | Full 14-field classification and env allowlist (§7) | No semantic metadata or supplied URLs | Metadata invariance/poisoning | None |
| N | Authority §7 | Preserve SDK bytes, separate J/operational IDs (§§3,9) | No volatile semantic identity contamination | Exact-byte permutation checks | None |
| O | Authority §8 | Explicit local roots, no reparse/ADS/UNC, owned output (§11) | Fail-closed snapshots; trusted-host race scope explicit | Native Windows path/swap/cleanup probes | Helper internals within fixed protocol |
| P | Authority §8; architecture | Zero semantic/offline network, narrow GitHub bootstrap (§12) | No arbitrary fetch/token exposure | Denial routes/import audit/offline runs | Test observation tooling |
| Q | Authority §8 | No product secrets, fresh child environment (§12) | Noncollection and allowlisted diagnostics | Synthetic sentinel/leak negatives | None |
| R | Authority §8 | Trusted tools/config, hostile checkout is data (§12) | Reject elevated/fork-selected executable workflows | Malicious data/config/template tests | Safe hostile fixture names |
| S | Authority §9 | Direct argv supervisor/one active child plus owned Windows console host, fixed PS boundary (§13) | No shell service, no other descendants | Windows quoting/flags/environment/exit tests | Private process wrapper internals |
| T | Authority §9 | One evaluation, no queue/retry/cache, unique run, marker commit (§13) | Late output suppressed; no stale publication | Cancel/timeout/parallel/marker races | Random UUID implementation via built-in crypto |
| U | Authority §§9,13 | Frozen byte/time/heap caps, bounded RSS review (§14) | Early bounded reads, no limitless campaigns | Cap boundaries + selected measurement | Final observed RSS ceiling at B1, <=768 MiB |
| V | Authority §10 | Bounded schema-bound per-run evidence (§9) | Operational hashes do not grant semantic authority | Digest/cross-link/negative verification | Actual runtime OS build value |
| W | Authority §10 | Local six/four-file bundle, GitHub upload only (§9) | Marker/cardinality/ownership, no history store | Partial/extra/wrong-run/publication tests | Actual artifact service IDs |
| X | Authority §§6–7 | JSON summary/logs, no annotations (§10) | No provider command/secret interpolation | Control/truncation/leak tests | Fixed diagnostic prose |
| Y | Authority §12 | One private memoryos-ci 0.1.0 offline tgz (§19) | Explicit trusted closure, no install hooks | Reproducible pack/offline installed tests | Extra inventoried internal module names |
| Z | Authority §12 | Pinned Node/npm/Actions, engineering schema/parsers (§§17,19) | Fresh reachable-risk review, no provider SDK | Hash/license/provenance/offline checks | Exact transitive engineering wheel lock at Phase 1 |
| AA | Authority §§2,9 | Native Windows 11 x64 + distinct hosted Windows (§20) | No local VM/OS/account provisioning | Actual scoped OS/build/runtime receipts | Actual host build observations |
| AB | Authority §§3,11 | Bounded required-when-feasible hosted campaign (§21) | Existing access, no paid/privileged substitute | Actual job/artifact conclusions, honest blockers | Existing service run IDs and safe branch name |
| AC | Authority §§2–3,11 | GitLab/Jenkins/Azure strong offline CONTRACT_VALIDATED (§17) | No live credentials/infrastructure prerequisite | All six layers; no simulated live PASS | Local corpus case names |
| AD | Authority §13; methodology correction | Cheap-first catalog and 20/60/90 budgets (§§14,21–22) | Stop/checkpoint; no uncontrolled campaign | Timed categories and diagnosed reruns | Scheduling of independent categories |
| AE | Authority §11 | Closed inventory/receipts, exact scope, acyclic binding (§23) | Reject forged/missing/changed evidence | Negative graph/revision/claim validators | Individual case IDs and later actual hashes |
| AF | Authority §12 | Separate package/contract/schema/adapter versions (§3) | No silent compatibility fallback | Unsupported-version and identity-drift tests | None |

## 25. Contradiction audit and preservation

The tracked repository audit searched `MO-1306`, `CI/CD`, `provider-neutral`,
`GitLab`, `Jenkins`, `Azure DevOps`, `GitHub Actions`, `generic runner`,
`release readiness`, `Investigation History`, `Cloud Dashboard`, plus invocation,
platform and certification terms in the focused authority chain. Disposition:

| Finding | Classification and resolution |
|---|---|
| ROADMAP MO-1306 authorized/Freeze-next text, open invocation/package/file decisions and exact next task | Current prospective state; update to this freeze and Phase 1 next. Do not mark implementation complete. |
| Prior `docs/mo1306-provider-neutral-cicd.md` candidate designs, OPEN register and then-next task | Historical authorization stage; constraints still apply and section 24 now closes mechanisms. Preserve the authority commit/document; ROADMAP and this later freeze identify current state. |
| MO-1302 gate's Ubuntu/reusable Action/required check, artifact acquisition and CLI exits | Released separate integration, not new neutral runner. Keep exact files/receipts/pins/check unchanged; add a separate Windows workflow contract. |
| MO-1304 Ubuntu+Windows certification and MO-1303 hosted matrix/macOS exception | Historical actual scopes; no inherited platform obligations or rewritten PASS. |
| MO-1305 original platform/invocation/resource plans and later corrections/release metadata | Released REST scope. SDK closure may be reused byte-for-byte, while transport, deadlines, Regression and evidence remain this standalone contract. No REST expansion or inherited long campaign. |
| Existing CLI/SDK CI mentions and generic orchestration plans | Existing clients or historical plans, not authorization for a workflow engine, arbitrary command execution, or new semantic acquisition. |
| Policy/guide wording about release readiness, Core history and provider independence | Existing semantic foundation; no reassignment of MO-1307 governance, MO-1308 durable product history or MO-1309 cloud. |
| Inventories/tests exclude MO-1306/MO-1307; predecessor receipts show READY_TO_TAG | Immutable historical scope/snapshots; the actual tags establish subsequent releases. Preserve, do not relabel the old integrations neutral. |
| Upstream npm `gitlab.js`, provider publisher strings, media/demo examples | Dependency/test/example data, not MemoryOS GitLab implementation or live certification. |

No remaining current authority conflict was found. The different evidence labels,
GitHub conditional infrastructure disposition, local VM exclusion and hosted
Windows scope are explicit here; no unexecuted provider receives PASS. All
current changes are confined to this contract and ROADMAP. No small executable
probe/schema file was needed: embedded schema definitions and the complete JSON
error catalog make decisions reviewable without starting production work.

## 26. Freeze validation and next task

Required closeout: complete document/link and full-diff review, A–AF and
closed-contract coverage checks, `tools/verify_workspace.py --root .`, and
`git diff --check`. Commit exactly once with subject
`docs(memoryos-1.3): freeze MO-1306 CI/CD contract`, parent
`33c0612e9ed03d714568354d2d7b2545344f95c1`. No amend, push, tag, production
adapter, provider definition, dependency installation, implementation branch or
worktree, certification receipt, or Phase 1 work belongs to this task.

Exact next task:

**MEMORYOS 1.3 MO-1306 PROVIDER-NEUTRAL CI/CD INTEGRATION PHASE 1 IMPLEMENTATION**

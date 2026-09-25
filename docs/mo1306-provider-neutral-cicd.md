# MemoryOS 1.3 MO-1306 — Provider-Neutral CI/CD Integration

## 1. Authority, status and baseline

Status: **AUTHORIZED / CONTRACT FREEZE 1 NEXT**.

This owner-authorized roadmap specification establishes MO-1306 v1 scope and
binding constraints for Contract Freeze 1 and every later implementation,
testing, certification and release phase. It is linked from the current
[ROADMAP](../ROADMAP.md). It authorizes a provider-neutral CI/CD integration
layer for authoritative MemoryOS policy evaluation and policy gating.
Provider integrations consume the same semantic capabilities; they do not
become independent MemoryOS semantic implementations.

The reviewed baseline is clean `main` in
`C:\Users\melsa\Documents\Codex\cca-workspace`, HEAD
`5955af062152a84c10de17860ba0bcabe8b3555f`, subject
`conformance(memoryos-1.3): close MO-1305 REST Gateway certification`, parent
`292490e386f205d68eb3a4ea942cf1bb297c56cd`. Local and remote annotated tag
`memoryos-1.3-mo1305` have object
`741e596454cfbcc908b8bd576b4fa97311139083` and peel exactly to that HEAD.
The remote check used read-only `git ls-remote`; it did not fetch or move refs.

| Milestone | Current roadmap state |
|---|---|
| MO-1301 Policy / Core Foundation | CLOSED / RELEASED |
| MO-1302 GitHub Policy Gate | CLOSED / RELEASED |
| MO-1303 VS Code Extension | CLOSED / RELEASED, with its existing external-infrastructure exception |
| MO-1304 MCP Server and Agent Integration | CLOSED / CERTIFIED / RELEASED |
| MO-1305 REST Gateway | CLOSED / CERTIFIED / RELEASED |
| MO-1306 Provider-Neutral CI/CD Integration | AUTHORIZED / CONTRACT FREEZE 1 NEXT |
| MO-1307 Release Policies / Release Readiness | PLANNED / AUTHORITY PENDING |
| MO-1308 Investigation History | PLANNED / AUTHORITY PENDING |
| MO-1309 Cloud Dashboard | PLANNED / AUTHORITY PENDING |

MO-1306 was next in sequence with authority pending before this authorization;
the old roadmap still labeled it PLANNED and MO-1305 PHASE 1 NEXT. This change
reconciles current status without renumbering or rewriting released history.

This task is documentation/authority only. It creates no production code,
adapter, CI configuration file, dependency, package, inventory, certification
receipt or other implementation artifact. No push or tag is authorized.
Candidate designs below are questions for Freeze, not frozen APIs. Existing
[architecture](../ARCHITECTURE.md) and released semantic contracts retain
their authority. Freeze must settle the bounded integration architecture
before implementation relies on it; foundation exclusions are not silently
removed from predecessor components.

## 2. Hard environment and cost constraints

MO-1306 v1 MUST be implementable, testable, certifiable and releasable without:

- Linux, Ubuntu or WSL;
- VirtualBox, VMware, Hyper-V VM, an additional Windows VM or any other VM;
- a GitLab account, subscription, paid resources, hosted pipeline or runner;
- a Jenkins server, installation, account, plugin installation, self-hosted
  infrastructure or any other Jenkins infrastructure;
- an Azure account or subscription, Azure DevOps account, subscription or
  organization, Azure Pipelines hosted execution, or paid Azure resources;
- any paid external CI/CD infrastructure or paid CI subscription.

These are binding constraints throughout v1, including later phases. No phase
may introduce such a prerequisite, require the user to create or administer
it, or be marked BLOCKED because it is unavailable. Optional access cannot
become a hidden release gate. Missing live-provider access does not excuse
missing adapter implementation or local contract validation.

Available real environments are native Windows 11 x64, GitHub, GitHub Actions,
local deterministic/provider-compatible validation, and generic local runner
and process execution on Windows. GitHub Actions may supply the real hosted
CI/CD witness. No additional paid service is a release prerequisite.

## 3. Support terminology and provider matrix

Use these terms separately in implementation and release documentation:

- **IMPLEMENTED ADAPTER**: actual usable adapter/configuration artifacts exist
  for a declared scope. A plan or example in this authority is insufficient.
- **CONTRACT-VALIDATED ADAPTER**: those exact artifacts passed the declared
  deterministic local contract, structural, fixture and security checks.
  Parsing alone is insufficient; state what behavior was and was not validated.
- **LIVE-PROVIDER CERTIFIED ADAPTER**: the declared integration actually ran
  on the named provider, with validated execution evidence bound to its tested
  artifact, configuration and environment. Local fixtures or generic-runner
  equivalence do not establish this claim.

The following is the required future support scope, not a present PASS claim.
No MO-1306 adapter is implemented or certified by this document.

| Target | Required deliverable | Required validation / real witness | Live-provider status for v1 |
|---|---|---|---|
| Generic CI/CD runner | First-class executable provider-neutral configuration/invocation contract | Deterministic contracts and **real native Windows execution required** | Local process execution must actually run; it is not hosted-provider certification |
| GitHub Actions | Integration compatible with released MO-1302 behavior | Contract/compatibility/security checks; **real hosted execution allowed/expected where appropriate**, with scope fixed in Freeze | May be LIVE-PROVIDER CERTIFIED only for actual validated hosted execution |
| GitLab CI/CD | Actual usable adapter/configuration artifact | Implementation and deterministic local configuration/contract validation required | Live GitLab execution NOT REQUIRED; no live certification claim without execution |
| Jenkins | Actual usable adapter/Jenkinsfile artifact | Implementation and deterministic contracts; generic-runner equivalence where mechanically possible | Live Jenkins execution NOT REQUIRED; no live certification claim without execution |
| Azure DevOps Pipelines | Actual usable adapter/configuration artifact | Implementation and deterministic local configuration/contract validation required | Live Azure execution NOT REQUIRED; no live certification claim without execution |

GitLab, Jenkins and Azure support must not be documentation-only. Candidate
outputs are `.gitlab-ci.yml`, `Jenkinsfile`, `azure-pipelines.yml`, or generated
equivalents. Exact filenames and generation architecture remain Freeze
decisions; none of those files is created now. Optional later free automated
GitLab access may add a separately scoped witness, never a release blocker.
The same evidence honesty applies to optional Jenkins or Azure access.

## 4. Architecture and provider responsibilities

The required conceptual direction is:

```text
MemoryOS semantic authority
  |
Provider-Neutral CI/CD Core
  +-- Generic Runner
  +-- GitHub Actions
  +-- GitLab Adapter
  +-- Jenkins Adapter
  +-- Azure DevOps Adapter
```

The CI/CD core owns common integration behavior and delegates semantic work
to existing authority. Provider adapters project provider configuration,
execution context and presentation through that shared contract. Avoid four
unrelated duplicated integrations and provider-specific copies of evaluation
logic. Exact package/module boundaries, language/runtime, invocation mechanism
and shared internal representation remain open for Freeze.

The generic runner is a first-class executable product surface independent
of hosted-provider availability, certifiable on native Windows. Freeze must
decide its input contract, configuration, semantic invocation, result
projection, exit codes, evidence, artifacts, timeouts, cancellation, filesystem
boundary and network boundary. A template with no executable local path does
not satisfy the generic-runner objective.

For GitHub Actions, Freeze must choose and justify wrapping/reusing MO-1302,
adding a provider-neutral compatibility layer, or supplying a new adapter
that preserves released MO-1302 behavior. Preserve its existing evidence and
GitHub-specific contract; do not retroactively relabel it provider-neutral.
Its historical Ubuntu and multi-platform workflows remain released history,
not new MO-1306 Linux/Ubuntu certification obligations. Freeze must reconcile
the chosen compatibility approach and hosted witness with the hard constraints
above; it cannot import an excluded platform prerequisite through reuse.

GitLab must receive usable configuration plus deterministic contract tests
without a GitLab account, subscription, hosted pipeline or runner. Jenkins
must receive a usable adapter/Jenkinsfile artifact without installation,
server, account, plugins or infrastructure, with generic-runner equivalence
where mechanically possible. Azure DevOps Pipelines must receive usable
configuration plus deterministic contract tests without an Azure account,
subscription, DevOps organization or hosted pipeline. These requirements
authorize future adapter work after Freeze; they do not select a generator now.

## 5. Released authority and later milestone boundaries

| Milestone | Binding preservation / boundary |
|---|---|
| MO-1301 | Preserve [Policy authority](investigation-policies.md): Policy, Policy Set, contexts and owner-bound acquisition, canonical bytes, digests, Evaluation Identity, Policy Outcome Identity, PASS/FAIL/COULD_NOT_EVALUATE, Regression authority, SDK, CLI and semantic limits. CI/CD is a consumer. |
| MO-1302 | Preserve the released [GitHub Policy Gate](../repositories/cca-conformance/docs/mo1302-github-policy-gate.md), its Action/workflow behavior, status distinctions, distribution, pins, evidence, contracts and release history. No silent alteration or evidence invalidation. |
| MO-1303 | Preserve the [VS Code contract](../repositories/memoryos-vscode/README.md), VSIX, trust model, runtime and limits. No extension expansion. Its Ubuntu/Windows hosted PASS, macOS NOT EXECUTED and three-platform parity NOT EXECUTED remain the explicit exception release. |
| MO-1304 | Preserve [MCP authority](mo1304-mcp-server-agent-integration.md), [cache correction](mo1304-contract-freeze-1-cache-correction.md), [Windows support correction](mo1304-contract-freeze-windows-support-correction.md), frozen six-tool protocol and package, and [certification/parity](../repositories/cca-conformance/docs/mo1304-phase3-windows-certification.md). No MCP expansion; MCP is not automatically the CI semantic transport. |
| MO-1305 | Preserve [REST authority](mo1305-rest-gateway.md), [freeze](mo1305-contract-freeze-1.md), its platform/methodology/metadata corrections, and [Phase 3D release](mo1305-phase3d-release.md). No REST redesign. REST is not mandatory for adapters; semantic invocation is a Freeze decision. |
| MO-1307 | Owns Release Policies, Release Readiness and higher-level release governance. MO-1306 may gate jobs using existing outcomes, but may not invent governance semantics or a release-decision engine. |
| MO-1308 | Owns durable Investigation History. MO-1306 may produce bounded per-run evidence/artifacts, not an investigation database, durable history store or historical query service. Existing Core transition-history semantics remain unchanged. |
| MO-1309 | Owns Cloud Dashboard. No dashboard, SaaS, billing, accounts, multi-tenancy or cloud control plane belongs to MO-1306. |

Preserve `documentDigest`, `semanticDigest`, `evaluationIdentityDigest` and
`outcomeDigest`, exact evaluator-produced bytes, rule/registry/resource
identities and stable semantic errors. No provider metadata, detached context,
valid digest or CI credential can mint Core/Regression authority. Existing
SDK/CLI contracts and version identities are not changed by a new integration.
The MO-1301 [conformance guide](../repositories/cca-conformance/docs/mo1301-conformance.md),
MO-1302 [handoff](../repositories/cca-conformance/docs/mo1302-handoff.md) and
[engineering record](../repositories/cca-conformance/docs/mo1302-engineering-conformance.md)
retain their historical phase wording and exact contract boundaries.

## 6. Semantic results, status projection and configuration

Keep five concepts distinct: MemoryOS semantic result, adapter result, process
exit result, CI job result, and provider presentation. CI metadata is not
MemoryOS semantic authority, and a provider job status is not a Policy outcome.
An adapter/configuration/invocation failure must not fabricate FAIL or
COULD_NOT_EVALUATE. Completed semantic decisions retain their exact meaning.

Freeze must define the mapping of PASS, FAIL, COULD_NOT_EVALUATE, configuration
failure, adapter failure and semantic invocation failure to process exit code,
CI job result, machine-readable output and provider annotation/summary.
Preserve released CLI exits and MO-1302 behavior; no new numeric mapping is
selected by this roadmap. Human diagnostic prose cannot become decision
authority, and provider presentation cannot alter normative evidence.

Freeze must decide the shared configuration schema, provider-extension schema,
configuration version, precedence, environment variables versus file input,
unknown-field behavior, defaults and secret references. Common decisions must
remain consistent across providers; extension mechanisms must not create
configuration drift or provider-specific Policy semantics.

## 7. Inputs, outputs, metadata and determinism

Freeze must select handling or explicit exclusion for Policy, Policy Set,
Regression, context, repository files, workspace files, environment variables,
stdin, provider metadata and artifacts. A candidate input category does not
grant arbitrary filesystem access, reconstruct context authority or enable
untrusted Regression injection. Acquisition must use existing authoritative
capabilities and preserve their validation and ownership requirements.

Candidate outputs are machine-readable result, stdout/stderr, exit code,
CI summary, annotations and artifact/evidence files. Freeze must define exact
shapes, encoding, bounds, verification and publication behavior. Normative
MemoryOS bytes remain exact; transport and presentation must not reserialize
them into alternate semantic artifacts.

Candidate normalized metadata is provider, repository, revision, ref,
pipeline/run ID, job ID, attempt, event, actor, and merge/pull request identity.
Freeze must classify **each** as semantic, operational, diagnostic or forbidden,
with justification under existing authority. Classification cannot authorize
new semantic inputs. Volatile provider metadata is not automatically included
in normative identities. Timestamps, temporary paths, runner hostnames, job IDs,
attempt IDs and URLs must not accidentally change semantic bytes or identities.
Tests must vary such metadata independently of fixed semantic inputs and
compare exact normative bytes/digests, not only parsed object equality.

## 8. Security, filesystem, network and secrets

Freeze must define workspace root selection, path normalization, parent
traversal, absolute paths, symlink/junction handling, input/output/temp paths,
race defenses and cleanup. Review Windows drive/UNC/device paths, reparse
points, case collisions and alternate streams where applicable. A provider
workspace or repository checkout is not an unrestricted filesystem grant.

Decide whether adapters require network and, if so, its exact purpose and
boundary. Semantic execution must not gain arbitrary network authority from
the CI environment. Provider transport and semantic execution are separate
concerns. GitLab/Jenkins/Azure contract validation must work without connecting
to their live services. No arbitrary URL fetcher, proxy or remote semantic
executable follows from CI integration.

Define secret sources, minimum exposure, redaction, child-process inheritance,
logging, cleanup, and fork/untrusted behavior. Retained artifacts, diagnostics
and summaries must not leak secrets; secrets must not enter normative identities.
There is no MemoryOS secret-management service in this milestone.

Threat analysis must cover forks, pull requests, merge requests, malicious
repository contents and pipeline definitions, command/argument injection,
provider-expression injection and secret exfiltration. Freeze must define
trusted configuration and executable selection, least privilege and safe
untrusted-workflow behavior. GitHub real certification should include relevant
untrusted-workflow security where safely testable, without exposing real
credentials. Local injection/quoting/negative witnesses remain mandatory for
the adapters that have no live provider certification.

## 9. Processes, platforms, concurrency and resources

Freeze decides direct process invocation, shell usage or exclusion, argument
encoding, exit propagation, timeouts, cancellation and Windows process behavior.
Do not assume POSIX shell semantics or make a POSIX shell a prerequisite.
The product is a bounded MemoryOS integration, not an arbitrary shell service.

MO-1306 v1 implementation and release certification use **Windows 11 x64**.
The generic runner must execute on native Windows. GitHub-hosted Actions may
provide a hosted CI witness according to existing GitHub support and the hard
constraints. There is **no Linux/Ubuntu/WSL/VM certification requirement** and
no automatic inheritance of a predecessor OS matrix. Provider files may target
other runner operating systems; untested OS-specific execution must not be
claimed. Future receipts must distinguish supported scope from actual tested
OS, release/build, architecture and runtime identities.

Freeze must decide parallel jobs, retries, duplicate attempts, cancellation,
superseded runs, timeouts, stale-result publication, artifact races and cleanup.
Define ownership and the publication boundary so one run/attempt cannot publish
another's result. Provider retries do not create new semantic authority.

Preserve all MemoryOS semantic limits. Define adapter-specific limits separately
where needed, including input/config/output size, logs, artifacts, temporary
storage, processes, concurrency and deadlines. Do not blindly inherit REST or
MCP limits. Freeze must specify boundary tests and resolution gates for any
measurement-dependent limits; no numeric budgets are invented here.

## 10. Evidence, artifacts and provider-file generation

Candidate per-run evidence includes semantic result, adapter identity,
configuration identity, provider identity, normalized metadata, runtime identity,
result projection, artifact identity and diagnostics. Freeze must define their
schemas, integrity, bounds and normative versus diagnostic classification.
Operational evidence must not become an alternative MemoryOS outcome identity.
There is no durable investigation/history service.

Decide result-artifact format, integrity, size, provider upload behavior,
local fallback and retention assumptions. Cross-verify required bytes and
identities before accepting a generation; define partial-write/upload and
failure behavior. Provider retention is not a MemoryOS retention guarantee.

Freeze must choose static templates, deterministic generation, common
configuration, packaged examples, or a justified combination for GitLab,
Jenkins, Azure, the generic runner and GitHub compatibility/integration.
Whichever design is chosen must produce usable files and permit meaningful
local validation without live paid services. Filenames, generation APIs,
internal representation and generation version remain open.

## 11. Offline validation and real certification

Strong local validation is required for GitLab/Jenkins/Azure. Freeze must
define applicable checks and explicit limits of proof, using:

- syntax parsing and complete authoritative schemas where available;
- a closed internal representation and deterministic generation;
- golden and negative fixtures, injection and quoting tests;
- round-trip tests where meaningful;
- semantic-equivalence tests against the generic runner where mechanically
  possible, preserving independent MemoryOS authority as the semantic oracle;
- conformance to provider documentation/specifications where mechanically
  possible, with pinned reviewed source/version and coverage limits.

A parser PASS is not proof of all provider behavior. Where a local validator
cannot model a provider facility, Freeze must bound the supported contract and
record the limitation. Do not substitute regex-only or self-agreeing generation
checks for complete structural validation when authoritative schemas exist.
Provider-specific hosted scheduling, service APIs, credentials and UI effects
remain unexecuted unless actual live evidence is available.

Real native Windows generic-runner execution is required. Real GitHub Actions
execution is allowed/expected where appropriate; Freeze must settle its exact
hosted scope, required cases, security witnesses and release gates. Live GitLab,
Jenkins and Azure execution is NOT REQUIRED. Their absence cannot block release.
Release documentation must state adapter implementation, contract validation,
actual live-provider certification and untested OS/provider behavior separately.
No simulated or unexecuted provider may receive a live-provider PASS.

Future conformance must bind the tested adapter/configuration/runtime/artifact
identities to real results, distinguish immutable reused evidence from fresh
execution, reject incomplete or fabricated PASS, and preserve predecessor
receipts. Freeze must decide inventory/receipt schemas, negative validators,
semantic and provider-equivalence matrices, implementation/binding phases and
release review. Bind only existing revisions and exact executed bytes without
self-hashes or invented future commits. No such evidence is created now.

## 12. Distribution, versioning and supply chain

Packaging remains open: a provider-neutral package, provider adapters,
templates, CLI, generated configurations, or a justified combination. Freeze
must decide installation, runtime closure, reproducibility, integrity and
offline behavior, while avoiding unnecessary dependencies. Select product,
configuration, adapter/generator and evidence contract versions independently
from existing MemoryOS semantic identities. Define compatibility, evolution,
deprecation and unsupported-version handling; no exact package version is
assigned by this authority.

Future certification must cover Node/runtime if selected, the actual npm graph,
GitHub Actions used, provider templates/adapters, downloaders if any, lockfiles,
checksums and provenance. Distinguish shipped, engineering and runtime supply
chains; review actual versions, dependency closure, scripts, notices and dated
advisory dispositions. Zero dependencies does not imply zero risk. Released
MCP/REST supply-chain dispositions cannot automatically certify this integration.

## 13. Testing efficiency and future parallel development

Apply the MO-1305 lessons as binding engineering direction: run cheap complete
structural validators FIRST; focused tests before expensive execution; diagnose
failures before rerunning; use bounded retries; and reuse valid immutable
evidence only with unchanged relevant bytes/behavior and explicit binding.
Do not repeat multi-hour campaigns without evidence-based justification.
Keep functional coverage, semantic parity, resource characterization, boundary
enforcement and sustained stress distinct. A missing required witness remains
missing; efficiency cannot be used to infer PASS.

The prospective execution-budget policy in the
[MO-1305 methodology correction](mo1305-contract-freeze-1-verification-methodology-correction.md)
remains applicable to later implementation/conformance tasks: target at most
60 minutes, absolute maximum 90 unless the owner expressly authorizes longer
work; measure elapsed time monotonically, checkpoint safely and decompose work
that cannot finish. Do not launch a campaign that cannot fit the remaining
budget. This is process policy, not a product runtime timeout.

After Freeze, independent workstreams should run in parallel where safe, with
explicit shared contracts, non-overlapping ownership and integration gates.
Candidate Phase 2 decomposition is A: core plus generic runner; B: GitLab plus
Jenkins; C: Azure plus GitHub compatibility/security; D: main integration and
conformance. Exact decomposition belongs to post-freeze planning. This task
creates no workstream, checkout, adapter or implementation commitment beyond
the roadmap boundaries above.

## 14. Explicit exclusions

Excluded from MO-1306 v1 are Linux/Ubuntu/WSL certification prerequisites;
VirtualBox/VMware/Hyper-V or any VM requirement; paid CI subscriptions/resources;
live GitLab/Jenkins/Azure certification prerequisites; new MemoryOS semantics;
MO-1307 release-policy/governance semantics; MO-1308 durable history; MO-1309
dashboard/cloud/SaaS; a general workflow engine; general deployment engine;
arbitrary shell execution, filesystem or URL-fetching services; general proxy;
secret manager; artifact registry; provider account management; billing;
multi-tenancy; MCP expansion; VS Code expansion; and REST redesign.

Job gating on existing outcomes and bounded per-run evidence remain in scope.
These capabilities must not expand into the excluded products by naming them
configuration, metadata, orchestration or integration helpers.

## 15. Contract Freeze 1 decision register

Each entry has exactly one status below. A resolved direction does not resolve
the separately listed mechanisms; Freeze must close every implementation-critical
choice, justify exclusions and specify evidence obligations. All open decisions
remain constrained by sections 2–14; an open mechanism is no waiver of authority.

| ID | Decision | Status | Fixed boundary and remaining Freeze work |
|---|---|---|---|
| A | Semantic invocation | OPEN FOR CONTRACT FREEZE | Consume existing authority; select SDK/CLI/other justified existing boundary, acquisition, ownership, integrity and independent parity. REST/MCP not mandatory. |
| B | Provider-neutral core | RESOLVED BY AUTHORITY | One shared integration core, no duplicated semantics; exact modules/packages/internal representation remain for Freeze. |
| C | Generic runner | OPEN FOR CONTRACT FREEZE | First-class executable surface and real Windows execution required; decide inputs/config/invocation/results/exits/evidence/artifacts/timeouts/cancellation/filesystem/network. |
| D | GitHub relationship | OPEN FOR CONTRACT FREEZE | Preserve MO-1302; choose reuse/wrap, compatibility layer or new preserving adapter and compatible hosted witness. |
| E | GitLab adapter | OPEN FOR CONTRACT FREEZE | Usable implementation and local contract validation required; select artifact/interface, with no live account/runner requirement. |
| F | Jenkins adapter | OPEN FOR CONTRACT FREEZE | Usable adapter/Jenkinsfile and contracts required; define equivalence and limits without server/install/plugins. |
| G | Azure adapter | OPEN FOR CONTRACT FREEZE | Usable Pipelines configuration and contracts required; select artifact/interface without account/organization/live pipeline. |
| H | Provider-file generation | OPEN FOR CONTRACT FREEZE | Choose templates/generation/common config/packaged examples; exact filenames and generator contract open. |
| I | Configuration | OPEN FOR CONTRACT FREEZE | Shared/provider schemas, version, precedence, env/file, unknowns, defaults, secret references; prevent drift. |
| J | Inputs | OPEN FOR CONTRACT FREEZE | Select or exclude each section 7 category; explicit acquisition, trust and bounds, no default arbitrary filesystem authority. |
| K | Outputs | OPEN FOR CONTRACT FREEZE | Define machine result, stdout/stderr, exits, summaries, annotations and files with exact normative-byte preservation. |
| L | Status mapping | OPEN FOR CONTRACT FREEZE | Define six result/failure categories to exit/job/machine/presentation; preserve CLI/MO-1302, never fabricate semantic outcomes. |
| M | Provider metadata | OPEN FOR CONTRACT FREEZE | Classify every candidate field semantic/operational/diagnostic/forbidden; no new or volatile normative identity inputs. |
| N | Determinism | RESOLVED BY AUTHORITY | Preserve exact normative bytes/digests; timestamps/paths/hosts/IDs/URLs cannot accidentally change them. Freeze projection details and invariance tests. |
| O | Filesystem | OPEN FOR CONTRACT FREEZE | Root, normalization, traversal/absolute paths, symlink/junctions, inputs/outputs/temp, races and cleanup. |
| P | Network | OPEN FOR CONTRACT FREEZE | Decide required provider transport and semantic boundary; offline provider validation required, no arbitrary authority. |
| Q | Secrets | OPEN FOR CONTRACT FREEZE | Sources/exposure/redaction/inheritance/logs/cleanup/untrusted behavior; no secret-management product. |
| R | Untrusted contributions | OPEN FOR CONTRACT FREEZE | Fork/PR/MR/repository/pipeline threats, exfiltration, injection and safe GitHub witnesses. |
| S | Process/shell | OPEN FOR CONTRACT FREEZE | Direct invocation versus shell, encoding/exits/timeouts/cancellation/Windows behavior; no POSIX assumption. |
| T | Cancellation/concurrency | OPEN FOR CONTRACT FREEZE | Parallelism/retries/duplicates/supersession/timeouts/publication/races/cleanup and ownership. |
| U | Resources | OPEN FOR CONTRACT FREEZE | Preserve semantic limits; choose separate adapter budgets and measurement/boundary gates; no blind REST/MCP inheritance. |
| V | Evidence | OPEN FOR CONTRACT FREEZE | Bounded per-run semantic/adapter/config/provider/runtime/result identities and diagnostics; normative/diagnostic separation. |
| W | Artifacts | OPEN FOR CONTRACT FREEZE | Format/integrity/size/upload/local fallback/retention/failure; no provider-retention guarantee. |
| X | Presentation | OPEN FOR CONTRACT FREEZE | Define bounded escaped summaries/annotations and failure handling; no normative-byte changes or prose-driven semantic decisions. |
| Y | Distribution | OPEN FOR CONTRACT FREEZE | Select packaging, closure/install/reproducibility/integrity/offline model; avoid unnecessary dependencies. |
| Z | Supply chain | OPEN FOR CONTRACT FREEZE | Freeze exact selected runtime/npm/Action/template/adapter/downloader inputs, pins/notices/checksums/provenance and review gates. |
| AA | Windows platform policy | RESOLVED BY HARD CONSTRAINT | Native Windows 11 x64 release/certification; no Linux/Ubuntu/WSL/VM prerequisite; actual tested identity and limitations required. |
| AB | GitHub hosted certification | OPEN FOR CONTRACT FREEZE | Real hosted witness available/expected where appropriate; settle exact scope/gates under hard constraints, no inherited Linux prerequisite. |
| AC | Offline provider validation | RESOLVED BY HARD CONSTRAINT | GitLab/Jenkins/Azure implementation and strong local contracts required; live certification not required. Freeze exact validators, coverage and proof limits. |
| AD | Testing strategy | RESOLVED BY AUTHORITY | Cheap complete structure first, focused before expensive, bounded retries, diagnose before rerun, justified reuse and safe parallel streams; Freeze concrete catalogs. |
| AE | Conformance | OPEN FOR CONTRACT FREEZE | Separate implemented/contract-validated/live-certified claims; decide schemas, inventories, negative validators, real Windows/appropriate GitHub gates and acyclic binding. |
| AF | Versioning | OPEN FOR CONTRACT FREEZE | Product/config/adapter/generator/evidence compatibility and evolution separate from preserved MemoryOS semantic contracts. |

## 16. Contradiction audit and source classification

The baseline repository search covered all eleven requested terms: `MO-1306`,
`CI/CD`, `provider-neutral`, `GitLab`, `Jenkins`, `Azure DevOps`, `GitHub Actions`,
`generic runner`, `release readiness`, `Investigation History`, `Cloud Dashboard`.
The documentation search used ripgrep with ignore rules disabled; the tracked
text audit additionally covered code, examples, tests, JSON inventories and
evidence. Generated/cache/dependency copies are not roadmap authority.

| Findings / paths (relative to repository root) | Classification and disposition |
|---|---|
| `ROADMAP.md` MemoryOS 1.3 overview, post-MO-1304 introduction, MO-1304/1305/1306 rows, MO-1305/1306 sections and next task | Current roadmap authority. Reconcile MO-1305 release against the actual annotated tag and authorize MO-1306. Preserve MO-1307–1309 as prospective. Earlier 1.0/1.2 provider-neutral references describe their own capabilities. |
| `docs/mo1304-mcp-server-agent-integration.md` §§3,16; `docs/mo1305-rest-gateway.md` §§6,8; `docs/mo1305-contract-freeze-1.md` §§1,14 | Released authority and historical plans. CI exclusions constrain MCP/REST, not a separately authorized milestone. The old generic “orchestration” direction does not authorize a workflow/deployment engine. MO-1306 now owns the precise prospective scope here. Preserve historical text, including then-undefined/then-next statuses. |
| `docs/investigation-policies.md`; `repositories/cca-conformance/docs/mo1301-conformance.md`, `mo1302-handoff.md`, `mo1302-github-policy-gate.md`, `mo1302-engineering-conformance.md`; `repositories/memoryos-cli/docs/policy-conformance-report.md` | Released semantic/integration contracts and historical implementation/release plans. MO-1301 excludes GitHub implementation; MO-1302 excludes MO-1306/MO-1307. Both remain valid boundaries. Pending-publication and then-unimplemented language remains historical. |
| `CHANGELOG.md`, `docs/README.md`, predecessor product/repository indexes and frozen package READMEs | Historical product-stage notes and navigation, not new MO-1306 authority. “Release readiness” in the MO-1301 guide title means its certification gate, not the MO-1307 product. Preserve released bytes. Current milestone status is supplied by ROADMAP. |
| `repositories/cca-conformance/mo1302-conformance-inventory.json`; `tests/mo1302_cross_platform_closure_conformance_test.mjs` under that repository | Frozen scope inventory and tests enforcing MO-1302 exclusions. Do not weaken tests or reinterpret MO-1302 as provider-neutral. |
| `repositories/cca-conformance/tools/mo1303-hosted-evidence.mjs` | Test/certification machinery requiring actual GitHub Actions provenance, not MO-1306 provider support. Preserve. |
| `docs/mo1305-phase3c-refresh.md`; `repositories/cca-conformance/tools/mo1305-phase3c-refresh/audit.py`; `evidence/mo1305-phase3c-refresh/closure-matrix.json` under that repository | Historical audit and evidence with then-pending release dependencies. Phase 3D and the actual tag establish later closure without rewriting snapshots. |
| `repositories/cca-conformance/evidence/mo1304-phase3-{ubuntu,windows}/supply-chain-sources.json`; `repositories/memoryos-mcp/measurements/phase2-supply-chain-sources.json` | Historical upstream package/publisher evidence. “GitHub Actions” publisher strings do not establish CI adapter authority or certification. Preserve. |
| `repositories/cca-conformance/evidence/mo1305-phase3d/imported-cache.json` | Certification tooling inventory. npm's `trust/gitlab.js` filename is not a MemoryOS GitLab adapter. Preserve. |
| `repositories/cca-conformance/requirements-manifest.json`, the three `manifests/requirements-manifest-sha256-*.json` snapshots, both `evidence/reference-implementation-1.2.1*.json` matches, and `tools/requirement-selector-catalog.mjs` | Released Standard requirement mappings and historical certification evidence. Core-generated investigation history and provider-independent Core behavior already exist; neither is MO-1308 durable product history nor MO-1306 CI implementation. Preserve. |
| `repositories/cca-studio/tests/investigation_core_test.mjs`; six matched `core-mip.tap` records under MO-1305 Phase 1 auxiliary and Phase 2A/2B/2C evidence | Existing Core boundary tests and their immutable execution logs. “Provider-neutral” means renderer/provider independence of that Core, not CI adapter certification. Preserve. |
| `repositories/cca-core/README.md`, `docs/memory-providers.md`, `include/cca/memory/memory_provider.hpp`; `repositories/cca-studio/web/js/app.js`, `docs/github-screenshot-specification.md`, `docs/memoryos-1.0-launch-demo-production-package.md` | Released implementation contracts, presentation and historical media specifications for Memory Provider handoff. Distinct from CI providers; no change. |
| `repositories/cca-core/examples/memory_reflection_usage.cpp` | Example query prose mentioning release readiness; not a release-governance contract or MO-1307 implementation. Preserve. |

The MO-1301–MO-1305 authority, frozen-contract/correction and release records
were reviewed with their current inventories where needed. MO-1303's exception,
MO-1304's Ubuntu/Windows certification, and MO-1305's Windows-only correction
remain separate historical facts. Original read-only freezes represented by
released contracts/inventories do not imply that an additional standalone
freeze document exists in the repository.

No existing authority selects an MO-1306 invocation API, package layout,
configuration schema, generated filenames, numeric exit mapping or provider
certification result. Current roadmap contradictions are resolved only in
ROADMAP; predecessor contracts, tests, implementation notes and certification
evidence remain unchanged. In particular, pre-tag pending/READY_TO_TAG fields
are historical snapshots, not reasons to revoke verified released tags.

## 17. Exact next task

**MEMORYOS 1.3 MO-1306 PROVIDER-NEUTRAL CI/CD INTEGRATION CONTRACT FREEZE 1**

Freeze must resolve the open register under this authority before implementation
begins. This authority itself supplies no implementation or certification PASS.

# CCA reference workspace roadmap

This roadmap separates implemented increments from proposed work. It does not
authorize behavior beyond [the architecture](ARCHITECTURE.md).

## MemoryOS product releases

| Release | Status | Scope |
|---|---|---|
| MemoryOS 1.0 | Released | Deterministic memory lifecycle, source-preserving knowledge, retrieval, reflection, provider-neutral handoff, and the frozen Memory Studio contract |
| MemoryOS 1.1 | Released — v1.1.0 | Stable Semantic World, Cognitive Trace, Living Connectome, Cognitive Replay, Cognitive Polish, Cognitive Evolution, Comparative Reconstruction, and integrated investigation workflow |
| MemoryOS 1.2 | Released — v1.2.0 | Canonical Memory Investigation Packages, dependency-free AI runtime adapters, one renderer-independent Investigation Core, public SDK facades, the official SDK-backed CLI, deterministic Cognitive Regression Analysis, the Cognitive Investigation Explorer, CCA-MEMORYOS-1.0, and its official Conformance Suite |
| MemoryOS 1.2.1 | Corrective restoration | Restores omitted intended v1.2 source, registered tests, fixtures, examples, documentation, frozen Standard and MIP publication assets, and corrected conformance provenance while preserving all v1.2 semantics and CSP fixes |
| MemoryOS 1.3 | In development; MO-1301 through MO-1304 released | Engineering Operations: Policy / Core Foundation, GitHub Policy Gate, VS Code integration (released with an external-infrastructure exception), and certified MCP Server and Agent Integration; MO-1305 REST Gateway contract frozen, Phase 1 next |

MemoryOS 1.1 is additive. It preserves the MemoryOS 1.0 runtime and public
contracts while moving deterministic investigation into the downstream Studio
presentation. The renderer consumes validated projections; it does not derive
traces, replay order, evolution, or divergence.

The complete milestone map and evidence index are maintained in the
[MemoryOS 1.1 documentation index](repositories/cca-studio/docs/README.md).
Measured performance, scalability, benchmark, UX, accessibility, and
documentation evidence closed MO-1108. Those historical supporting artifacts
are not retained in the v1.2.1 source archive. RC-001 validated the production
workflow, RC-001A completed the documentation freeze, and RC-001B completed the
repository audit without changing the product architecture.

MemoryOS 1.2 delivers MIP-001 and its MO-1201 implementation. MO-1202 adds
provider-neutral interfaces that privately validate OpenAI Agents SDK,
Anthropic SDK, and LangGraph event lifecycles and translate only settled
source-authored cognition into verified, Observation-only MIPs. The reference
adapters do not import provider SDKs, persist transport state, control external
runtimes, or infer cognitive semantics.

MO-1203 establishes the [Investigation Core](repositories/cca-studio/docs/investigation-core.md)
as the single execution authority for create, load, restore, archive, Replay,
comparison, verification, checkpoints, MIP export, and MIP import. State is
always derived from an append-only digest-linked transition log. Studio and
future clients consume immutable projections instead of implementing
investigation behavior.

MO-1204 exposes that authority through the [MemoryOS SDK](repositories/cca-sdk/README.md).
Studio consumes the JavaScript facade; Python and C++ use one versioned private
binding to the same JavaScript Core. The SDK requires explicit snapshots,
Reflection selections, comparison sessions, checkpoints, and packages. It
adds no cognition or package construction behavior, and native export remains
available only for investigations imported from valid MIP artifacts.

MO-1205 implements the [MemoryOS CLI](repositories/memoryos-cli/README.md) as
the first standalone SDK consumer. Human and canonical JSON output, explicit
Trace/Replay/Compare inputs, exact MIP import/export, deterministic exit codes,
and live JSON Lines sessions support local automation and CI without copying
Investigation Core or MIP semantics. Checkpoints remain opaque and confined to
the live CLI session that created them.

MO-1206 introduces [Cognitive Regression Analysis](repositories/cca-sdk/docs/regression-guide.md)
as the first AI engineering workflow built on the completed platform foundation.
One read-only Regression Engine in the Investigation Core compares Replay,
Reflection, Evidence, Retrieval, Evolution, Verification, transition history,
and lifecycle truth. JavaScript, Python, C++, and CLI consumers expose the same
immutable report without heuristics, scoring, explanation, or AI inference.

MO-1207 adds the
[Cognitive Investigation Explorer](repositories/cca-studio/docs/cognitive-investigation-explorer.md).
It navigates exact evidence locations already carried by a validated regression
report and returns immutable, canonically ordered pointers through the same
Core, SDK, CLI, and Studio boundaries. It does not rerun Replay, recompute a
regression, load source cognition, rank evidence, or interpret a difference.

MO-1208 publishes CCA-MEMORYOS-1.0 as the implementation-independent MemoryOS
Standard and activates the
[official conformance suite](repositories/cca-conformance/README.md). The
Standard incorporates the exact CCA-RF-1.0 and CCA-MIP-1.0 baselines and
defines lifecycle, adapter, Core, SDK, CLI, Regression, Explorer,
compatibility, versioning, and certification obligations without changing
platform behavior. MemoryOS 1.2.0 is the initial Reference Implementation, not
the normative source of those obligations.

MemoryOS v1.2.1 is the corrected Reference Implementation baseline. It repairs
the v1.2.0 source and publication inventory without changing the Standard, MIP,
Investigation Core, SDK, CLI, Regression, Explorer, lifecycle, or Studio
semantics. The v1.2.0 commit, tag, manifest, and evidence remain immutable
historical records.

MO-1301 implements closed Policy and Policy Set artifacts, an atomic
PolicyFactContext projection, one registered optional Cognitive Regression fact
source, six first-party rules, deterministic evidence and aggregation, a fixed
Resource Profile, Evaluation Identity, canonical outcomes, SDK/CLI 1.1
integration, and a separate MemoryOS 1.3 conformance inventory. It is additive
over the v1.2.1 compatibility baseline. MO-1302 consumes these artifacts and
stable exit codes as a separate milestone; it was not implemented by MO-1301.

CCA-MEMORYOS-1.1 remains the intended later normative target. Candidate
materialization follows frozen implementation behavior, cross-language parity,
conformance, and independent review; the Standard will codify that behavior
rather than evolve as another Policy semantic authority.

## MemoryOS 1.3: reconciled roadmap after MO-1304

This is the current prospective roadmap, reconciled after the MO-1304 release.
It combines the earlier integration/product and standards/product directions
without renumbering the released milestones. MO-1301 through MO-1304 retain
their existing scope, commits, contracts, conformance history, evidence, and
tags. The remaining product sequence begins with MO-1305; its roadmap authority
is established below, with Contract Freeze 1 complete and Phase 1 next.

| Milestone | Title | Status | Architectural layer |
|---|---|---|---|
| MO-1301 | Policy / Core Foundation | CLOSED / RELEASED | Existing semantic and Policy foundation, including Investigation Policies and SDK/CLI integration |
| MO-1302 | GitHub Actions / GitHub Policy Gate | CLOSED / RELEASED | GitHub-specific CI integration over the existing Policy authority |
| MO-1303 | VS Code Extension | CLOSED / RELEASED WITH EXTERNAL-INFRASTRUCTURE EXCEPTION | VS Code developer integration |
| MO-1304 | MCP Server and Agent Integration | CERTIFIED / RELEASED | MCP / agent integration over existing MemoryOS capabilities |
| MO-1305 | REST Gateway | CONTRACT FROZEN / PHASE 1 NEXT | Bounded REST/API integration |
| MO-1306 | Provider-Neutral CI/CD Integration | PLANNED / AUTHORITY PENDING | Provider-neutral CI/CD integration |
| MO-1307 | Release Policies / Release Readiness | PLANNED / AUTHORITY PENDING | Higher-level release policy and readiness |
| MO-1308 | Investigation History | PLANNED / AUTHORITY PENDING | Durable investigation/evaluation history and traceability |
| MO-1309 | Cloud Dashboard | PLANNED / AUTHORITY PENDING | Cloud-facing dashboard experience |

Later milestones must delegate to existing semantic authority rather than
silently reimplementing MemoryOS semantics. This roadmap assigns high-level
direction only; it neither starts implementation nor freezes future contracts.
Unrelated proposals elsewhere in this document remain proposals.

### Released history and authority

MO-1301 retains the [Policy specification](docs/investigation-policies.md) and
release tag `memoryos-1.3-mo1301`. MO-1302 retains the
[GitHub Policy Gate contract](repositories/cca-conformance/docs/mo1302-github-policy-gate.md)
and release tag `memoryos-1.3-mo1302`. Its GitHub-specific implementation and
history are not reassigned to MO-1306.

MO-1303 is released at
`memoryos-1.3-mo1303`, with final conformance binding
`49aa80fa76bffc03e36335be8ab805bb5dc38f9c`, under an explicit
external-infrastructure exception: Ubuntu and Windows hosted certification
PASS; macOS hosted certification NOT EXECUTED due external GitHub
runner-allocation/billing restriction; three-platform parity NOT EXECUTED.
Strict three-platform validation and predecessor history remain intact.

MO-1304 is certified and released at annotated tag `memoryos-1.3-mo1304`,
targeting final conformance binding
`ce7b001d911239fa50d904f5f336bb1bd7858ba3`. The
[original MCP roadmap authority](docs/mo1304-mcp-server-agent-integration.md),
subsequent frozen contracts and corrections, production implementation,
package, receipts, evidence, and final binding remain unchanged. The
[Windows support correction](docs/mo1304-contract-freeze-windows-support-correction.md)
and [Windows certification and parity record](repositories/cca-conformance/docs/mo1304-phase3-windows-certification.md)
remain released history: Windows 11 x64 support, actual Windows 11 Home 25H2
build 26200.9457 x64 execution, Ubuntu 24.04 LTS x64 certification, and
two-platform parity PASS. Their recorded evidence limits and risk dispositions
remain intact; macOS remains unsupported for MO-1304.

Earlier development-stage status text in the product overview, changelog,
repository indexes, predecessor guides, and frozen MCP package describes the
stage when it was written. The original MO-1304 authority's section 16 records
the then-undefined MO-1305 and the then-next Contract Freeze 1 task. Those
statements, and pre-tag pending fields in inventories and receipts, remain
historical records. This section supplies current milestone status and
prospective assignments without changing their semantic contracts or evidence.
The MO-1302 exclusions of MO-1306/MO-1307 remain valid frozen scope boundaries.

### MO-1305: REST Gateway

Status: **CONTRACT FROZEN / PHASE 1 NEXT**.

The focused authoritative specification is
[MemoryOS 1.3 MO-1305 — REST Gateway](docs/mo1305-rest-gateway.md). It establishes
the objective, delegation and trust boundaries, predecessor preservation,
exclusions, and required Contract Freeze 1 decisions. The implementation contract
is now [Contract Freeze 1](docs/mo1305-contract-freeze-1.md), which resolves all
A–W categories and gates measurement-dependent values. The
[platform correction](docs/mo1305-contract-freeze-1-platform-correction.md)
removes Ubuntu/Linux, VM and cross-platform parity requirements for v1;
independent SDK semantic parity remains required. Phase 1 completion is pending.

Expose selected existing MemoryOS capabilities through a bounded HTTP/API
surface while delegating semantic authority to existing MemoryOS implementation
layers. The frozen v1 contract selects six SDK-backed semantic operations and
three operational endpoints under `/v1`, native TLS over HTTP/1.1, bearer
authentication, explicit remote mode, bounded execution, and a dependency-free
Node adapter. It defines measured resource gates, release-bound OpenAPI,
installed-package certification on the existing physical Windows 11 x64 host only,
and non-self-referential implementation/evidence binding. No production package
or certification evidence has been created by the freeze.

### MO-1306: Provider-Neutral CI/CD Integration

Status: **PLANNED / AUTHORITY PENDING**.

Cover GitLab, Jenkins, Azure DevOps, generic CI/CD environments, and other
provider-neutral integration surfaces mechanically justified by future
authority. Preserve MO-1302's GitHub-specific history and delegate MemoryOS
semantics to the existing authoritative implementation.

### MO-1307: Release Policies / Release Readiness

Status: **PLANNED / AUTHORITY PENDING**.

Own higher-level release-governance policy semantics and release-readiness
composition, subject to future authority and Contract Freeze. This assignment
does not implement or freeze those semantics or replace the existing Policy
foundation.

### MO-1308: Investigation History

Status: **PLANNED / AUTHORITY PENDING**.

Provide durable investigation/evaluation history, traceability, historical
evidence, and query/review surfaces, subject to future authority and Contract
Freeze. Persistence and database architecture remain undecided here; existing
Investigation Core history semantics retain their authority.

### MO-1309: Cloud Dashboard

Status: **PLANNED / AUTHORITY PENDING**.

Provide a cloud-facing product/dashboard experience built on the authoritative
MemoryOS capabilities established by earlier milestones. Cloud provider,
frontend framework, database, multi-tenancy, billing, hosting, authentication,
and deployment architecture remain decisions for future authority and Contract
Freeze.

The exact next task is:

**MEMORYOS 1.3 MO-1305 REST GATEWAY PHASE 1 IMPLEMENTATION**

## IM-001: engineering foundation

Status: complete and retained.

Delivered the workspace layout, C++23/CMake/vcpkg foundation, common logging
and configuration facilities, compiler module seams, test/quality
infrastructure, and reserved repository boundaries.

IM-001 intentionally stopped before compiler semantics. IS-002 supersedes that
placeholder restriction only for the approved Standards Compiler slice.

## IS-002: Canonical Specification and Standards Compiler

Status: implemented in this workspace.

Outcomes:

1. Canonical Specification 1.0 YAML profile and Draft 2020-12 schema.
2. Self-description, semantic versions, metadata, categories, typed objects,
   relationships, dependencies, rules, artifacts, annotations, and extensions.
3. Ordered Load-to-Report pipeline with explicit failure propagation.
4. Typed syntax and internal-model values.
5. Duplicate, reference, relationship, dependency, version, type, and metadata
   validation with structured diagnostics.
6. Deterministic `validate`, `analyze`, `compile`, and `report` CLI commands.
7. Documentation index, dependency graph, specification report, validation
   report, object inventory, architecture summary, and code-placeholder README.
8. Valid and invalid fixtures, automated tests, and a 90% line-coverage target.

IS-002 explicitly excludes Runtime and MemoryOS behavior from the compiler
milestone. That compiler boundary remains in force alongside the separate
IM-003 Runtime Foundation below.

## IM-003: Runtime Foundation

Status: implemented in this workspace.

Outcomes:

1. Headless `cca-runtime` executable and a `RuntimeHost` that owns multiple
   isolated, explicitly identified Runtime instances without a global
   singleton.
2. The complete CCA-RF-1.0 normal lifecycle and the explicit
   `Failed -> Rollback -> Destroyed` failure path.
3. Exactly six Runtime Foundation components: Lifecycle Manager, Service
   Registry, Dependency Injector, Event Bus, Configuration Manager, and
   Observability.
4. Compile-time typed Service Contracts, the `ExactlyOne`, `ZeroOrOne`, and
   `OneOrMore` cardinalities, duplicate detection, composition validation, and
   internal Provider ownership.
5. Constructor injection from a validated, acyclic dependency graph; complete
   dependency levels computed before Provider startup.
6. Sequential startup levels, optional explicitly selected concurrency within
   one level, and reverse dependency shutdown.
7. Runtime Freeze before startup, after which configuration, composition,
   dependency graph, and Event Bus subscriptions are immutable.
8. Typed asynchronous Event Bus delivery and instance-scoped Observability
   whose logging, diagnostics, metrics, and health remain facets of one
   component.
9. Runtime Foundation unit-test sources, a programming model, requirement and
   ADR evidence mapping, and a minimal headless example.

`Runtime`, `RuntimeBuilder`, `RuntimeContext`, `RuntimeState`, and
`RuntimeHost` are implementation surfaces, not extra Runtime Foundation
components. This roadmap records implementation scope; executed validation
results must be reported separately by the build/test workflow.

IM-003 explicitly excludes MemoryOS, Representation, Process, Persistence,
GUI, plugins, networking, SDK, Studio, AI, reasoning, and application-domain
behavior.

## Recommended IS-003: contract hardening and traceability

IS-003 should deepen the compiler contract rather than expand into another
subsystem:

1. publish a diagnostic compatibility catalog with golden JSON;
2. define schema-minor migration and deprecation policy;
3. decide and govern a custom validation-rule expression language;
4. trace requirements and source spans through reports;
5. define atomic output, rollback, and reproducibility manifests;
6. add fuzzing, malformed-input corpus, scale limits, and performance budgets;
7. broaden recorded Windows, Linux, and macOS evidence;
8. adopt dependency provenance, update, and vulnerability policy;
9. resolve licensing, copyright, contribution, and release governance;
10. decide API/ABI stability separately from source-format compatibility.

Exit evidence should include reviewed architecture decisions, golden fixtures,
migration tests, reproducibility evidence, and an updated threat assessment
for the compiler input/output boundary.

## CP-011: Memory Studio

Status: released in MemoryOS 1.0; additive MemoryOS 1.1 presentation released
in v1.1.0.

CP-011 implements the final MemoryOS capability as a passive observability
boundary. The delivered scope is the frozen CCA-STUDIO-1.0 C++ Contract,
complete conformance evidence, a checked example, and a responsive downstream
presentation of detached MemoryOS observations. MemoryOS 1.1 adds deterministic
observation frames, traces, replay, evolution, and comparative reconstruction
only downstream of that frozen Contract. It adds no memory mutation, retrieval,
persistence, Runtime ownership, or Provider implementation.

## Possible later increments

These are proposals, not authorization:

- package and registry contracts after an offline reproducibility design;
- specific code-generation targets after their production contracts exist;
- provider SDK packages and live-client bindings after compatibility policy is
  approved; MO-1202 remains a dependency-free settled-source interface;
- additional public Studio behavior or Atlas only after their APIs and
  security boundaries are defined;
- new MemoryOS capabilities only under a separately approved milestone.

AI, reasoning, LLM, database, domain persistence, plugin, networking, and
Runtime behavior beyond CCA-RF-1.0 must not be smuggled into a compiler or
Runtime Foundation milestone.

## Principal risks

| Risk | Consequence | IS-002 mitigation |
|---|---|---|
| Canonical data is mistaken for Runtime behavior | Consumers infer executable semantics | Compiler model remains architecture-neutral and separate from the IM-003 Runtime |
| Schema and validator drift | Different tools accept different inputs | Normative checked-in schema, fixtures, and paired tests |
| Diagnostics become prose protocols | Integrations break on wording changes | Stable identifier/code fields and deterministic JSON |
| Two dependency representations diverge | Analysis becomes ambiguous | One top-level directed dependency graph |
| Extension data becomes a plugin escape hatch | Unreviewed executable behavior enters scope | Extensions are preserved data and never executed |
| Generated outputs vary by host | Diffs and automation become unreliable | Ordered serialization with no time, locale, randomness, or host state |
| Partial writes look successful | Consumers use incomplete bundles | Generation error diagnostics and explicit generated-file result |
| Reserved repositories attract premature work | Scope expands into MemoryOS, domain, GUI, SDK, or atlas systems | No implementation or dependency edges in repositories that remain reserved |
| Dependency supply chain is underspecified | Reproducibility or license exposure | Pinned foundation; governance remains an IS-003 decision |
| Licensing is unresolved | External rights are unclear | Pending-decision notice and no license grant |

## Roadmap change rule

Moving work between increments requires architecture and scope review. The
review updates [the ambiguity register](docs/ambiguity-register.md), this
roadmap, architecture, schema/contracts, fixtures, and affected tests before
implementation relies on the decision.

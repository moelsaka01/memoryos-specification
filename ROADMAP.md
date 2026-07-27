# CCA reference workspace roadmap

This roadmap separates implemented increments from proposed work. It does not
authorize behavior beyond [the architecture](ARCHITECTURE.md).

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

## Possible later increments

These are proposals, not authorization:

- package and registry contracts after an offline reproducibility design;
- a governed conformance evidence format and independent runner;
- specific code-generation targets after their production contracts exist;
- SDK bindings after compatibility policy is approved;
- Studio or Atlas only after their APIs and security boundaries are defined;
- MemoryOS and all Domain Engine behavior only under separate approved
  architecture.

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
| Reserved repositories attract premature work | Scope expands into MemoryOS, domain, GUI, SDK, or conformance systems | No implementation or dependency edges in reserved repositories |
| Dependency supply chain is underspecified | Reproducibility or license exposure | Pinned foundation; governance remains an IS-003 decision |
| Licensing is unresolved | External rights are unclear | Pending-decision notice and no license grant |

## Roadmap change rule

Moving work between increments requires architecture and scope review. The
review updates [the ambiguity register](docs/ambiguity-register.md), this
roadmap, architecture, schema/contracts, fixtures, and affected tests before
implementation relies on the decision.

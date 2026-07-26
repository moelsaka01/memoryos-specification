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

IS-002 explicitly excludes all runtime and MemoryOS behavior.

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
- MemoryOS or any runtime only under a separate architecture.

AI, reasoning, LLM, database, persistence, plugin, networking, and runtime work
must not be smuggled into a compiler milestone.

## Principal risks

| Risk | Consequence | IS-002 mitigation |
|---|---|---|
| Canonical data is mistaken for runtime behavior | Consumers infer executable semantics | Architecture-neutral model and explicit exclusions |
| Schema and validator drift | Different tools accept different inputs | Normative checked-in schema, fixtures, and paired tests |
| Diagnostics become prose protocols | Integrations break on wording changes | Stable identifier/code fields and deterministic JSON |
| Two dependency representations diverge | Analysis becomes ambiguous | One top-level directed dependency graph |
| Extension data becomes a plugin escape hatch | Unreviewed executable behavior enters scope | Extensions are preserved data and never executed |
| Generated outputs vary by host | Diffs and automation become unreliable | Ordered serialization with no time, locale, randomness, or host state |
| Partial writes look successful | Consumers use incomplete bundles | Generation error diagnostics and explicit generated-file result |
| Reserved repositories attract premature work | Scope expands into runtime systems | No implementation or dependency edges in reserved repositories |
| Dependency supply chain is underspecified | Reproducibility or license exposure | Pinned foundation; governance remains an IS-003 decision |
| Licensing is unresolved | External rights are unclear | Pending-decision notice and no license grant |

## Roadmap change rule

Moving work between increments requires architecture and scope review. The
review updates [the ambiguity register](docs/ambiguity-register.md), this
roadmap, architecture, schema/contracts, fixtures, and affected tests before
implementation relies on the decision.

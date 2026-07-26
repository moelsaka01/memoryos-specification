# CCA reference implementation architecture

## 1. Authority

This document is the authoritative implementation architecture for the CCA
reference workspace. The
[Canonical Specification 1.0 schema](specification/schema/canonical-specification-1.0.schema.json)
is the authoritative data-shape contract consumed by the IS-002 compiler.

Source, tests, examples, generated reports, and supporting documentation must
conform to both records. When a requirement is not decided, implementation
stops at the documented boundary and the question is recorded in the
[ambiguity register](docs/ambiguity-register.md).

The IM-001 engineering foundation remains valid, but its placeholder-only
compiler restriction is superseded by this approved IS-002 vertical slice.

## 2. Architectural priorities

Decisions are evaluated in this order:

1. architecture correctness;
2. maintainability;
3. readability;
4. deterministic behavior;
5. testability;
6. documentation;
7. performance after correctness.

Public C++ uses C++23, RAII, strong value types, const correctness, explicit
dependency injection, header/source separation, and composition. Raw pointers
never own resources. Mutable global state is prohibited.

## 3. IS-002 scope

IS-002 implements:

- a human- and machine-readable canonical YAML format;
- a checked Draft 2020-12 JSON Schema for the equivalent data model;
- source loading and YAML parsing with source locations;
- schema and semantic validation;
- stable, structured diagnostics;
- deterministic analysis and dependency resolution;
- a typed internal model;
- an ordered compiler pipeline;
- deterministic Markdown, Mermaid, and JSON artifacts;
- `validate`, `analyze`, `compile`, and `report` CLI operations;
- examples, invalid fixtures, tests, and a 90% line-coverage target.

It does not implement a runtime or computational model.

## 4. Workspace and repository boundaries

The workspace owns integration, governance, shared build policy, schema,
examples, and cross-repository validation.

### `cca-core`

`cca-core` owns generally reusable engineering facilities: logging,
configuration, string utilities, version information, and test support. It
does not own canonical compiler types or domain semantics.

### `cca-compiler`

`cca-compiler` owns source loading, parsing, validation, analysis, dependency
resolution, model construction, generation, serialization, CLI composition,
compiler diagnostics, and compiler-specific logging/configuration seams.

The compiler may depend on `cca-core`. `cca-core` must not depend on compiler
interfaces.

### Reserved repositories

`memoryos`, `cca-studio`, `cca-sdk`, `cca-conformance`, and `cca-atlas` remain
reserved. They have no authorized implementation or dependency edges in
IS-002.

## 5. Canonical specification

Canonical source is one UTF-8 YAML document equivalent to the JSON data model
defined in [the schema](specification/schema/canonical-specification-1.0.schema.json).
Every document is self-describing through:

- `$schema`: `cca://schemas/canonical-specification/1.0`;
- `format_version`: compatible semantic version in major line 1;
- `kind`: `canonical_specification`;
- its own stable `id` and content `version`.

The root inventories metadata, categories, typed objects, relationships,
dependencies, validation rules, artifact requests, annotations, and
extensions. Core records reject unknown fields. Architecture-neutral
type-specific payload belongs in object `properties`; vendor custom data
belongs only in explicit extension maps. Neither becomes executable behavior.

Objects use the types Package, Domain, Component, Contract, and Requirement.
These are architectural records, not runtime instances. The full contract is
in [the canonical-format reference](specification/canonical-format.md).

## 6. Compiler control flow

The authorized pipeline is:

```text
Load -> Parse -> Validate -> Analyze -> Resolve Dependencies
     -> Build Internal Model -> Generate Artifacts -> Generate Reports
```

Each stage has one responsibility and receives explicit typed input. Errors
block dependent stages; warnings and notes accumulate. The final result records
completed stages, diagnostics, optional analysis/model values, and generated
files.

`ISourceLoader` isolates filesystem input and permits deterministic in-memory
tests. `CanonicalValue` isolates YAML syntax from validation and model types.
`CompilerPipeline` is the orchestrator. `CompilerCommandService` adapts it to
the CLI command boundary. The executable is the composition root.

[Pipeline documentation](docs/pipeline.md) defines mode and failure behavior.

## 7. Internal model

The aggregate root is `Specification`. It composes Metadata, Version,
Category, Package, Domain, Component, Contract, Requirement, Relationship,
Dependency, ValidationRule, ArtifactRequest, and ValidationResult values.

`Identifier` and `Version` prevent unvalidated primitive strings at model
boundaries. Object kinds use composition through a common header rather than a
behavioral inheritance hierarchy. Ordered collections preserve deterministic
output. The model owns data and contains no filesystem, network, persistence,
plugin, or runtime handles.

See [internal model](docs/internal-model.md).

## 8. Validation and diagnostics

The compiler enforces:

- schema identity, format major, required fields, shapes, and closed records;
- identifier, metadata, enum, and semantic-version rules;
- unique identifiers;
- known object types;
- category and object reference resolution;
- unique relationship identities and edge triples;
- dependency endpoints, constraints, and acyclic ordering;
- supported artifact types and safe relative output paths.

Every diagnostic contains stable identifier, code, severity, message,
suggestion, 1-based source location, and category. Diagnostics sort by path,
line, column, code, and message. Logs are operational observation and never
replace a public diagnostic result.

Declared custom rule expressions are preserved but not evaluated in IS-002.
See [validation and diagnostics](docs/validation.md).

## 9. Generation

Only a valid typed model reaches generation. The fixed output bundle is:

- `documentation-index.md`;
- `dependency-graph.mmd`;
- `specification-report.json`;
- `validation-report.json`;
- `object-inventory.json`;
- `architecture-summary.md`;
- `generated/README.md`.

Outputs contain no timestamp, randomness, host identity, network data, or
machine-specific absolute path. The generated README is the sole
code-generation placeholder; no production source is emitted.

See [generator contracts](docs/generators.md).

## 10. Determinism and environmental state

Equivalent explicit input, compiler version, and output option produce
equivalent diagnostics and artifact bytes. Externally visible collections are
sorted, JSON member order is fixed, paths use documented display
normalization, and ASCII/semantic-version rules avoid locale dependence.

Compiler semantics do not consult the network, clock, random source, current
environment variables, or mutable process-global registry. Concurrent writes
to one output directory require external synchronization.

## 11. Public interface and quality contract

Public classes document responsibility, ownership, preconditions, results,
side effects, determinism, thread safety, and limitations. Tests target public
behavior and injected seams. The workspace quality gate targets at least 90%
line coverage for compiler production sources, in addition to formatting,
static analysis, unit, integration, CLI, fixture, install/export, and
cross-platform checks.

This source contract does not promise a frozen C++ ABI. Format compatibility
and diagnostic identities are the durable integration surfaces in IS-002.

## 12. Hard exclusions

IS-002 contains no MemoryOS, runtime execution, cognition, reasoning, AI, LLM,
database, persistence, plugin system, networking, Studio, SDK, package manager,
conformance certification engine, or generated production code.

Names, categories, reserved directories, and interfaces do not authorize
those features. Crossing one of these boundaries requires a separately
approved architecture.

## 13. Remaining decisions

Licensing, public contribution governance, long-term repository topology,
release coordination, dependency supply-chain policy, frozen API/ABI policy,
custom-rule execution, transactional output, and future subsystem
architectures remain unresolved or deferred. The
[ambiguity register](docs/ambiguity-register.md) tracks their status.

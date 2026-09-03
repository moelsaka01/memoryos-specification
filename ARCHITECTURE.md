# CCA reference implementation architecture

## 1. Authority

This document is the authoritative implementation architecture for the CCA
reference workspace. The
[Canonical Specification 1.0 schema](specification/schema/canonical-specification-1.0.schema.json)
is the authoritative data-shape contract consumed by the IS-002 compiler.
CCA-RF-1.0 is the authoritative architecture and behavior contract for the
IM-003 Runtime Foundation.

Source, tests, examples, generated reports, and supporting documentation must
conform to the applicable record. When a requirement is not decided,
implementation stops at the documented boundary and the question is recorded
in the [ambiguity register](docs/ambiguity-register.md).

The IM-001 engineering foundation remains valid, but its placeholder-only
compiler restriction is superseded by the approved IS-002 vertical slice.
The former exclusion of all runtime work is superseded only by the approved
CCA-RF-1.0 Runtime Foundation implemented in IM-003.

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

The IS-002 compiler does not implement a Runtime or computational model.
IM-003 is a separate implementation boundary governed by CCA-RF-1.0.

## 4. IM-003 Runtime Foundation scope

IM-003 implements a headless Layer 3 Runtime Foundation under CCA-RF-1.0. The
official executable host is `cca-runtime`. One `RuntimeHost` can own multiple
identified Runtime instances; each instance owns an independent execution
context, and no Runtime is a global singleton.

The Runtime Foundation contains exactly these six components:

1. Lifecycle Manager;
2. Service Registry;
3. Dependency Injector;
4. Event Bus;
5. Configuration Manager;
6. Observability.

`Runtime`, `RuntimeBuilder`, `RuntimeContext`, `RuntimeState`, and
`RuntimeHost` are implementation and composition surfaces around those six
components. They are not additional peer components. Logging, diagnostics,
metrics, and health are facets of Observability, not separate components.

The normal lifecycle is:

```text
Constructed -> Initializing -> Configuring -> Registering Services
-> Resolving Dependencies -> Validating -> Runtime Freeze -> Starting
-> Running -> Stopping -> Stopped -> Destroyed
```

Lifecycle failure enters `Failed`, proceeds through `Rollback`, performs
deterministic cleanup, and terminates in `Destroyed`. Runtime Freeze makes
configuration, contract/provider composition, the validated dependency graph,
and Event Bus subscriptions immutable before any Provider starts.

Service identity is compile-time typed. Each Service Contract declares
`ExactlyOne`, `ZeroOrOne`, or `OneOrMore` provider cardinality. Provider
implementations remain internal to Runtime composition. Required collaborators
are constructor-injected from a complete, validated, acyclic dependency graph;
string-based service lookup is not exposed. Dependency levels start
sequentially, with explicitly selected concurrency permitted only within one
level. Shutdown follows reverse dependency order. Typed asynchronous
notification crosses the instance-local Event Bus.

The canonical layer model is:

1. Layer 1 — Operating System;
2. Layer 2 — Platform Abstraction;
3. Layer 3 — Runtime Foundation;
4. Layer 4 — Domain Engines: Representation, Process, and Persistence;
5. Layer 5 — Applications.

Every inter-layer dependency originates in a higher-numbered layer and targets
a lower-numbered layer. IM-003 implements Layer 3, its headless host surface,
and its use of existing lower-layer engineering facilities; it does not
implement Layer 4 Domain Engines or Layer 5 application behavior.

The concrete API, lifetime, error, and thread-safety contracts are in the
[Runtime Foundation programming model](repositories/cca-core/docs/runtime-programming-model.md).
The requirement and ADR trace is in the
[Runtime Foundation conformance evidence](repositories/cca-core/docs/runtime-conformance-evidence.md).

## 5. Workspace and repository boundaries

The workspace owns integration, governance, shared build policy, schema,
examples, and cross-repository validation.

### `cca-core`

`cca-core` owns generally reusable engineering facilities; the approved
Runtime, Representation, Process, and Persistence foundations; and the current
CP-001 through CP-010 MemoryOS implementation. Its shared facilities include
logging, configuration, string utilities, version information, and test
support. Its Runtime namespace owns the six CCA-RF-1.0 components plus the
implementation surfaces described in Section 4. It does not own canonical
compiler types or the downstream Memory Studio presentation.

### `cca-compiler`

`cca-compiler` owns source loading, parsing, validation, analysis, dependency
resolution, model construction, generation, serialization, CLI composition,
compiler diagnostics, and compiler-specific logging/configuration seams.

The compiler may depend on `cca-core`. The Runtime Foundation may depend on
lower-layer facilities in `cca-core`. `cca-core` must not depend on compiler or
higher-layer domain interfaces.

### `cca-studio`

`cca-studio` owns the CP-011 CCA-STUDIO-1.0 passive observation Contract. Its
headless `cca::studio` target depends only on the released public
`cca::memory` surface. The responsive presentation is downstream of that
Contract and is not part of the frozen C++ API. Released MemoryOS capabilities
have no reverse dependency on Studio.

MemoryOS 1.2 adds three headless JavaScript boundaries in `cca-studio`: the
MIP-001 Producer/Consumer/Verifier, AI runtime adapters that translate
successfully settled external runtime results into Observation-only MIPs. Raw
transport remains private adapter input. Adapters depend on the MIP module,
never on Runtime or the renderer, and import no provider SDK. External AI
runtimes retain ownership of execution and cognitive truth. The Investigation
Core is the single authority for deterministic investigation execution. It
wraps the released native Trace, Replay, Evolution, and Comparative semantics,
owns verified MIP-backed investigations, and projects immutable state to thin
clients. MO-1206 adds read-only Cognitive Regression Analysis inside this same
authority. Regression compares immutable Core truth and never mutates either
investigation, interprets a difference, or invents cognition absent from an
imported package. MO-1207 adds the Cognitive Investigation Explorer inside the
same authority. It traverses only validated report differences and returns
canonical pointers to their existing digests; it never reloads or executes an
investigation.

Studio no longer imports the Investigation Core directly. Its only public
investigation dependency is the in-process JavaScript MemoryOS SDK facade,
which forwards every state-changing operation, regression request, and
Explorer query to the Core and every package verification request to the MIP
verifier.

### `cca-sdk`

`cca-sdk` owns the MO-1204 public C++ and Python facades and the one private,
versioned JavaScript binding used by native consumers. One SDK instance owns
one long-lived, isolated binding session and therefore one Investigation Core
instance. The binding transports explicit commands and immutable projections;
it contains no Trace, Replay, Evolution, Comparative Reconstruction, Cognitive
Regression, Explorer, Runtime, or MIP semantics. Native and Studio clients
consequently observe the same Core transition log, regression report, Explorer
result, and canonical MIP bytes.

The dependency direction is fixed:

```text
MemoryOS Runtime -> Investigation Core -> private binding -> MemoryOS SDK
                                                        -> SDK consumers
```

The SDK cannot call the renderer, adapters, or Runtime directly. The Core does
not depend on the SDK. Package verification remains owned by MIP-001.

### `memoryos-cli`

`memoryos-cli` owns shell and CI automation. It consumes only the
public JavaScript MemoryOS SDK facade and contains no Runtime, Investigation
Core, MIP, Trace, Replay, Evolution, Regression, Explorer, or renderer behavior.
Every cognitive operation is an explicit SDK call. Package bytes, regression
reports, Explorer results, and JSON inputs are transported without semantic
reinterpretation.

Each stateless invocation creates one isolated SDK instance. The `session`
command retains one instance for a JSON Lines workflow; its checkpoints remain
actual opaque SDK objects held only in memory and are never serialized. The CLI
cannot restore checkpoints across processes. The MO-1206 `regression` command
may load two verified packages only to pass their two SDK investigation handles
to the Core; it does not compare their bytes, rendering, or layout itself.
The MO-1207 `investigate` command passes one validated regression report and an
explicit query to the SDK. It does not filter, match, replay, or resolve
evidence locally.

The complete downstream direction is:

```text
MemoryOS Runtime -> Investigation Core -> MemoryOS SDK
                                             |---> MemoryOS CLI
                                             `---> Memory Studio
```

Neither consumer may call the Core directly.

### Reserved repositories

`memoryos`, `cca-conformance`, and `cca-atlas` remain reserved as future
repository boundaries. The released MemoryOS implementation currently resides
in `cca-core`, `cca-studio`, and the authorized `cca-sdk` facade. The additive
`memoryos-cli` repository is a downstream SDK consumer; the reserved
`memoryos` directory does not create a second implementation or authorize
dependency edges merely by its presence.

## 6. Canonical specification

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

## 7. Compiler control flow

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

## 8. Internal model

The aggregate root is `Specification`. It composes Metadata, Version,
Category, Package, Domain, Component, Contract, Requirement, Relationship,
Dependency, ValidationRule, ArtifactRequest, and ValidationResult values.

`Identifier` and `Version` prevent unvalidated primitive strings at model
boundaries. Object kinds use composition through a common header rather than a
behavioral inheritance hierarchy. Ordered collections preserve deterministic
output. The model owns data and contains no filesystem, network, persistence,
plugin, or runtime handles.

See [internal model](docs/internal-model.md).

## 9. Validation and diagnostics

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

## 10. Generation

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

## 11. Determinism and environmental state

Equivalent explicit input, compiler version, and output option produce
equivalent diagnostics and artifact bytes. Externally visible collections are
sorted, JSON member order is fixed, paths use documented display
normalization, and ASCII/semantic-version rules avoid locale dependence.

Compiler semantics do not consult the network, clock, random source, current
environment variables, or mutable process-global registry. Concurrent writes
to one output directory require external synchronization.

## 12. Public interface and quality contract

Public classes document responsibility, ownership, preconditions, results,
side effects, determinism, thread safety, and limitations. Tests target public
behavior and injected seams. The workspace quality gate targets at least 90%
line coverage for compiler production sources, in addition to formatting,
static analysis, unit, integration, CLI, fixture, install/export, and
cross-platform checks.

This source contract does not promise a frozen C++ ABI. Format compatibility
and diagnostic identities are the durable integration surfaces in IS-002.

## 13. Hard exclusions

IS-002 contains no Runtime execution; its compiler boundary remains unchanged.
IM-003 contains only the CCA-RF-1.0 Runtime Foundation described in Section 4.
Those historical milestone exclusions do not authorize or constrain later
frozen capability packages. Current later packages add the documented
foundations, CP-011 Studio, MO-1201 MIP, MO-1202 settled-source adapter
interfaces, the MO-1203 Investigation Core, the MO-1204 SDK facade, the
MO-1205 CLI, and MO-1206 deterministic Cognitive Regression Analysis.
AI execution, LLM behavior, provider SDK packages/live clients, databases,
plugins, networking, package management, and generated production code remain
excluded.

Names, categories, reserved directories, and interfaces do not authorize
those features. Crossing one of these boundaries requires a separately
approved architecture.

## 14. Remaining decisions

Licensing, public contribution governance, long-term repository topology,
release coordination, dependency supply-chain policy, frozen API/ABI policy,
custom-rule execution, transactional output, and future subsystem
architectures beyond the currently frozen capability packages remain
unresolved or deferred. The
[ambiguity register](docs/ambiguity-register.md) tracks their status.

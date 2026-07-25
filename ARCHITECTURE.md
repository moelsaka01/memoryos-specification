# CCA reference implementation architecture

## 1. Authority and interpretation

This document is the authoritative architecture record for the CCA reference
implementation workspace. Source code, build files, tests, examples, and other
documentation must conform to it and must not create architecture by accident.

This architecture records only requirements established for the engineering
foundation. It does not define the Cognitive Computing Architecture
specification itself. A class name, source layout, placeholder return value, or
test seam must never be interpreted as a CCA semantic rule.

When this document does not decide an architectural question:

1. implementation stops at an interface or placeholder boundary;
2. the question is recorded in
   [docs/ambiguity-register.md](docs/ambiguity-register.md);
3. an authorized architecture decision is required before dependent behavior
   is implemented;
4. this document and affected contracts are updated before code relies on that
   decision.

Supporting documents may explain this architecture but cannot override it.

## 2. Architectural priorities

Decisions are evaluated in this order:

1. architecture correctness;
2. maintainability;
3. readability;
4. deterministic behavior;
5. testability;
6. documentation;
7. performance after correctness.

These priorities prohibit optimizing an unspecified compiler design or
introducing convenient dependencies that pre-empt an architectural decision.

## 3. Foundation milestone boundary

The current milestone creates:

- the multi-repository workspace structure;
- cross-platform CMake and dependency-management foundations;
- shared configuration, logging, utility, testing, and versioning foundations;
- a C++23 compiler framework made of public seams and private
  implementations;
- CLI command placeholders;
- quality-tooling and test integration;
- documentation and usage examples appropriate to placeholder behavior.

The current milestone does not create:

- MemoryOS behavior;
- AI, reasoning, or LLM behavior;
- databases or persistence services;
- plugin loading or extension systems;
- network protocols, clients, or servers;
- a source language grammar, parser semantics, semantic model, intermediate
  representation, artifact format, package format, or conformance rules;
- a production compiler pipeline.

These are hard boundaries. They are not optional stretch goals.

## 4. Workspace and repository boundaries

The workspace is an integration and governance boundary. It hosts shared build
configuration, quality policy, documentation, examples, scripts, and the
repository directories.

### `cca-core`

`cca-core` owns generally reusable engineering-foundation facilities required
by CCA components, including common utilities, logging, configuration,
versioning, and common testing seams. It must not contain compiler semantics or
become a catch-all for undefined domain concepts.

### `cca-compiler`

`cca-compiler` owns the compiler-facing public interfaces, private skeleton
implementations, diagnostic contracts, configuration facade, logging adapter
seams, CLI dispatch, and module-level tests and examples. It may consume the
shared foundation but must not push compiler-specific concepts into
`cca-core`.

### Reserved repositories

`memoryos`, `cca-studio`, `cca-sdk`, `cca-conformance`, and `cca-atlas` are
reserved repository boundaries. Their presence in the workspace communicates
the intended ecosystem map only. No behavior or dependency relationship is
authorized for them in this milestone.

Whether the workspace remains a monorepo, becomes a superproject, or maps these
directories to independent version-control repositories is unresolved.

## 5. Dependency and control boundaries

The only dependency direction authorized by this milestone is that the compiler
framework may use the shared engineering foundation. The shared foundation
must not depend on compiler-specific interfaces.

No required ordering among parser, validator, analyzer, or generator modules is
defined. Their names do not authorize a pipeline. Orchestration, data passed
between stages, concurrency, caching, incremental processing, and failure
propagation remain unresolved.

Dependencies on concrete loggers, diagnostic sinks, filesystems, clocks,
process state, or environment state should be placed behind explicit seams
where appropriate. Avoid global mutable state. A dependency-injection
framework is not authorized or required.

## 6. Compiler framework boundaries

The compiler framework contains these named modules:

- Parser
- Validator
- Analyzer
- Artifact Generator
- Documentation Generator
- Conformance Generator
- Package Generator
- CLI
- Configuration
- Logging
- Diagnostics

Each processing or generation module exposes one public operation appropriate
to its name and hides implementation detail behind source-file boundaries.
During this milestone, requests can be checked only for basic structural
validity needed to exercise the interface. A structurally acceptable request
must still report that the domain operation is not implemented.

The CLI recognizes placeholder command surfaces for `compile`, `validate`,
`generate`, `doctor`, `version`, and `help`. A successful help, version, or
foundation-health response does not imply compilation capability. Compiler
commands must not report domain success while their underlying behavior is a
placeholder.

Detailed public names and current placeholder behavior are recorded in
[docs/compiler-modules.md](docs/compiler-modules.md). That document must be
kept consistent with the implemented headers, but it cannot add compiler
semantics.

## 7. Diagnostics, logging, and configuration

Diagnostics communicate structured operation status at public compiler seams.
The foundation distinguishes invalid requests from operations unavailable
because their semantics are not implemented. The exact long-term error model,
diagnostic code taxonomy, source-location model, localization policy, and
serialization format are unresolved.

Logging is an operational observability boundary, not a substitute for a
public diagnostic result. The compiler offers a no-op logger for deterministic
embedding and a stream-oriented implementation for basic integration. Global
logger registration is not part of the architecture.

Compiler configuration has an explicit default construction path and a
validation seam. The durable configuration file format, precedence rules,
environment-variable mapping, schema, and compatibility guarantees are
unresolved.

## 8. Public interface quality contract

Every public class must document:

- responsibility and non-responsibilities;
- ownership and lifetime expectations;
- input preconditions and output meaning;
- errors or status results;
- observable side effects;
- determinism;
- thread-safety status;
- current milestone limitations.

Every public class also requires a unit-test placeholder or implemented
interface-level test and an example usage location. Placeholders must be named
and described honestly; they must not assert future semantics.

Public C++ interfaces use C++23, RAII, strong typing, const correctness,
namespaces, and header/source separation. Raw pointers are never owning.
`std::unique_ptr` represents sole ownership; `std::shared_ptr` is used only for
real shared ownership. Macros are limited to include guards or `#pragma once`.

The conceptual checklist and class-by-class expectations are in
[docs/public-api-contract.md](docs/public-api-contract.md).

## 9. Determinism and state

Given equivalent explicit inputs and dependencies, placeholder operations must
produce equivalent status and diagnostic outcomes. The foundation must not
silently depend on wall-clock time, randomness, network state, mutable global
state, or unspecified iteration order.

This statement does not decide the future compiler's reproducible-build model,
artifact normalization rules, path normalization, locale behavior, or
concurrency model. Those require architecture decisions before compilation
logic is implemented.

## 10. Platform and tool boundaries

The engineering foundation targets Windows, Linux, and macOS. C++23 is the
primary implementation language. Python 3.12 or newer may support engineering
tools. TypeScript and React are reserved for future frontend work, and Qt is a
future possibility. Java is excluded.

CMake, vcpkg integration, clang-format, clang-tidy, CTest, GoogleTest, continuous
integration, coverage integration, and static analysis form the quality
foundation. A configured tool is not evidence that a particular run passes on
every supported platform.

## 11. Architectural unknowns

The following decisions are deliberately not made here:

- the CCA specification, syntax, semantics, and versioning authority;
- compiler stage ordering and intermediate representations;
- artifact, documentation, conformance, and package formats;
- error-code stability and diagnostic serialization;
- configuration formats and precedence;
- ABI, API compatibility, package naming, and distribution policy;
- repository topology and cross-repository release coordination;
- dependency approval and supply-chain policy;
- plugin and network architecture;
- security, threat, privacy, and trust models for future domain behavior;
- project license and contribution terms.

The complete register, including blockers and decision evidence required, is in
[docs/ambiguity-register.md](docs/ambiguity-register.md).

# CCA coding standards

These standards apply to C++ foundation code unless an authoritative
architecture decision says otherwise.

## Priorities

Choose architecture correctness, maintainability, readability, deterministic
behavior, testability, and documentation before performance. Optimize only
with evidence and without weakening a public contract.

## Language and portability

- Use standard C++23 with compiler extensions disabled.
- Write portable code for Windows, Linux, and macOS.
- Isolate unavoidable platform-specific code behind a narrow interface.
- Do not add Java.
- Python engineering tools require Python 3.12 or newer.
- TypeScript, React, and Qt are outside the current implementation milestone.

Exact compiler versions and support windows remain unresolved; do not claim
support beyond verified configurations.

## Architecture and scope

- Treat [../ARCHITECTURE.md](../ARCHITECTURE.md) as authoritative.
- Keep shared foundation concepts independent of compiler-specific concepts.
- Follow the pipeline and stage contracts in [pipeline.md](pipeline.md);
  do not introduce a second orchestration path.
- Stop and record an ambiguity before introducing a new public data model,
  dependency direction, format, or compatibility promise.
- Do not implement MemoryOS, AI, reasoning, LLM, database, plugin, or network
  behavior in this milestone.

## Ownership and resource management

- Use RAII for every resource.
- Do not use raw owning pointers.
- Prefer values for small, self-contained data.
- Use `std::unique_ptr` for exclusive dynamic ownership.
- Use `std::shared_ptr` only when two or more owners genuinely participate in
  lifetime. Document why shared ownership is required.
- References and raw pointers are observers; document lifetime and nullability.
- Make destructors virtual on polymorphic base classes.
- Apply the rule of zero where possible. If a type owns a PImpl or another
  resource, state its copy and move behavior explicitly.

## Interfaces

- Give each public class one clear responsibility.
- Prefer strong domain-specific types over unrelated primitive parameters.
- Keep headers minimal and self-contained.
- Separate public declarations in headers from private implementation in source
  files.
- Put implementation details behind private members or a PImpl where that
  separation materially improves dependency hygiene. A PImpl does not imply an
  ABI guarantee.
- Mark important return values `[[nodiscard]]`.
- Mark non-throwing operations `noexcept` only when the complete implementation
  can honor it.
- Do not expose mutable implementation containers merely for convenience.
- Avoid default arguments that hide meaningful policy.

Every public class must satisfy
[public-api-contract.md](public-api-contract.md).

## Const correctness and mutation

- Mark member functions `const` when they do not change observable state.
- Pass read-only inputs by value for cheap scalar/value types and by const
  reference or view when ownership is not transferred.
- Do not use `mutable` to disguise externally visible mutation.
- Document synchronization when internal mutation occurs through a const
  operation.

## Dependency injection and global state

- Inject loggers, diagnostic sinks, and other environmental dependencies where
  appropriate.
- Prefer explicit constructor or operation dependencies over service locators.
- Avoid mutable global state and hidden singletons.
- Do not introduce a dependency-injection framework without an architecture
  decision.
- No operation should silently consult the network, wall clock, random source,
  process environment, or current working directory unless that dependency is
  part of its documented contract.

## Errors, diagnostics, and logging

- Use the public status contract for expected operation outcomes.
- Give callers structured diagnostics when they need actionable detail.
- Use logging for operational observation, not as the only error result.
- Never report success for unimplemented compiler behavior.
- Do not make exact diagnostic message prose a compatibility contract; use
  stable identifiers and codes.
- Preserve exception safety appropriate to owned resources. Do not add a
  blanket exception policy before it is architecturally decided.

## Determinism

- Equivalent explicit inputs and dependencies must produce equivalent
  diagnostics, analysis, and artifacts.
- Avoid dependence on unspecified container iteration order.
- Sort externally visible collections when ordering is part of the documented
  result.
- Keep locale, path, timestamp, environment, and randomness dependencies
  explicit.
- Do not invent output-normalization rules before CCA-A015 is resolved.

## Namespaces and naming

- Place compiler code in `cca::compiler` and shared foundation code in its
  owning `cca` namespace.
- Use `PascalCase` for class, struct, and enum type names.
- Use `snake_case` for functions, variables, and enumerators.
- Use a trailing underscore for private data members.
- Use clear words; avoid abbreviations unless they are established project
  terminology.
- Name interfaces by role. The existing compiler boundary uses an `I` prefix
  for consumer-implemented interfaces such as `ILogger` and
  `IDiagnosticSink`; keep that local convention consistent.
- Do not encode type information in variable names.

## Headers and includes

- Use `#pragma once` or include guards.
- A public header must compile when included on its own.
- Include what the declaration uses; do not rely on transitive includes.
- Prefer forward declarations only when they remain clear and valid.
- Use angle brackets for standard and installed project headers.
- Keep includes in the order enforced by the repository's formatter.
- Avoid inline implementation in public headers unless templates,
  `constexpr`, or trivial operations require it.

## Macros

Do not use macros except include guards or `#pragma once`.

## Documentation

- Use documentation comments on public declarations.
- State implemented behavior and limitations next to public APIs.
- Update module documentation and examples with public API changes.
- Use "configured," "implemented," and "verified" precisely.
- Link to the architecture rather than copying and subtly altering it.
- Record unresolved decisions in the ambiguity register.

## Tests

- Keep tests deterministic, isolated, and readable.
- Test public behavior and meaningful seams, not private implementation layout.
- Use temporary paths rather than fixed machine-specific directories.
- Do not require network access.
- Reserved compatibility seams must state which future contract is absent.
- Do not weaken an assertion merely to accommodate nondeterministic code.
- Do not claim a test passed unless the run was observed.

## Tooling

Use the repository-provided clang-format and clang-tidy configurations. Build
with warnings enabled. Optional warnings-as-errors, sanitizers, cppcheck, and
coverage modes are documented in
[build-instructions.md](build-instructions.md). Tool suppressions must be local,
explained, and reviewed; a broad suppression is a policy change.

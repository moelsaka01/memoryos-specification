# Repository overview

## Workspace role

The workspace coordinates engineering policy and integration for a collection
of intended independent CCA repositories. The directory layout is present in
one workspace for this milestone; it does not decide the long-term
version-control topology.

Workspace-owned concerns include:

- architecture, roadmap, contribution, conduct, and license records;
- shared CMake and vcpkg integration;
- common formatting and static-analysis policy;
- cross-repository test and CI entry points;
- bootstrap scripts and engineering tools;
- documentation and the top-level example catalog.

Implementation-specific headers, sources, tests, and detailed module examples
belong to the repository that owns the behavior.

## Repository map

| Repository | Milestone status | Responsibility |
|---|---|---|
| `cca-core` | Foundation implementation target | Reusable configuration, logging, utilities, testing support, and versioning foundations |
| `cca-compiler` | IS-002 implementation target | Canonical source loading, parsing, validation, analysis, dependency resolution, model construction, deterministic generation, diagnostics, and CLI |
| `memoryos` | Reserved only | Future boundary; MemoryOS implementation is explicitly excluded |
| `cca-studio` | Reserved only | Future frontend/studio boundary; no implementation authorized |
| `cca-sdk` | Reserved only | Future SDK boundary; public language/platform bindings are undecided |
| `cca-conformance` | Reserved only | Future conformance suite boundary; the retained compatibility seam does not define this repository |
| `cca-atlas` | Reserved only | Future atlas boundary; responsibilities beyond the name are undecided |

See [../repositories/README.md](../repositories/README.md) for the concise
repository-local index.

## `cca-core`

`cca-core` is a shared engineering foundation, not the CCA domain model. A
utility belongs there only when it is generally reusable, has a narrow
contract, and does not introduce compiler or future MemoryOS semantics.

Expected foundation areas are:

- logging abstractions and basic implementations;
- configuration abstractions;
- common utilities;
- common testing support;
- shared version information.

Detailed public names must be documented next to the implemented headers. This
workspace overview does not invent names or contracts not established by that
repository.

## `cca-compiler`

`cca-compiler` implements the ordered Standards Compiler and its Canonical
Specification 1.0 types. Source Loader, Parser, Validator, Analyzer, Dependency
Resolver, Model Builder, Artifact Generator, and report serialization execute
under `CompilerPipeline`. CLI, Configuration, Logging, and Diagnostics are
cross-cutting boundaries. See [compiler-modules.md](compiler-modules.md).

## Reserved directories

A reserved directory may contain a short scope notice, but must not contain
product implementation during this milestone. In particular, no shared helper
may be placed in a reserved repository merely to prepare for hypothetical
future behavior.

## Cross-repository rules

- The compiler framework may use the shared foundation.
- The foundation must not depend on compiler-specific interfaces.
- Reserved repositories have no authorized dependency edges.
- A new cross-repository dependency is an architecture change.
- Versioning and release coordination across repositories are unresolved.
- Each implemented public interface requires documentation, public-behavior
  tests, and an example location.

## Languages

- C++23: primary implementation language.
- Python 3.12 or newer: secondary engineering-tool language.
- TypeScript and React: future frontend technologies, not current scope.
- Qt: possible future technology, not current scope.
- Java: excluded.

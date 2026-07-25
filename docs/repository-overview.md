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
| `cca-compiler` | Skeleton implementation target | Compiler module interfaces, private placeholder implementations, diagnostics, configuration facade, logging seams, and CLI |
| `memoryos` | Reserved only | Future boundary; MemoryOS implementation is explicitly excluded |
| `cca-studio` | Reserved only | Future frontend/studio boundary; no implementation authorized |
| `cca-sdk` | Reserved only | Future SDK boundary; public language/platform bindings are undecided |
| `cca-conformance` | Reserved only | Future conformance suite boundary; compiler skeleton conformance generation does not define this repository |
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

`cca-compiler` contains independent skeleton seams for Parser, Validator,
Analyzer, Artifact Generator, Documentation Generator, Conformance Generator,
Package Generator, CLI, Configuration, Logging, and Diagnostics.

The module list is not a pipeline definition. It does not decide which stage
calls another, what intermediate data looks like, whether work is incremental
or concurrent, or which generated artifacts are normative. See
[compiler-modules.md](compiler-modules.md).

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
- Each public interface requires documentation, a test or honest test
  placeholder, and an example location.

## Languages

- C++23: primary implementation language.
- Python 3.12 or newer: secondary engineering-tool language.
- TypeScript and React: future frontend technologies, not current scope.
- Qt: possible future technology, not current scope.
- Java: excluded.

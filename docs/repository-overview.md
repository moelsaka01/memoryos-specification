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
| `cca-core` | Released foundations and MemoryOS capability implementation | Reusable engineering facilities; Runtime, Representation, Process, and Persistence foundations; and CP-001 through CP-010 MemoryOS behavior |
| `cca-compiler` | IS-002 implementation target | Canonical source loading, parsing, validation, analysis, dependency resolution, model construction, deterministic generation, diagnostics, and CLI |
| `memoryos` | Reserved only | Reserved product repository boundary; the released implementation currently remains in `cca-core` and `cca-studio` |
| `cca-studio` | CP-011 released; MemoryOS 1.1 released; MemoryOS 1.2 in development | Frozen CCA-STUDIO-1.0 Contract, deterministic investigation presentation, single Investigation Core including MO-1206 regression and MO-1207 evidence navigation, canonical MIP implementation, and dependency-free AI runtime adapter interfaces |
| `cca-sdk` | MO-1204, MO-1206, and MO-1207 implemented | Public JavaScript, Python, and native C++ facades over the frozen Investigation Core; one private versioned native binding |
| `memoryos-cli` | MO-1205 through MO-1207 implemented | Official `memoryos` executable, deterministic terminal/JSON output, session-scoped automation, SDK-backed regression reporting, and evidence navigation |
| `cca-conformance` | MO-1208 implemented | Official deterministic CCA-MEMORYOS-1.0 conformance suite, pinned requirement manifest, report schemas, compatibility checks, and Reference Implementation evidence |
| `cca-atlas` | Reserved only | Future atlas boundary; responsibilities beyond the name are undecided |

See [../repositories/README.md](../repositories/README.md) for the concise
repository-local index.

## `cca-core`

`cca-core` is the shared engineering foundation and current implementation
home for the released Runtime, Representation, Process, Persistence, and
MemoryOS CP-001 through CP-010 capabilities. A generally reusable facility
still belongs there only when it has a narrow contract and does not create a
reverse dependency on compiler- or Studio-specific interfaces.

Implemented areas include:

- logging abstractions and basic implementations;
- configuration abstractions;
- common utilities;
- common testing support;
- shared version information;
- the CCA-RF-1.0 Runtime Foundation;
- Representation, Process, and Persistence foundations; and
- released MemoryOS memory, knowledge, retrieval, reflection, consolidation,
  and provider capabilities.

Detailed public names must be documented next to the implemented headers. This
workspace overview does not invent names or contracts not established by that
repository.

The Runtime Foundation contains exactly Lifecycle Manager, Service Registry,
Dependency Injector, Event Bus, Configuration Manager, and Observability.
`Runtime`, `RuntimeBuilder`, `RuntimeContext`, `RuntimeState`, and
`RuntimeHost` are API, orchestration, and hosting surfaces rather than extra
peer components. Logging, diagnostics, metrics, and health are facets of
Observability. The host executable is headless and named `cca-runtime`.

See the [Runtime programming model](../repositories/cca-core/docs/runtime-programming-model.md)
and [conformance evidence mapping](../repositories/cca-core/docs/runtime-conformance-evidence.md).

## `cca-compiler`

`cca-compiler` implements the ordered Standards Compiler and its Canonical
Specification 1.0 types. Source Loader, Parser, Validator, Analyzer, Dependency
Resolver, Model Builder, Artifact Generator, and report serialization execute
under `CompilerPipeline`. CLI, Configuration, Logging, and Diagnostics are
cross-cutting boundaries. See [compiler-modules.md](compiler-modules.md).

## `cca-sdk`

`cca-sdk` is the MO-1204 public programmability boundary, extended by MO-1206
without adding another execution authority. The in-process
JavaScript facade is shared by Studio. The Python and C++ facades retain one
private JavaScript Core-host session per SDK instance and forward explicit
commands over a versioned, bounded protocol. The binding contains transport
only; the frozen Investigation Core remains the sole execution authority and
MIP-001 remains the sole package verification authority.

The SDK exposes immutable Workspace, Investigation, ReplaySession,
ComparisonSession, VerificationResult, RegressionReport, InvestigationResult,
MemoryInvestigationPackage, and Checkpoint values. Observation requires an
explicit Workspace and snapshot;
Trace requires an explicit Reflection selection; comparison and restore
require explicit session and checkpoint values. Regression accepts two
same-Workspace, same-source-kind investigations and returns the Core's factual
report without modifying either input. Explorer queries accept that report and
return the Core's exact deterministic evidence matches without replay or
recomputation. Export accepts only a valid MIP-backed investigation. See the
[SDK documentation](../repositories/cca-sdk/README.md).

## `memoryos-cli`

`memoryos-cli` is the MO-1205 automation boundary and the first independent
consumer of the public SDK. MO-1206 adds `regression`, and MO-1207 adds
`investigate`, through that same boundary. It provides the `memoryos`
executable, deterministic human and JSON output, stable exit codes, exact
package file transport, and a JSON Lines session mode. It imports no Runtime,
Investigation Core, MIP, regression engine, Explorer engine, or renderer
module. Replay and staged comparison require explicit
source-authored Trace selectors and one MIP-backed Investigation; regression
requires two explicit packages and delegates to the SDK.
Investigation accepts a regression report and delegates every evidence query to
the SDK.

The live session retains real SDK handles so checkpoint restoration cannot be
forged or made portable. No checkpoint token or object is serialized. See the
[CLI documentation](../repositories/memoryos-cli/README.md).

## `cca-conformance`

`cca-conformance` is the MO-1208 assessment boundary. It consumes the
published CCA-MEMORYOS-1.0 requirement inventory and invokes existing Runtime,
MIP, Core, SDK, CLI, Regression, and Explorer evidence without reimplementing
their behavior. Its reports classify each normative requirement as `PASS`,
`FAIL`, or `NOT APPLICABLE`; a passing suite is evidence, not authority to
rewrite the Standard. MemoryOS 1.2.0 is the initial Reference Implementation.
See the [conformance suite](../repositories/cca-conformance/README.md).

## Reserved directories

A directory that remains reserved may contain a short scope notice, but must
not contain product implementation without an approved capability. CP-011
separately authorizes `cca-studio`; that repository is no longer governed by
the reserved-directory check.

## Cross-repository rules

- The compiler framework may use the shared foundation.
- The Runtime Foundation is implemented in `cca-core` and does not depend on
  compiler-specific or higher-layer domain interfaces.
- The shared foundation must not depend on compiler-specific interfaces.
- Repositories that remain reserved have no authorized dependency edges.
- `cca-studio` depends downstream on the released `cca::memory` Contract;
  released MemoryOS capabilities have no reverse Studio dependency.
- The MIP and AI runtime adapter modules are headless JavaScript boundaries;
  adapters validate provider transport privately, translate only settled
  source-authored cognition, and do not import or own provider SDKs.
- The headless Investigation Core is the single execution authority for
  deterministic investigation behavior. Clients consume immutable projections;
  they do not derive Trace, Replay, Evolution, Comparative Reconstruction,
  Cognitive Regression, or Explorer facts, or cognition missing from an
  imported MIP.
- `memoryos-cli` is downstream of `cca-sdk`; it owns automation and output
  formatting only and has no direct Core, MIP, Runtime, or renderer dependency.
- Studio and native consumers use the MemoryOS SDK facade. The SDK may forward
  Core or MIP operations but must not implement investigation semantics.
- A new cross-repository dependency is an architecture change.
- CCA-MEMORYOS-1.0 defines the assessed MemoryOS component-version matrix and
  compatibility claims. Broader CCA repository coordination and C++ API/ABI
  compatibility remain unresolved.
- Each implemented public interface requires documentation, public-behavior
  tests, and an example location.

## Languages

- C++23: primary implementation language.
- Python 3.12 or newer: secondary engineering-tool language.
- JavaScript, HTML, and CSS: the dependency-free Memory Studio presentation.
- TypeScript and React: not required by the current presentation.
- Qt: possible future technology, not current scope.
- Java: excluded.

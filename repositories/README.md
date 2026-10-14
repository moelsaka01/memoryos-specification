# CCA repository index

The workspace coordinates these repository boundaries:

| Directory | Current milestone |
|---|---|
| [`cca-core`](cca-core) | Released Runtime, Representation, Process, Persistence, and CP-001 through CP-010 MemoryOS implementation |
| [`cca-compiler`](cca-compiler) | IS-002 Standards Compiler and CLI |
| [`memoryos`](memoryos) | Reserved future product-repository boundary; current implementation remains in `cca-core` and `cca-studio` |
| [`cca-studio`](cca-studio) | CP-011 Studio, MemoryOS 1.1 investigation presentation, and MemoryOS 1.2 headless MIP, adapter, Investigation Core, Cognitive Regression, and Explorer modules |
| [`cca-sdk`](cca-sdk) | MO-1204 JavaScript, Python, and C++ SDK facades plus MO-1206 regression and MO-1207 evidence-navigation facades over one private Investigation Core binding |
| [`memoryos-cli`](memoryos-cli) | MO-1205 standalone CLI and JSON Lines automation plus SDK-backed regression reporting and deterministic evidence navigation |
| [`cca-conformance`](cca-conformance) | MO-1208 official CCA-MEMORYOS-1.0 conformance suite and Reference Implementation evidence |
| [`cca-atlas`](cca-atlas) | Reserved; no implementation |

Directory presence does not authorize behavior. The current dependency
direction permits the compiler to use the shared core foundation. The released
foundations and CP-001 through CP-010 MemoryOS capabilities are owned by
`cca-core`; the downstream CP-011 Contract and presentation are owned by
`cca-studio`. MO-1201 and MO-1202 add dependency-free package and settled-source
translation modules there. MO-1203 adds the single execution authority for
native and verified MIP-backed investigations. Provider transport remains
private validation input; the modules import no provider SDK, and the Core does
not synthesize cognition absent from a package. MO-1204 activates `cca-sdk` as
the public programmability boundary. Studio uses its JavaScript facade, while
Python and C++ use the same versioned private Core-host protocol. The SDK owns
no investigation or package behavior.
MO-1205 adds `memoryos-cli` downstream of the SDK. The CLI performs file and
terminal transport, deterministic presentation, and automation only; it does
not import the Core, MIP, Runtime, or renderer.
MO-1206 adds one read-only Cognitive Regression implementation inside the
Investigation Core. The SDK exposes its immutable report, and the CLI consumes
that facade; neither layer recomputes regression facts.
MO-1207 adds one read-only Cognitive Investigation Explorer beside that engine.
Studio, SDK, and CLI render or transport its canonical evidence pointers; none
filters regression evidence or reruns an investigation independently.
MO-1208 activates `cca-conformance` as a behavior-free assessment harness. It
pins the published MemoryOS requirement inventory and verifies the existing
implementation; it does not define or implement MemoryOS semantics.
No repository creates a reverse dependency into the compiler. Reserved
repositories have no approved dependency relationships merely by directory
presence.

The Runtime Foundation consists of exactly Lifecycle Manager, Service
Registry, Dependency Injector, Event Bus, Configuration Manager, and
Observability. Its Runtime, builder, context, state, and host classes are
implementation surfaces around that component set, and logging, diagnostics,
metrics, and health are Observability facets.

See [the repository overview](../docs/repository-overview.md) and
[the authoritative architecture](../ARCHITECTURE.md). The long-term mapping
from these directories to independent version-control repositories remains
unresolved.

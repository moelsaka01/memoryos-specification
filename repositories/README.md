# CCA repository index

The workspace reserves these repository boundaries:

| Directory | Current milestone |
|---|---|
| [`cca-core`](cca-core) | Shared engineering foundation and IM-003 CCA-RF-1.0 Runtime Foundation |
| [`cca-compiler`](cca-compiler) | IS-002 Standards Compiler and CLI |
| [`memoryos`](memoryos) | Reserved; no MemoryOS implementation |
| [`cca-studio`](cca-studio) | Reserved; no implementation |
| [`cca-sdk`](cca-sdk) | Reserved; no implementation |
| [`cca-conformance`](cca-conformance) | Reserved; no implementation |
| [`cca-atlas`](cca-atlas) | Reserved; no implementation |

Directory presence does not authorize behavior. The current dependency
direction permits the compiler to use the shared core foundation. The Runtime
Foundation is owned by `cca-core` and does not depend on compiler or
higher-layer domain interfaces. Reserved repositories have no approved
dependency relationships.

The Runtime Foundation consists of exactly Lifecycle Manager, Service
Registry, Dependency Injector, Event Bus, Configuration Manager, and
Observability. Its Runtime, builder, context, state, and host classes are
implementation surfaces around that component set, and logging, diagnostics,
metrics, and health are Observability facets.

See [the repository overview](../docs/repository-overview.md) and
[the authoritative architecture](../ARCHITECTURE.md). The long-term mapping
from these directories to independent version-control repositories remains
unresolved.

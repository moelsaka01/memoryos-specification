# CCA repository index

The workspace reserves these repository boundaries:

| Directory | Current milestone |
|---|---|
| [`cca-core`](cca-core) | Shared engineering foundation |
| [`cca-compiler`](cca-compiler) | Compiler and CLI skeleton |
| [`memoryos`](memoryos) | Reserved; no MemoryOS implementation |
| [`cca-studio`](cca-studio) | Reserved; no implementation |
| [`cca-sdk`](cca-sdk) | Reserved; no implementation |
| [`cca-conformance`](cca-conformance) | Reserved; no implementation |
| [`cca-atlas`](cca-atlas) | Reserved; no implementation |

Directory presence does not authorize behavior. The current dependency
direction permits the compiler foundation to use the shared core foundation;
reserved repositories have no approved dependency relationships.

See [the repository overview](../docs/repository-overview.md) and
[the authoritative architecture](../ARCHITECTURE.md). The long-term mapping
from these directories to independent version-control repositories remains
unresolved.

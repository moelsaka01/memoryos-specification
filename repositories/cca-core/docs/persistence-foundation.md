# Persistence Foundation

The Persistence Foundation captures a complete, immutable snapshot of a
Representation Workspace. `PersistenceEngine::save` copies the supplied
Workspace, metadata, Policy identifiers, ProcessDefinitions, and execution
context snapshots into a `PersistencePackage`. `validate` checks package
integrity without mutation; `load` validates an available package and returns
an independent restored package.

Persistence is deliberately provider-independent. The package boundary does
not select a file, database, network, compression, or encryption mechanism.
Providers may supply those concerns externally, while the package itself
contains only constitutional Workspace state. Runtime implementation state
(including lifecycle state, registries, Providers, threads, and event buses)
is never persisted.

An `ExecutionContextSnapshot` stores a process-definition index into the
package-owned ProcessDefinition sequence, plus execution state and trace. It
therefore restores execution context identity without duplicating the
ProcessDefinition.

## Minimal usage

```cpp
cca::representation::RepresentationDocument workspace;
cca::persistence::PersistenceMetadata metadata("demo", "example");
cca::persistence::PersistenceEngine engine;

auto saved = engine.save(workspace, metadata);
if (saved.succeeded()) {
    auto restored = engine.load(*saved.package());
}
```

All successful packages expose const access only and preserve insertion order
for semantic objects, metadata, policies, process definitions, and snapshots.

# MemoryOS SDK Developer Guide

## Purpose

MO-1204 exposes MemoryOS through a thin SDK facade while preserving the frozen architecture delivered by MO-1201 through MO-1203. This guide explains how to consume, build, test, and extend the facade without creating a second investigation engine.

## Architecture boundary

```text
external runtime truth
        |
MemoryOS Runtime / adapters
        |
frozen Investigation Core  <--- Trace, Replay, Evolution, Comparison authority
        |
private JavaScript boundary <--- transport and value conversion only
        |
SDK facade                  <--- ownership checks and typed immutable handles
        |
Studio | Python | C++
```

The dependency direction is one way. The Core has no dependency on the SDK. The SDK must not:

- derive identifiers, Reflection selections, Trace steps, or comparison stages;
- compute Replay or Evolution state;
- compare layouts, renderers, or pixels;
- generate MIP content for a native observation;
- reimplement MIP validation or compatibility policy;
- introduce automatic retry of state-changing calls.

## Repository map

```text
repositories/cca-sdk/
|-- bridge/
|   `-- investigation-core-host.mjs   private native/Python host
|-- docs/
|   |-- api-reference.md
|   |-- developer-guide.md
|   `-- conformance-report.md
|-- examples/
|   |-- cpp_quickstart.cpp
|   `-- python/
|-- include/memoryos/memoryos.hpp     public C++23 API
|-- python/
|   |-- src/memoryos/                 public Python package
|   `-- tests/
|-- src/                              native implementation
`-- tests/                            native fixtures and tests
```

The browser facade is located at [`repositories/cca-studio/web/js/memoryos-sdk.js`](../../cca-studio/web/js/memoryos-sdk.js) so Studio can consume it directly as an ES module.

## Prerequisites

| Component | Requirement |
| --- | --- |
| JavaScript facade and binding | Node.js |
| Python SDK | Python 3.12+ and Node.js |
| Native SDK | CMake 3.28+, C++23 compiler, Node.js |
| Native tests | Workspace test dependencies, including GTest |

The Python package has no third-party Python runtime dependency. Python and native C++ still require the installed private host and its exact frozen Core/MIP ESM dependency closure.

## Build the native SDK

The preferred workspace build is:

```sh
cmake --preset default
cmake --build --preset default
```

The target is `memoryos_sdk`; consumers link the alias `memoryos::sdk`.

For a standalone configuration:

```sh
cmake -S repositories/cca-sdk -B out/memoryos-sdk \
  -DBUILD_TESTING=ON \
  -DCCA_BUILD_TESTS=ON \
  -DMEMORYOS_BUILD_CPP_EXAMPLES=ON
cmake --build out/memoryos-sdk
ctest --test-dir out/memoryos-sdk --output-on-failure
```

Make GTest discoverable to CMake when SDK tests are enabled. Disable `BUILD_TESTING` for a dependency-free production library build.

The CMake install step installs the library, public header, private host, and exact Core/MIP JavaScript dependency closure. Runtime path overrides are available for development and nonstandard packages:

```text
MEMORYOS_NODE_EXECUTABLE=/absolute/path/to/node
MEMORYOS_CORE_HOST=/absolute/path/to/investigation-core-host.mjs
```

The C++ `SdkOptions` constructor provides the same overrides explicitly.

## Use the Python SDK from a checkout

PowerShell:

```powershell
$env:PYTHONPATH = "repositories/cca-sdk/python/src"
python repositories/cca-sdk/examples/python/observe.py observation.json
```

POSIX shell:

```sh
PYTHONPATH=repositories/cca-sdk/python/src \
  python3 repositories/cca-sdk/examples/python/observe.py observation.json
```

An installed wheel does not vendor a second Core. When the shared host is outside the source-checkout layout, pass its installed path:

```python
with MemoryOS(
    node_executable="node",
    binding_host="/opt/memoryos/libexec/investigation-core-host.mjs",
) as memory:
    ...
```

Use `MemoryOS` as a context manager or call `close()` deterministically.

## Execute an investigation

### Observe explicit truth

```python
workspace = memory.open_workspace(snapshot["workspaceIdentifier"])
investigation = memory.observe(workspace, snapshot)
```

The snapshot is the truth boundary. The SDK does not fill missing nodes, relationships, observations, or provenance.

The SDK also does not invent observation metadata. When the optional operation
label is omitted, every language binding omits it on the private transport and
the frozen Core applies its own context-specific value (`InitialObservation`
for creation, `Observe` for append). Explicit labels are forwarded unchanged.

A later native observation is appended explicitly to the same authoritative
Investigation; the SDK never polls or samples it:

```python
investigation = investigation.observe(later_snapshot)
```

### Select a Trace

```python
investigation = investigation.trace("exact-source-visible-selection")
```

The exact selector depends on source kind:

- native observations select a Core-visible Reflection node;
- MIP-backed investigations select a source-authored Trace identifier or reference accepted by Core.

### Reconstruct Replay

```python
replay = investigation.replay()
while replay.status != "completed":
    replay = replay.next()
investigation = replay.investigation
```

`replay()` merely obtains the controller for the Replay that Trace already prepared. It neither chooses a Trace nor computes Replay steps. Each command returns an updated immutable handle.

### Enter staged comparison

Native observation pair:

```python
configured = investigation.comparison_session(None)  # explicit native choice
evolution = investigation.compare(configured)
evolution = evolution.next_observation()
comparison = evolution.start(target_node_key="exact-reflection-node-key")
comparison = comparison.next()
```

MIP-backed comparison:

```python
configured = investigation.comparison_session("exact-evolution-identifier")
evolution = investigation.compare(configured)
comparison = evolution.start(
    comparative_identifier="exact-comparative-reconstruction-identifier"
)
```

This is intentionally not one convenience call. The configured request, Evolution stage, observation navigation, Comparative Reconstruction selection, and comparative replay controls remain distinct because those are distinct Core states.

### Capture and restore

```python
checkpoint = investigation.checkpoint()
investigation = investigation.trace("exact-selection")
investigation = memory.restore(checkpoint)
```

A checkpoint is a first-class immutable value, but its restoration token is opaque. It is useful only while its creating private host is alive, and only with the same SDK instance and Investigation. Do not serialize a checkpoint as persistence; use MIP for persistence.

## Import, verify, and export MIP

```python
source_bytes = package_path.read_bytes()

verification = memory.verify_package(source_bytes)
if not verification.valid:
    for diagnostic in verification.diagnostics:
        print(diagnostic)
    raise SystemExit(1)

investigation = memory.import_package(source_bytes)
exported = memory.export_package(investigation)
assert bytes(exported) == source_bytes
```

Package roles stay separate:

- MIP defines canonical serialization, checksums, compatibility, extensions, and diagnostics.
- Core owns the imported Investigation and its deterministic transitions.
- SDK transports exact bytes and presents immutable results.

Omitting the optional supported-extension override during export preserves the
extension policy recorded by Core at import. Passing an explicit empty list is
an explicit request to support no extensions; the SDK does not conflate these
two cases.

Exporting a native observation is invalid. There is no deterministic mapping from arbitrary Studio state to all required MIP sections, so the SDK forwards the Core failure instead of creating content.

## Private host lifecycle

Python and C++ construct one local Node.js host process per `MemoryOS` instance. The process owns exactly one `InvestigationCore` and a private map of real Core checkpoints.

The client:

- sends one versioned request at a time;
- verifies response identity and protocol shape;
- transports package bytes as canonical Base64;
- limits messages to 64 MiB;
- preserves ordered diagnostics;
- does not retry a state-changing request;
- binds Replay controllers to the exact Core Replay identity and rejects stale
  handles before forwarding a command;
- closes the host with the SDK instance.

The JSON Lines protocol documented in [the binding README](../bridge/README.md) is private and may evolve with the SDK implementation. Applications must use a language facade, not invoke the host directly.

## Ownership and concurrency

One SDK instance is one isolation boundary.

- Workspace handles are accepted only by their creating instance.
- Investigation and session handles retain their creating instance.
- Comparison sessions are tied to one Investigation.
- Checkpoints are tied to one instance and Investigation.
- Package bytes are detached values and may be passed to another instance for import or verification.

Calls through one Python/native instance are serialized because Core transitions are ordered. Independent instances have independent hosts and can execute concurrently without shared Investigation state. JavaScript uses one private in-process Core binding per `MemoryOS` object.

## Errors and safe failure

Core transition failures are deterministic domain results expressed as language errors. Transport and framing failures are separate binding errors. A failed operation does not result in a speculative transition, fallback selection, or generated package.

Invalid package verification is not exceptional: it returns an immutable failed `VerificationResult` with ordered MIP diagnostics. Package import still rejects invalid input because no Investigation may be created from it.

## Run the tests

JavaScript facade and Studio/Core parity:

```sh
npm --prefix repositories/cca-studio run test:sdk
```

Python binding, ownership, lifecycle, package, concurrency, and examples:

```powershell
$env:PYTHONPATH = "repositories/cca-sdk/python/src"
python -m unittest discover -s repositories/cca-sdk/python/tests -v
```

Native tests and executable example:

```sh
cmake --build --preset default
ctest --test-dir out/build/default -L memoryos --output-on-failure
```

The complete Studio suite additionally protects the frozen Core, MIP, adapters, and production Studio integration:

```sh
npm --prefix repositories/cca-studio test
```

## Add a future SDK consumer

A new consumer must adapt to this boundary rather than import cognitive engines independently.

1. Use the public facade or the single private host.
2. Represent inputs explicitly and preserve exact identifiers and bytes.
3. Return immutable handles/projections.
4. Preserve every Core lifecycle stage.
5. Keep package verification in MIP.
6. Add parity tests against direct Core behavior.
7. Prove that native MIP export fails without synthesized content.
8. Do not add public semantics to the private transport.

See the [API reference](api-reference.md) for exact language members and the [conformance report](conformance-report.md) for the MO-1204 evidence map.

# MemoryOS SDK

**SDK 1.0.0 · MemoryOS 1.2 · JavaScript · Python 3.12+ · C++23**

The MemoryOS SDK is the public, deterministic facade over the frozen MemoryOS Investigation Core. It gives browser JavaScript, Python, and native C++ consumers one investigation model without copying or reinterpreting cognition.

CCA-MEMORYOS-1.0 standardizes this existing SDK boundary. SDK 1.0.0 is the
baseline assessed as part of the MemoryOS 1.2.0 Reference Implementation; the
SDK implementation and this guide are informative, not the normative Standard.

```text
MemoryOS Runtime
        |
Investigation Core       single execution authority
        |
Private JavaScript binding
        |
MemoryOS SDK
   /       |       \
Studio   Python   Native C++
```

The SDK does not build traces, advance replay independently, compute cognitive regression, navigate regression evidence independently, compare rendered graphs, generate package content, or verify MIP artifacts itself. It forwards explicit commands to the existing authority and returns immutable projections of that authority's state.

## Guarantees

- **One execution authority.** Deterministic investigation behavior remains in the frozen Investigation Core.
- **Explicit inputs.** Observation snapshots, Reflection selections, comparison sessions, checkpoints, and package bytes are caller supplied.
- **Staged comparison.** Cognitive Evolution and Comparative Reconstruction retain the Core's existing lifecycle.
- **Factual regression.** Baseline/candidate comparison is computed once by Investigation Core and transported without reinterpretation.
- **Evidence navigation.** Closed Explorer queries are forwarded to Investigation Core and return exact evidence pointers without replay, inference, or ranking.
- **Exact packages.** Import and export preserve canonical MIP bytes; only MIP-backed investigations can be exported.
- **MIP-owned verification.** Package verification is forwarded to the canonical MIP implementation.
- **Isolated ownership.** Each SDK instance owns one Core instance. Handles and checkpoints cannot cross SDK instances.
- **No presentation semantics.** Layout, animation, UI state, and renderer logic are absent from the SDK.

## Supported consumers

| Consumer | Public entry point | Core connection |
| --- | --- | --- |
| Memory Studio and browser JavaScript | [`memoryos-sdk.js`](../cca-studio/web/js/memoryos-sdk.js) | Private in-process facade |
| Python 3.12+ | [`memoryos`](python/src/memoryos/__init__.py) | One long-lived private host per `MemoryOS` instance |
| C++23 | [`<memoryos/memoryos.hpp>`](include/memoryos/memoryos.hpp) | One long-lived private host per `MemoryOS` instance |

Node.js is required by the native and Python bindings because the frozen Investigation Core is the JavaScript execution authority. The SDK does not vendor a second implementation.

## Deterministic workflow

```text
open Workspace
      |
observe(workspace, snapshot)
      |
trace(explicit Reflection selection)
      |
ReplaySession: play | pause | previous | next | restart | advance
      |
comparisonSession(explicit Evolution id, or explicit null for native truth)
      |
compare(session)
      |
Cognitive Evolution: previous observation | next observation
      |
start(explicit Comparative Reconstruction selection)
      |
Comparative Reconstruction: play | pause | previous | next | reset | advance
```

Session acquisition does not invent a semantic transition. `replay()` opens the already prepared Replay, and `comparisonSession(...)` configures an immutable request. Core state changes only when a command is forwarded.
Replay handles are bound to the exact Core Replay identity; an unprepared or
replaced Replay fails deterministically instead of controlling newer state.

Regression compares two investigations owned by the same SDK instance:

```python
report = memory.regression(baseline, candidate)
assert report.overall in ("identical", "regressionDetected")
```

The fixed Replay, Reflection, Evidence, Retrieval, Evolution, Verification,
Transition, and Lifecycle categories come directly from Investigation Core.
The SDK adds no explanation, heuristic, ranking, or inferred category.

```python
result = memory.investigate(report, InvestigationQuery(category="reflection"))
assert result.status in ("matched", "empty")
```

## Quick start

### JavaScript

```js
import { MemoryOS } from "./memoryos-sdk.js";

const memory = new MemoryOS();
const workspace = memory.openWorkspace(snapshot.workspaceIdentifier);
let investigation = memory.observe(workspace, snapshot);
investigation = investigation.trace("reflection:release-integrity:0");

let replay = investigation.replay();
replay = replay.next();
```

The production integration is Memory Studio itself. See [`app.js`](../cca-studio/web/js/app.js).

### Python

```python
from memoryos import MemoryOS

with MemoryOS() as memory:
    workspace = memory.open_workspace(snapshot["workspaceIdentifier"])
    investigation = memory.observe(workspace, snapshot)
    investigation = investigation.trace("reflection:release-integrity:0")
    replay = investigation.replay().next()
```

From the workspace root:

```powershell
$env:PYTHONPATH = "repositories/cca-sdk/python/src"
python repositories/cca-sdk/examples/python/verify.py investigation.mip
```

See all [Python examples](examples/python/) and the [Python package guide](python/README.md).

### C++

```cpp
#include <memoryos/memoryos.hpp>

memoryos::MemoryOS memory;
const auto workspace = memory.openWorkspace("workspace-release");
auto investigation = memory.observe(workspace, snapshotJson);
investigation = investigation.trace("reflection:release-integrity:0");
const auto replay = investigation.replay().next();
```

Link the CMake target `memoryos::sdk` (the compatibility alias `cca::sdk` is also available). See the [complete C++ quick start](examples/cpp_quickstart.cpp).

## Build and test

Prerequisites:

- CMake 3.28 or newer
- a C++23 compiler
- Node.js available as `node`
- Python 3.12 or newer for the Python SDK and its tests
- the workspace test dependencies when building the C++ test target

Build the complete workspace:

```sh
cmake --preset default
cmake --build --preset default
ctest --preset default
```

Run the SDK-focused suites from the workspace root:

```powershell
npm --prefix repositories/cca-studio run test:sdk

$env:PYTHONPATH = "repositories/cca-sdk/python/src"
python -m unittest discover -s repositories/cca-sdk/python/tests -v

ctest --test-dir out/build/default -L memoryos --output-on-failure
```

For a standalone native build, configure `repositories/cca-sdk` with `BUILD_TESTING=ON` and make GTest discoverable to CMake. The native default checks the source host and then the configured installation data directory. Use `MEMORYOS_NODE_EXECUTABLE` and `MEMORYOS_CORE_HOST` to override those paths at runtime.

## Package boundary

`MemoryInvestigationPackage` is an immutable owner of exact canonical MIP bytes.

- `importPackage` / `import_package` imports caller-supplied bytes through the Core.
- `exportPackage` / `export_package` succeeds only for an investigation originally backed by a valid MIP artifact.
- Export of a native Studio observation fails safely with deterministic Core diagnostics; the SDK never manufactures the missing package sections.
- `verifyPackage` / `verify_package` forwards bytes and supported-extension declarations to the canonical MIP verifier.
- Unknown or unsupported package content is handled by MIP policy, not SDK policy.

## Private binding boundary

[`bridge/investigation-core-host.mjs`](bridge/investigation-core-host.mjs) is an internal transport, not a public service or alternate API. Python and C++ each start one long-lived local host for every `MemoryOS` object. Calls on one instance are serialized; separate instances own separate Core state and may run independently.

The host performs framing, canonical transport serialization, Base64 byte transport, and error forwarding only. It contains no cognition, Trace, Replay, Evolution, Comparative Reconstruction, or package-verification semantics.

## Documentation

- [API reference](docs/api-reference.md)
- [Developer guide](docs/developer-guide.md)
- [Cognitive Regression guide](docs/regression-guide.md)
- [Cognitive Investigation Explorer guide](docs/explorer-guide.md)
- [MO-1207 Explorer conformance](docs/explorer-conformance-report.md)
- [SDK conformance report](docs/conformance-report.md)
- [Official MemoryOS Standard conformance suite](../cca-conformance/README.md)
- [Private binding contract](bridge/README.md)
- [Python package guide](python/README.md)

## Scope

The SDK exposes only closed Cognitive Investigation navigation queries. It does not add general query execution, convenience inference, adapters, networking, REST, CLI behavior, or renderer behavior. Investigation Core remains the sole regression and evidence-navigation authority.

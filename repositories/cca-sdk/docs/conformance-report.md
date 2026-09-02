# MO-1204 / MO-1206 SDK Conformance Report

## Assessment

The MemoryOS SDK conforms to the MO-1204 facade boundary and the MO-1206 extension: the frozen Investigation Core remains the only deterministic investigation and regression authority, MIP remains the package authority, and the JavaScript, Python, and C++ SDKs expose the same explicit lifecycle and factual regression report without duplicating semantic behavior.

This report maps the implementation to the milestone contract. Test counts and command outcomes belong in release validation; this document identifies enduring evidence rather than copying transient console output.

## Authority preservation

| Requirement | Implementation evidence | Status |
| --- | --- | --- |
| Core remains frozen and authoritative | SDK imports or hosts [`investigation-core.js`](../../cca-studio/web/js/investigation-core.js); no Core copy exists under `cca-sdk` | Conformant |
| Core does not depend on SDK | Core module has no SDK import; dependency direction is SDK to Core | Conformant |
| MIP owns package verification | JavaScript forwards to [`verifyMemoryInvestigationPackage`](../../cca-studio/web/js/memory-investigation-package.js); the private host invokes the same verifier for Python/C++ | Conformant |
| Adapters remain translators | SDK introduces no adapter or external-runtime mapping behavior | Conformant |
| Studio consumes public SDK | [`app.js`](../../cca-studio/web/js/app.js) imports [`memoryos-sdk.js`](../../cca-studio/web/js/memoryos-sdk.js), not Investigation Core | Conformant |

## Facade and binding

| Requirement | Implementation evidence | Status |
| --- | --- | --- |
| One public facade | JavaScript `MemoryOS`, Python `memoryos.MemoryOS`, and C++ `memoryos::MemoryOS` expose the common object model | Conformant |
| Exactly one long-lived private native binding | [`investigation-core-host.mjs`](../bridge/investigation-core-host.mjs) is shared by Python and C++; each `MemoryOS` instance owns one host | Conformant |
| Binding is internal | Host is documented as private; applications consume language APIs | Conformant |
| Binding adds no semantics | Host dispatches Core/MIP operations, transports bytes, manages live checkpoint tokens, and canonicalizes protocol responses only | Conformant |
| No duplicated cognition | No Trace, Replay, Evolution, Comparative Reconstruction, or Cognitive Regression engine exists under `cca-sdk` | Conformant |
| Core-owned regression | SDK methods forward two owned Investigation identifiers to `InvestigationCore.regression()` and return its immutable report | Conformant |
| Renderer independence | SDK has no canvas, DOM rendering, layout, animation, or pixel comparison dependency | Conformant |

## Explicit deterministic operations

| Contract | Evidence | Status |
| --- | --- | --- |
| `observe(workspace, snapshot)` | All languages require an owned Workspace and explicit snapshot | Conformant |
| `trace(reflectionSelection)` | All languages reject absent or empty selection | Conformant |
| `compare(comparisonSession)` | All languages require an explicitly configured, owned session | Conformant |
| `restore(checkpoint)` | Restore requires an immutable, opaque, owned Checkpoint | Conformant |
| `exportPackage(mipBackedInvestigation)` | Export forwards through Core and fails for native observations | Conformant |
| `importPackage(package)` | Exact caller bytes are imported; no package content is generated | Conformant |
| `verifyPackage(package)` | Exact caller bytes reach the MIP verifier | Conformant |
| `regression(baseline, candidate)` | Exact owned Investigation identities reach the Core; no SDK comparison is performed | Conformant |
| No inferred comparison source | Native callers explicitly pass null/`None`/`std::nullopt`; MIP callers pass an exact Evolution identifier | Conformant |
| No inferred reconstruction target | Native and MIP start operations require their exact, source-appropriate selector | Conformant |
| Replay identity | Acquisition requires a prepared Replay; commands reject a handle after Core replaces that Replay | Conformant |

`replay()` is a controller acquisition over Replay already prepared by `trace`; it does not perform a semantic choice. `comparisonSession(...)` similarly creates an immutable configured request and requires an explicit argument. Replay and comparison control methods forward exact Core actions and do not synthesize state.

## Staged lifecycle preservation

The SDK exposes the existing Core stages without collapsing them:

```text
Observation
  -> Trace selection
  -> Replay control
  -> configured ComparisonSession
  -> Evolution entry
  -> observation navigation
  -> explicit Comparative Reconstruction selection
  -> comparative replay control
  -> return
```

| Core stage | JavaScript | Python | C++ |
| --- | --- | --- | --- |
| Configure native Evolution | `comparisonSession(null)` | `comparison_session(None)` | `comparisonSession(std::nullopt)` |
| Configure MIP Evolution | `comparisonSession(id)` | `comparison_session(id)` | `comparisonSession(optional{id})` |
| Enter Evolution | `compare(session)` | `compare(session)` | `compare(session)` |
| Select observations | `previousObservation`, `nextObservation` | `previous_observation`, `next_observation` | `previousObservation`, `nextObservation` |
| Start native reconstruction | `start({targetNodeKey})` | `start(target_node_key=...)` | `start(selection)` |
| Start MIP reconstruction | `start({comparativeIdentifier})` | `start(comparative_identifier=...)` | `startPackage(identifier)` |
| Control reconstruction | play, pause, previous, next, reset, advance | same | same |
| Return | `back` | `back` | `back` |

## Package integrity

| Guarantee | Evidence | Status |
| --- | --- | --- |
| Exact byte ownership | Package values own immutable byte sequences | Conformant |
| Byte-for-byte import/export | Facades use canonical Base64 only at the private transport boundary and return decoded original bytes | Conformant |
| Native export rejection | No Studio-to-MIP mapper exists in the SDK; Core rejection is preserved | Conformant |
| Ordered diagnostics | MIP diagnostic arrays retain source ordering across all language projections | Conformant |
| MIP-owned invalid input | Empty and malformed package bytes reach MIP verification and return failed verification evidence | Conformant |
| Extension policy | Supported-extension declarations are caller supplied and forwarded to MIP | Conformant |
| No presentation leakage | SDK package code introduces no screenshot, video, renderer, layout, or UI state | Conformant |

## Ownership, immutability, and failure

| Guarantee | Evidence | Status |
| --- | --- | --- |
| Immutable public state | JavaScript freezes public values; Python uses frozen dataclasses/maps; C++ uses shared immutable implementations and value handles | Conformant |
| Workspace isolation | Foreign Workspace handles are rejected | Conformant |
| Investigation isolation | Foreign Investigation/session handles are rejected | Conformant |
| Regression ownership | Python and C++ reject either foreign input before transport; Core rejects cross-Workspace or mixed-source comparisons | Conformant |
| Checkpoint integrity | Host retains real Core checkpoint objects behind opaque tokens; token, instance, and Investigation ownership are validated | Conformant |
| Deterministic call order | One client serializes calls to one Core; separate instances are isolated | Conformant |
| Atomic failure | Transport performs no automatic replay or retry of state-changing requests | Conformant |
| Stable diagnostics | Domain errors preserve code, operation, message, and ordered diagnostics | Conformant |

## Validation evidence

| Surface | Automated evidence |
| --- | --- |
| JavaScript facade | [`memoryos_sdk_test.mjs`](../../cca-studio/tests/memoryos_sdk_test.mjs) checks facade/Core parity, cross-language initial/append digests, explicit comparison, ownership, checkpoints, package bytes, and Studio import boundaries |
| Production Studio | [`memory_studio_integration_test.mjs`](../../cca-studio/tests/memory_studio_integration_test.mjs) verifies the UI workflow while Studio consumes the SDK |
| Python | [`test_memoryos_sdk.py`](../python/tests/test_memoryos_sdk.py) and [`test_examples.py`](../python/tests/test_examples.py) cover binding, lifecycle, regression determinism and ownership, packages, errors, concurrency, and executable examples |
| Native C++ | [`memoryos_sdk_test.cpp`](../tests/memoryos_sdk_test.cpp) covers public handles, Core delegation, regression determinism and ownership, lifecycle, package byte identity, diagnostics, and client isolation |
| Executable native usage | [`cpp_quickstart.cpp`](../examples/cpp_quickstart.cpp) and [`cpp_regression.cpp`](../examples/cpp_regression.cpp) are built and registered with CTest |
| Frozen authorities | The complete Studio test command retains Core, MIP, adapter, and Studio regression suites |

Run the validation commands from the [developer guide](developer-guide.md).

## Deliberate non-capabilities

MO-1204 does not implement:

- query execution (`InvestigationQuery` is reserved only);
- automatic Reflection selection;
- Replay generation or step derivation;
- flattened one-call comparison;
- native-observation MIP synthesis;
- package compatibility or verification policy;
- runtime adapters;
- renderer or Studio presentation behavior;
- network, service, REST, CLI, or MCP transports.

These omissions preserve, rather than reduce, conformance: the SDK exposes existing platform behavior and introduces no new investigation semantics.

## Conclusion

The implementation maintains one deterministic investigation and regression authority across Memory Studio, Python, and native C++. Every public operation either reads an immutable Core projection or forwards one explicit Core/MIP command. No duplicated investigation or regression behavior exists in the SDK layer.

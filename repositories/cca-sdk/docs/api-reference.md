# MemoryOS SDK API Reference

This reference describes the public SDK facade through MO-1301 Investigation Policies. Investigation Core remains authoritative for investigation semantics; the Policy Engine remains authoritative for Policy semantics. MIP remains authoritative for package verification and canonical package bytes.

The facade version is `1.1.0`, exposed as `MEMORYOS_SDK_VERSION` in JavaScript, `SDK_VERSION` / `memoryos.__version__` in Python, and `memoryos::sdkVersion` in C++. This SDK version is independent of artifact, fact-model, evaluator, and MIP versions.

## Common object model

All state-bearing SDK values are immutable handles or immutable projections.

| Concept | Meaning | Ownership |
| --- | --- | --- |
| `MemoryOS` | One isolated SDK client and Investigation Core lifetime | Application |
| `Workspace` | Explicit Workspace identity | One `MemoryOS` instance |
| `Investigation` | Current immutable projection and command handle | One `MemoryOS` instance |
| `ReplaySession` | Command handle for the already prepared Replay | One Investigation |
| `ComparisonSession` | Staged Evolution / Comparative Reconstruction handle | One Investigation |
| `Checkpoint` | Opaque restoration handle over an intact Core checkpoint | One `MemoryOS` instance and Investigation |
| `MemoryInvestigationPackage` | Detached immutable canonical MIP bytes | Freely copyable as data |
| `VerificationResult` | Immutable Core or MIP verification evidence | Detached result |
| `RegressionReport` | Immutable factual report produced by Investigation Core | Detached result; inputs must share one `MemoryOS` instance |
| `InvestigationQuery` | Closed optional category, Reflection, or transition selectors | Detached immutable value |
| `InvestigationResult` | Ordered exact pointers into one Regression report | Detached immutable Core result |
| `PreparedPolicy` | Validated Policy or Policy Set plus exact canonical bytes and both digests | Detached and freely transferable |
| `AuthoritativePolicyFactContext` | Opaque trusted Core-capture capability plus inspectable exact bytes | One `MemoryOS` instance |
| `AuthoritativeRegressionPolicyFacts` | Atomic candidate context and Regression source capability pair | One `MemoryOS` instance |
| `PolicyEvaluation` | Exact Evaluation Identity and normative outcome bytes/digests | Detached immutable result |
| `PolicyArtifactVerification` | Successful inspection-only or authoritative-reconstruction verification | Detached immutable result |

Owner-bound handles and authoritative capabilities created by one `MemoryOS` instance cannot be used to mutate or authorize another instance. Detached values, including a prepared Policy/Set, remain transferable. A checkpoint additionally must match the Investigation from which it was captured.

## Investigation Policy operations

All three languages expose the same synchronous operation set, using camel case
in JavaScript/C++ and snake case in Python:

`preparePolicy`, `preparePolicySet`, `inspectPolicyFactContext`,
`inspectRegressionPolicyFactSource`, `inspectRegressionReport`,
`capturePolicyFactContext`, `captureRegressionPolicyFacts`, `evaluatePolicy`,
`evaluatePolicySet`, `verifyEvaluationIdentityArtifact`,
`verifyEvaluationIdentityForEvaluation`,
`verifyPolicyEvaluationOutcomeArtifact`,
`verifyPolicyEvaluationOutcomeForEvaluation`, and `policyContractIdentities`.

Evaluation accepts only a prepared Policy/Set, an authoritative context from
the same SDK instance, and zero or one authoritative Regression source bound to
that exact candidate context. Inspection parses detached artifacts but never
mints authority. Evaluations expose exact evaluator-produced identity and
outcome bytes; bindings must not reconstruct these bytes.

### Policy request and result contracts

| Operation | Input | Result |
| --- | --- | --- |
| Prepare | Policy or Policy Set bytes | Immutable `PreparedPolicy` carrying exact canonical bytes, artifact kind/version/identifier, `documentDigest`, and `semanticDigest` |
| Inspect context/source/report | Exact serialized bytes and, where applicable, an optional expected digest | Immutable inspection-only value with exact bytes and the verified context/source/report identity |
| Capture context | Owner-matched `Investigation` | Owner-bound `AuthoritativePolicyFactContext` |
| Capture Regression facts | Owner-matched baseline and candidate `Investigation` handles | Atomic `AuthoritativeRegressionPolicyFacts` context/source pair |
| Evaluate | Prepared Policy/Set, authoritative context, and optional authoritative Regression source | Immutable `PolicyEvaluation` with parsed outcome, exact outcome and Evaluation Identity bytes, both digests, decision, and cache disposition |
| Verify serialized artifact | Exact identity/outcome bytes plus the frozen optional expected digest/identity inputs | `PolicyArtifactVerification` with `authority: inspectionOnly` |
| Verify for evaluation | Exact identity/outcome bytes plus the same authoritative evaluation request | `PolicyArtifactVerification` with `authority: authoritativeReconstruction` |
| Inspect identities | No input | Exact immutable `MemoryOSPolicyContractIdentities` projection |

JavaScript and C++ use the camel-case names listed above. Python uses their
one-to-one snake-case equivalents. Serialized SDK inputs are bytes, never paths,
URLs, mappings, file-like values, or provider callbacks. Evaluation options are
closed to the optional Regression source; profile, registry, evaluator, rule,
selector, and resource-limit overrides do not exist.

PASS, FAIL, rule CNE, and resource CNE are successful `PolicyEvaluation`
values. They are not exceptions. Prepared Policy/Set values are detached and
transferable; context/source authority is owner-bound, and serialization or
digest verification never recreates it.

## Required explicit operations

### Observe

```text
observe(workspace, snapshot)
```

`workspace` is an SDK-owned Workspace and `snapshot` is a complete caller-supplied CCA-STUDIO observation snapshot. The SDK does not sample a runtime, discover a Workspace, or create missing observation truth.

### Trace

```text
trace(reflectionSelection)
```

The selection must identify one exact Core-visible Reflection (native source) or one exact source-authored Trace (MIP source). Empty, absent, or inferred selections are rejected.

### Compare

```text
comparisonSession(evolutionIdentifierOrExplicitNull)
compare(comparisonSession)
```

Creating a session performs no transition. Native investigations require an explicit `null` / `None` / `std::nullopt` to select the Core's current observation pair. MIP investigations require the exact source-authored Cognitive Evolution identifier. `compare(session)` forwards the Core `enter` transition.

The activated session exposes the unchanged staged lifecycle:

1. `previousObservation` / `nextObservation` selects an observation while in Evolution.
2. `start` selects a native Reflection target, or the language-specific package-start operation selects an exact Comparative Reconstruction identifier.
3. `play`, `pause`, `previous`, `next`, `reset`, and `advance` control Comparative Reconstruction.
4. `back` forwards the Core's return transition.

### Restore

```text
restore(checkpoint)
```

The argument must be an actual immutable `Checkpoint` issued by the same SDK instance for the same Investigation. Serialized checkpoint metadata is not a restoration credential.

### Cognitive Regression

```text
regression(baselineInvestigation, candidateInvestigation)
```

Both handles must belong to the same SDK instance. The facade forwards their
identifiers to the authoritative Core and returns its closed, immutable
`MemoryOSCognitiveRegressionReport` version `1.0.0`. Category order is fixed:
Replay, Reflection, Evidence, Retrieval, Evolution, Verification, Transition,
and Lifecycle. The SDK performs no comparison logic and adds no interpretation.

### Cognitive Investigation Explorer

```text
investigate(regressionReport, investigationQuery)
```

The Core validates the report and returns matches in fixed Regression category
and difference order. The closed query contains only `category`,
`reflectionIdentifier`, and `transition`. Navigation does not load or replay
the source investigations.

### Package operations

```text
importPackage(package)
exportPackage(mipBackedInvestigation)
verifyPackage(package)
```

Import and verification accept exact package bytes. Export is defined only for an imported, MIP-backed Investigation. A native observation has no canonical MIP source and fails export without synthesized content.

## JavaScript

Import from [`memoryos-sdk.js`](../../cca-studio/web/js/memoryos-sdk.js):

```js
import {
  Checkpoint,
  ComparisonSession,
  Investigation,
  InvestigationQuery,
  InvestigationResult,
  MemoryInvestigationPackage,
  MemoryOS,
  RegressionReport,
  ReplaySession,
  VerificationResult,
  Workspace,
} from "./memoryos-sdk.js";
```

### `MemoryOS`

| Member | Result | Notes |
| --- | --- | --- |
| `new MemoryOS()` | `MemoryOS` | Creates one private in-process Core binding. |
| `openWorkspace(identifier)` | `Workspace` | `identifier` must be non-empty. |
| `observe(workspace, snapshot, options = {})` | `Investigation` | Snapshot is mandatory; options contain source metadata only. |
| `importPackage(bytesOrPackage, options = {})` | `Investigation` | Imports exact bytes through Core and MIP. |
| `exportPackage(investigation, options = {})` | `MemoryInvestigationPackage` | MIP-backed investigations only. |
| `verifyPackage(bytesOrPackage, options = {})` | `VerificationResult` | MIP-owned verification; invalid input yields `valid === false`. |
| `regression(baseline, candidate)` | `RegressionReport` | Core-owned factual comparison; both investigations must be owned by this instance. |
| `investigate(report, query = {})` | `InvestigationResult` | Core-owned read-only evidence navigation. |
| `restore(checkpoint)` | `Investigation` | Checkpoint must belong to this instance. |

Package options may include `supportedExtensions`. Import options may also include an explicit Investigation identifier. `MemoryInvestigationPackage.toBytes()` returns a detached `Uint8Array` copy.

### `Investigation`

Read-only members include `identifier`, `workspaceIdentifier`, `lifecycle`, `phase`, `availability`, `view`, and `transitionLog`.

| Member | Result | Core effect |
| --- | --- | --- |
| `refresh()` | `Investigation` | Loads the current projection; no transition. |
| `observe(snapshot, options = {})` | `Investigation` | Appends an explicit observation. |
| `trace(reflectionSelection)` | `Investigation` | Selects Trace and prepares Replay. |
| `replay()` | `ReplaySession` | Opens the prepared Replay; no new Replay is synthesized. |
| `comparisonSession(evolutionIdentifier)` | `ComparisonSession` | Configures a request; the argument is required and may be explicit `null` for native truth. |
| `compare(session)` | `ComparisonSession` | Enters Core Evolution. |
| `verify()` | `VerificationResult` | Appends Core investigation verification. |
| `checkpoint()` | `Checkpoint` | Captures an opaque Core checkpoint. |
| `restore(checkpoint)` | `Investigation` | Restores an owned checkpoint. |
| `returnToWorld()` | `Investigation` | Forwards Core return-to-world. |
| `archive()` | `Investigation` | Forwards Core archive. |

### `ReplaySession`

Read-only members are `investigation`, `replay`, `state`, and `view`. Every command returns the same session handle after Core state has advanced:

```text
play()  pause()  restart()  previous()  next()  advance()
```

### `ComparisonSession`

Read-only members are `investigation`, `lifecycle`, `evolution`, `reconstruction`, `state`, and `view` after activation.

```js
const configured = investigation.comparisonSession(null); // explicit native pair
let comparison = investigation.compare(configured);
comparison = comparison.previousObservation();
comparison = comparison.nextObservation();
comparison = comparison.start({ targetNodeKey: "reflection:key" });
comparison = comparison.next();
comparison = comparison.back();
```

For MIP-backed cognition, pass the exact Evolution identifier to `comparisonSession(...)`, then call `start({ comparativeIdentifier: "..." })`.

## Python

Import from `memoryos`:

```python
from memoryos import (
    Checkpoint,
    ComparisonSession,
    Investigation,
    InvestigationQuery,
    InvestigationResult,
    MemoryInvestigationPackage,
    MemoryOS,
    MemoryOSError,
    MemoryOSBindingError,
    RegressionReport,
    ReplaySession,
    VerificationResult,
    Workspace,
)
```

### `MemoryOS`

```python
MemoryOS(*, node_executable="node", binding_host=None)
```

The object owns one long-lived private Core host and supports the context-manager protocol. `close()` releases the host.

| Member | Result |
| --- | --- |
| `open_workspace(identifier)` | `Workspace` |
| `observe(workspace, snapshot, *, identifier=None, operation=None, query=None, result_code="OK")` | `Investigation` |
| `import_package(package_or_bytes, *, identifier=None, supported_extensions=())` | `Investigation` |
| `export_package(investigation, *, supported_extensions=None)` | `MemoryInvestigationPackage` |
| `verify_package(package_or_bytes, *, supported_extensions=())` | `VerificationResult` |
| `regression(baseline, candidate)` | `RegressionReport` |
| `investigate(report, query=None)` | `InvestigationResult` |
| `restore(checkpoint)` | `Investigation` |

`MemoryInvestigationPackage.data` contains immutable `bytes`; `bytes(package)` returns the same bytes. `VerificationResult` exposes `valid`, `status`, ordered `checks` or `diagnostics`, and the verified `package` when applicable.

`RegressionReport` exposes `identifier`, `regression_detected`, `overall`, and
the complete immutable Core `projection`. `overall` is exactly `identical` or
`regressionDetected`; it is never a generated explanation.

An omitted Python `operation` (or an empty C++ `ObserveOptions::operation`)
is not replaced by SDK behavior. The binding omits the field so the frozen Core
applies its context-specific contract: `InitialObservation` for creation and
`Observe` for an appended observation. Any explicit non-empty value is forwarded
unchanged.

### `Investigation`

The immutable projection exposes `identifier`, `workspace_identifier`, `lifecycle`, `phase`, `source_kind`, `availability`, `projection`, `transition_log_digest`, and `transition_count`.

```text
refresh()
observe(snapshot, *, operation=None, query=None, result_code="OK")
trace(selection)
replay()
comparison_session(evolution_identifier)
compare(session)
verify()
checkpoint()
restore(checkpoint)
archive()
return_to_world()
```

### `ReplaySession`

`replay_identifier`, `state`, `status`, and `cursor` are read-only projections.
The identifier binds the handle to the Replay that was active at acquisition;
commands reject a handle after Core replaces that Replay. Commands return a
new immutable session:

```text
play()  pause()  restart()  previous()  next()  advance()
```

### `ComparisonSession`

```python
configured = investigation.comparison_session(None)  # explicit native pair
comparison = investigation.compare(configured)
comparison = comparison.previous_observation()
comparison = comparison.next_observation()
comparison = comparison.start(target_node_key="reflection:key")
comparison = comparison.next()
investigation = comparison.back()
```

For a MIP-backed Investigation, pass an exact Evolution identifier to `comparison_session(...)` and an exact `comparative_identifier` to `start(...)`. The two selectors are mutually exclusive. `stage` reports `"configured"` before entry and the Core phase after entry.

## Native C++

Header:

```cpp
#include <memoryos/memoryos.hpp>
```

CMake target: `memoryos::sdk` (alias `cca::sdk`). Namespace: `memoryos`.

### `MemoryOS`

```cpp
MemoryOS();
explicit MemoryOS(SdkOptions options);

Workspace openWorkspace(std::string identifier) const;
Investigation observe(const Workspace&, std::string snapshotJson,
                      ObserveOptions = {}) const;
Investigation importPackage(const MemoryInvestigationPackage&,
                            ImportOptions = {}) const;
MemoryInvestigationPackage exportPackage(
    const Investigation&,
    std::optional<std::vector<std::string>> supportedExtensions = std::nullopt) const;
VerificationResult verifyPackage(
    const MemoryInvestigationPackage&,
    std::vector<std::string> supportedExtensions = {}) const;
RegressionReport regression(
    const Investigation& baseline,
    const Investigation& candidate) const;
InvestigationResult investigate(
    const RegressionReport& report,
    InvestigationQuery query = {}) const;
Investigation restore(const Checkpoint&) const;
```

`SdkOptions` selects the Node executable and private host path. The default
constructor checks the environment override, then the source-checkout host,
then the host under CMake's configured installation data directory. The
environment variables `MEMORYOS_NODE_EXECUTABLE` and `MEMORYOS_CORE_HOST`
remain explicit overrides.

`RegressionReport` is an immutable value handle exposing `identifier()`,
`regressionDetected()`, `overall()`, and `canonicalJson()`. The canonical JSON
is the exact structured Core report, including source descriptors, fixed
categories, and ordered factual differences.

`InvestigationResult` exposes `identifier()`, `regressionIdentifier()`,
`workspaceIdentifier()`, `status()`, `matchCount()`, and `canonicalJson()`.

### `Investigation`

Read accessors expose identifier, Workspace identifier, lifecycle, phase, transition-log digest/count, and the complete canonical JSON projection.

```cpp
Investigation observe(std::string snapshotJson,
                      ObserveOptions = {}) const;
Investigation trace(std::string exactSelection) const;
ReplaySession replay() const;
ComparisonSession comparisonSession(
    std::optional<std::string> evolutionIdentifier) const;
ComparisonSession compare(const ComparisonSession&) const;
VerificationResult verify() const;
Checkpoint checkpoint() const;
Investigation restore(const Checkpoint&) const;
Investigation archive() const;
Investigation returnToWorld() const;
```

### `ReplaySession`

```text
investigation()  play()  pause()  restart()  previous()  next()  advance()
```

All commands return a new immutable session containing the updated
Investigation projection. Acquisition fails until Replay is prepared. Each
session is bound to that exact Replay identity and cannot control a replacement
Replay.

### `ComparisonSession`

```cpp
auto configured = investigation.comparisonSession(std::nullopt);
auto comparison = investigation.compare(configured);
comparison = comparison.previousObservation();
comparison = comparison.nextObservation();
comparison = comparison.start("reflection:key");
comparison = comparison.next();
comparison = comparison.back();
```

For MIP-backed cognition, pass `std::optional<std::string>{evolutionId}` and call `startPackage(comparativeId)`. Additional controls are `play`, `pause`, `previous`, `next`, `reset`, and `advance`.

`Checkpoint` exposes only an opaque identifier, its Investigation identifier, and diagnostic canonical JSON. It remains bound to its creating client.

## Error contract

Core rejections preserve stable error `code`, `operation`, message, and ordered diagnostics.

- JavaScript forwards `InvestigationCoreError` for Core transitions and uses `TypeError` for non-Policy facade ownership/input violations.
- Python raises `MemoryOSError` for Core failures and `MemoryOSBindingError` for local transport/protocol failures. Invalid package verification returns `VerificationResult(valid=False)`.
- C++ throws `memoryos::SdkError`; access `code()`, `operation()`, and `diagnostics()`. Invalid package verification returns `VerificationResult::valid() == false`.

Binding failures never trigger a retry that could duplicate a transition. Callers decide whether and how to recover.

Policy artifact/input failures use the shared immutable semantic fields
`code`, `phase`, `artifactKind`, and `limitIdentifier` (Python exposes the last
two idiomatically as `artifact_kind` and `limit_identifier`). JavaScript raises
`MemoryOSPolicyPreparationError`, Python raises
`MemoryOSPolicyPreparationError`, and C++ exposes the same record through
`SdkError::preparationFailure()`. Every frozen CF1-CF6 stable code passes
through unchanged.

Policy runtime, bridge, allocation, filesystem, verification, and internal
invariant failures remain operational and never fabricate a Policy decision.
JavaScript/Python expose `MemoryOSPolicyOperationalError`; C++ retains
`SdkError` with `failureClass()` and `verificationFailure()`. Human messages and
details are presentation-only. Source-language type/overload misuse remains a
programmer error. A detached, missing-capability, or foreign-owner Policy fact
context instead raises the preparation code
`POLICY_FACT_CONTEXT_PROVENANCE_UNTRUSTED`; the corresponding Regression source
condition raises `DETERMINISTIC_FACT_SOURCE_PROVENANCE_UNTRUSTED`. Context
authority is checked before source authority. A same-owner source bound to a
different same-owner context remains
`REGRESSION_POLICY_FACT_SOURCE_CANDIDATE_BINDING_MISMATCH`.

# MemoryOS Python SDK 1.1

The Python SDK is a thin, typed client for the authoritative MemoryOS
Investigation Core. It does not build traces, advance replay, compute regression,
navigate regression evidence, verify packages, or derive identifiers itself. Those operations remain owned by
the existing Investigation Core and MIP implementation.

Python 3.12 or newer and Node.js are required. The package has no Python runtime
dependencies.

## Source-checkout quick start

```powershell
$env:PYTHONPATH = "repositories/cca-sdk/python/src"
python repositories/cca-sdk/examples/python/verify.py investigation.mip
```

```sh
PYTHONPATH=repositories/cca-sdk/python/src \
  python3 repositories/cca-sdk/examples/python/verify.py investigation.mip
```

The source-checkout default locates the single private binding host at
`repositories/cca-sdk/bridge/investigation-core-host.mjs`. The host imports the
authoritative Core and MIP modules from `cca-studio`; no cognition source is
copied into the Python package.

An installed wheel therefore requires the platform installation to provide the
shared binding host and its `cca-studio` module closure. Pass that installed path
explicitly:

```python
from memoryos import MemoryOS

memory = MemoryOS(
    node_executable="node",
    binding_host="/opt/memoryos/libexec/investigation-core-host.mjs",
)
```

The Python wheel deliberately does not vendor a second Investigation Core.

## Investigation Policies

SDK 1.1 adds synchronous, typed operations for Policy and Policy Set
preparation, trusted fact capture, evaluation, artifact verification, and
contract-identity inspection. Python transports exact Base64-encoded canonical
bytes to the shared JavaScript evaluator; it does not implement Policy rules,
digests, aggregation, or evidence semantics.

```python
with MemoryOS() as memory:
    prepared = memory.prepare_policy(policy_bytes)
    context = memory.capture_policy_fact_context(investigation)
    evaluation = memory.evaluate_policy(prepared, context)
    assert bytes(evaluation) == evaluation.canonical_outcome_bytes
```

`inspect_policy_fact_context()` and
`inspect_regression_policy_fact_source()` return detached inspection values.
Only capabilities returned by `capture_policy_fact_context()` or the atomic
`capture_regression_policy_facts()` operation may be evaluated.

## Explicit investigation flow

```python
import json
from memoryos import MemoryOS

with MemoryOS() as memory:
    workspace = memory.open_workspace("workspace-demo")
    with open("observation.json", encoding="utf-8") as stream:
        investigation = memory.observe(workspace, json.load(stream))

    # A later frame remains part of the same authoritative transition log.
    with open("observation-2.json", encoding="utf-8") as stream:
        investigation = investigation.observe(json.load(stream))

    investigation = investigation.trace("exact-reflection-node-key")
    replay = investigation.replay()
    while replay.status != "completed":
        replay = replay.next()
```

Observation requires explicit CCA-STUDIO-1.0 snapshot truth. Trace requires an
exact Core-visible selector. The SDK supplies neither a default observation nor
a default Reflection.

A Replay controller is available only after Trace prepares one. It remains
bound to that exact Core Replay identity and rejects commands if a later
observation replaces the Replay.

Comparison is deliberately staged and session-owned:

```python
request = investigation.comparison_session("exact-evolution-id")
evolution = investigation.compare(request)
comparison = evolution.start(comparative_identifier="exact-comparative-id")
comparison = comparison.next()
```

For native cognition, the caller explicitly passes `None` to
`comparison_session(None)` to choose the Core's current observation pair, then
passes an exact `target_node_key` to `start()`.

Two investigations owned by the same `MemoryOS` instance may be compared by
the Core's deterministic Cognitive Regression operation:

```python
report = memory.regression(baseline, candidate)
print(report.overall)
for category in report.projection["categories"]:
    print(category["category"], category["status"])
```

`RegressionReport` is an immutable projection. Python transports the Core's
fixed report and does not compute differences, explanations, scores, or ranks.

Navigate exact report evidence through the same Core authority:

```python
from memoryos import InvestigationQuery

result = memory.investigate(
    report,
    InvestigationQuery(category="reflection"),
)
```

`InvestigationResult` contains exact ordered evidence pointers. A parsed raw
report or successful `memoryos regression --json` envelope is also accepted;
Investigation Core still validates all semantic content.

## Packages

`MemoryInvestigationPackage` owns detached immutable bytes. Import and export
pass exact bytes through the Core. `verify_package()` invokes the MIP verifier
directly through the shared binding and returns ordered package diagnostics.
Native Studio observations remain non-exportable because the Core intentionally
defines no Studio-to-MIP mapping.
When export support is not overridden explicitly, the SDK omits the option so
the Core retains the extension support recorded during import.

## Ownership and concurrency

Each `MemoryOS` instance owns one private local host and one isolated
`InvestigationCore`. Its transport serializes operations with a reentrant lock;
independent SDK instances can execute concurrently without shared investigation
state. Workspace, Investigation, ReplaySession, ComparisonSession, Checkpoint,
VerificationResult, RegressionReport, and package values are immutable.
`InvestigationQuery` and `InvestigationResult` are immutable as well.

Checkpoints are opaque tokens backed by Core `Checkpoint` instances held in the
same private host. They cannot be forged, moved between SDK instances, or used
after their host is closed.

## Errors

Investigation failures raise `MemoryOSError` with stable `code`, `operation`, and
immutable `diagnostics`. Local process/protocol failures raise
`MemoryOSBindingError`. Invalid MIP verification is an ordinary
`VerificationResult(valid=False)` rather than an exception.

Policy preparation failures raise `MemoryOSPolicyPreparationError` with exact
stable `code`, `phase`, `artifact_kind`, and `limit_identifier` fields. Policy
verification/runtime/bridge/internal failures raise
`MemoryOSPolicyOperationalError`; verification failures remain explicitly
distinguishable. PASS, FAIL, and CNE return immutable evaluation values and are
never exceptions. Diagnostic messages and details are non-normative.

## Executable examples

- `observe.py`
- `replay.py`
- `compare.py`
- `regression.py`
- `investigate.py`
- `verify.py`
- `export_package.py`
- `import_package.py`
- `batch_verification.py`
- `policy.py`

Every example is exercised by `python/tests/test_examples.py`.

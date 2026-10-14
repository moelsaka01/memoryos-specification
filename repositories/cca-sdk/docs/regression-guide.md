# Cognitive Regression through the MemoryOS SDK

## Purpose

MO-1206 adds deterministic Cognitive Regression without adding a second
comparison implementation. Investigation Core owns fact extraction,
categorization, ordering, digests, report identity, and the overall result. The
SDK owns only typed access, handle ownership checks, transport, and immutable
projection.

## Contract

Call regression with an explicit baseline and candidate:

```python
report = memory.regression(baseline, candidate)
```

Both investigations must belong to the same live `MemoryOS` instance. Core
then requires the same Workspace and source kind. Neither investigation is
modified and no transition is appended.

The report is `MemoryOSCognitiveRegressionReport` version `1.0.0`. Its category
order is closed and deterministic:

1. Replay
2. Reflection
3. Evidence
4. Retrieval
5. Evolution
6. Verification
7. Transition
8. Lifecycle

Each category is `identical` or `changed` and contains only ordered `added`,
`removed`, or `modified` facts emitted by Core. `overall` is exactly
`identical` or `regressionDetected`.

## Python

```python
from memoryos import MemoryOS

with MemoryOS() as memory:
    workspace = memory.open_workspace(snapshot_a["workspaceIdentifier"])
    baseline = memory.observe(workspace, snapshot_a, identifier="baseline")
    candidate = memory.observe(workspace, snapshot_b, identifier="candidate")
    report = memory.regression(baseline, candidate)

    print(report.identifier)
    print(report.overall)
    for category in report.projection["categories"]:
        print(category["category"], category["status"])
```

The executable example is
[`examples/python/regression.py`](../examples/python/regression.py).

## C++23

```cpp
const auto report = memory.regression(baseline, candidate);
if (report.regressionDetected()) {
    std::cout << report.canonicalJson() << '\n';
}
```

`RegressionReport` is a copyable immutable value handle. See
[`examples/cpp_regression.cpp`](../examples/cpp_regression.cpp).

## Automation and parity

The report's canonical identity and category ordering come from Core, so the
same baseline/candidate truth yields the same report through JavaScript,
Python, C++, SDK, and CLI consumers. Consumers may display or serialize the
report. They must not recalculate categories, infer causes, generate an
explanation, score severity, or compare rendering/layout state.

Foreign SDK handles fail locally. Cross-Workspace and mixed-source inputs fail
with deterministic Core errors. A failure publishes no report and cannot alter
either input investigation.

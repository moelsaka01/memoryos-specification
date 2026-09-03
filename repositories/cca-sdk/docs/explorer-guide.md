# Cognitive Investigation Explorer through the SDK

## Purpose

MO-1207 lets SDK consumers navigate exact evidence already present in a
deterministic Cognitive Regression report. Investigation Core owns report
validation, query normalization, selection, ordering, and pointer construction.
The SDK only transports inputs and exposes the immutable result.

## Query contract

Every query has three nullable members:

- `category`: Replay, Reflection, Evidence, Retrieval, Evolution,
  Verification, Transition, or Lifecycle.
- `reflectionIdentifier`: one exact Reflection identity.
- `transition`: one exact transition token.

Reflection and transition selectors are mutually exclusive. A Reflection
selector may only accompany Reflection; a transition selector may only
accompany Transition or Lifecycle.

## SDK examples

Python:

```python
from memoryos import InvestigationQuery

result = memory.investigate(
    report,
    InvestigationQuery(category="evidence"),
)
```

Parsed raw reports and successful `memoryos regression --json` envelopes are
also accepted. See [`investigate.py`](../examples/python/investigate.py).

JavaScript:

```js
const result = memory.investigate(report, { category: "reflection" });
```

C++23:

```cpp
memoryos::InvestigationQuery query;
query.category = "reflection";
const auto result = memory.investigate(report, query);
```

See [`cpp_investigate.cpp`](../examples/cpp_investigate.cpp).

## Deterministic result

`MemoryOSCognitiveInvestigationResult` version `1.0.0` contains its stable
identifier, Regression and Workspace identities, normalized query, status,
match count, and ordered matches. Each match identifies its category, change,
subject, and nullable baseline/candidate endpoints. An endpoint contains the
exact digest, JSON pointer into the Regression report, source identifier, and
source kind.

The result contains no summary, rank, score, explanation, replay state, or
derived cognition. Equivalent report/query inputs produce byte-identical
canonical JSON.

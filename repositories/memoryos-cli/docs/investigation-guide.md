# Cognitive Regression Investigation Guide

## Purpose

The `investigate` command navigates exact facts already contained in a deterministic Cognitive Regression Report. The MemoryOS SDK validates the report and owns all selection behavior. The CLI reads JSON, maps explicit options to the public SDK query, and renders the immutable result.

## Create a report

```sh
memoryos regression baseline.mip candidate.mip --json > regression.json
```

The resulting CLI success envelope can be passed directly to `investigate`. A raw SDK Regression Report is also accepted.

## Navigate all differences

```sh
memoryos investigate regression.json
memoryos investigate regression.json --json
```

The result preserves Regression category order and difference order. `matched` means at least one observed fact matched; `empty` means the valid exact query matched none.

## Select a category

```sh
memoryos investigate regression.json --category replay
memoryos investigate regression.json --category reflection
memoryos investigate regression.json --category evidence
memoryos investigate regression.json --category retrieval
memoryos investigate regression.json --category evolution
memoryos investigate regression.json --category verification
memoryos investigate regression.json --category transition
memoryos investigate regression.json --category lifecycle
```

These are the only supported categories. The CLI passes the value unchanged; the SDK validates it and selects matches.

## Select a Reflection

```sh
memoryos investigate regression.json --reflection reflection-001
memoryos investigate regression.json --category reflection --reflection reflection-001
```

The identifier must exactly match factual Reflection identity in the report. Reflection selection cannot be combined with a transition selector or a non-Reflection category.

## Select a transition

```sh
memoryos investigate regression.json --transition replay-complete
memoryos investigate regression.json --category transition --transition package-imported
memoryos investigate regression.json --category lifecycle --transition archived
```

The SDK applies its deterministic transition-token normalization. Transition selection cannot be combined with a Reflection selector or a category outside transition and lifecycle.

## Evidence endpoints

Every returned match retains its opaque regression subject and exact baseline or candidate endpoint. An endpoint identifies the source, digest, and JSON Pointer of the observed Regression fact. Added facts have only a candidate endpoint, removed facts only a baseline endpoint, and modified facts both. The CLI never creates these references.

## Automation

Use `--json` for one canonical JSON object on standard output:

```sh
memoryos investigate regression.json --category evidence --json > evidence.json
```

Equivalent report and query inputs produce byte-identical output. The result contains no timestamps, colors, randomness, scores, explanations, or recommendations.

Use `-` to read the report from standard input:

```sh
memoryos regression baseline.mip candidate.mip --json \
  | memoryos investigate - --category evidence --json
```

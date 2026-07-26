# Canonical validation and diagnostics

Validation combines the checked-in
[Draft 2020-12 schema](../specification/schema/canonical-specification-1.0.schema.json)
with deterministic semantic checks. The schema is normative for data shape;
the compiler implements its accepted 1.0 profile directly and does not fetch a
schema from the network.

## Implemented checks

| Category | Check |
|---|---|
| Source | File exists, is readable UTF-8 YAML, and contains one document |
| Schema | Required root and record fields are present |
| Schema | Fields have the documented map, array, scalar, enum, identifier, and version shapes |
| Schema | Core records contain no unknown properties |
| Schema | `$schema`, `format_version`, and `kind` select the supported format |
| Metadata | Required metadata is a record and has a non-empty string name |
| Identity | Category, object, relationship, dependency, rule, and artifact identifiers are unique in their collections |
| Objects | Object `type` is package, domain, component, contract, or requirement |
| References | Object categories, type-specific arrays, relationship endpoints, and dependency endpoints resolve |
| Relationships | Relationship identifiers and `(type, source, target)` triples are not duplicated |
| Dependencies | Target version satisfies `*`, exact, caret, or tilde constraint |
| Dependencies | Directed dependency graph contains no cycle |
| Artifacts | Artifact type is supported and output remains a relative child path |

Custom `validation_rules.expression` values are inventoried but not executed.
The schema and checks above are the implemented IS-002 rules; introducing an
expression language is a future architecture decision.

## Diagnostic contract

Every diagnostic contains:

| Field | Meaning |
|---|---|
| `identifier` | Stable machine identity for the rule, such as `cca.schema.required-field` |
| `code` | Stable compact error code, such as `CCA-SCHEMA-001` |
| `severity` | `error`, `warning`, or `note` |
| `message` | Specific description of the observed problem |
| `suggestion` | Action the author can take |
| `location.path` | Explicit source path |
| `location.line` | 1-based line |
| `location.column` | 1-based column |
| `category` | Processing family such as source, syntax, schema, reference, dependency, or artifact |

Identifiers and codes are stable within the 1.x compiler line. Message prose
may become clearer without changing identity. Consumers should branch on the
identifier or code, never parse a message.

Diagnostics sort by normalized displayed path, line, column, code, and message.
This order is used in CLI JSON and `validation-report.json`.

## Blocking behavior

An error prevents dependent pipeline stages. Warnings and notes remain visible
but do not block progress. The validator attempts to report independent errors
from the same stage in one run; it does not continue into a stage whose input
contract is invalid.

## Fixtures

The [valid comprehensive example](../examples/specifications/reference-architecture.yaml)
exercises every root collection. The
[invalid fixture catalog](../examples/specifications/invalid/README.md)
separates schema, duplicate-identity, reference, relationship, dependency
cycle, and version-compatibility failures for tests and integrations.

# Canonical Specification 1.0 reference

## Design guarantees

A canonical specification is:

- human-readable UTF-8 YAML;
- machine-readable through the equivalent JSON data model;
- self-describing through `$schema`, `format_version`, and `kind`;
- deterministic after parsing because maps and externally visible collections
  use stable lexical ordering;
- versioned independently from the architecture content it describes;
- closed at its core and extensible only through explicit extension maps;
- validated before semantic analysis or generation.

YAML aliases, custom tags, multiple documents, and non-JSON scalar types are
not part of the canonical profile. Authors should use spaces rather than tabs
and quote values when YAML could infer an unintended scalar type.

## Root record

All root fields are required, including arrays or maps that are empty:

| Field | Meaning |
|---|---|
| `$schema` | Exact schema identifier `cca://schemas/canonical-specification/1.0` |
| `format_version` | Serialization contract version; IS-002 accepts semantic versions in major line 1 |
| `kind` | Exact discriminator `canonical_specification` |
| `id` | Stable identifier for this specification |
| `version` | Semantic version of the described specification content |
| `metadata` | Human-facing name, description, authors, and string labels |
| `categories` | Declared classification vocabulary |
| `objects` | Packages, domains, components, contracts, and requirements |
| `relationships` | Directed, typed edges between objects |
| `dependencies` | Directed, version-constrained edges between objects |
| `validation_rules` | Declarative rule inventory |
| `artifacts` | Requested IS-002 output descriptions |
| `annotations` | Scalar tool or editorial facts |
| `extensions` | Namespaced, schema-permitted custom data |

Unknown root fields are schema violations.

## Identifiers

Identifiers match:

```text
^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$
```

They begin with a lowercase letter and consist of lowercase alphanumeric
segments separated by a dot or hyphen. Examples include
`cca.reference`, `architecture.compiler`, and
`requirement.deterministic-output`.

Identifiers are case-sensitive and globally unique within their record
collection. Object identifiers form the symbol table used by dependencies and
relationships. Identifiers are durable references; display names in metadata
may change without changing identity.

## Versions and constraints

Versions follow Semantic Versioning syntax:

```text
MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
```

IS-002 dependency constraints support:

| Form | Meaning |
|---|---|
| `*` | Any version |
| `1.2.3` | Exactly 1.2.3 |
| `^1.2.3` | At least 1.2.3, below the next major version |
| `~1.2.3` | At least 1.2.3, below the next minor version |

Each dependency has a stable edge identifier, `source`, `target`, constraint
in `version`, and an `optional` flag. Both endpoints resolve to in-document
objects. The constraint applies to the target object's semantic version. An
unresolved endpoint, incompatible target version, or cycle is an error.
Pre-release ordering beyond exact textual matching is not implemented in
IS-002.

## Metadata, annotations, and extensions

Every metadata record has a non-empty `name`. It may include a description,
authors, and labels. Labels are string-to-string values intended for
searching, ownership, or governance.

Annotations are maps of scalar values (`null`, Boolean, number, or string).
They carry non-normative facts and must not alter compiler control flow.

Extensions are the only place arbitrary additional structure is permitted.
The compiler preserves extension keys and values in deterministic model and
report order. IS-002 does not execute extensions or treat them as plugins.

## Categories

A category has an identifier, name, optional description, and explicit
annotation and extension maps. Categories classify objects but do not create
behavior. A useful architecture-neutral vocabulary can include
`architecture`, `runtime`, `contracts`, `requirements`, and `artifacts`.

Every object's `category` must reference a declared category.

## Objects and domains

Each object has:

- a `type` discriminator equal to `package`, `domain`, `component`, `contract`,
  or `requirement`;
- a globally unique identifier and semantic version;
- a declared category;
- metadata;
- type-specific reference arrays;
- a `properties` map for architecture-neutral type-specific payload;
- annotation and extension maps.

The internal model uses separate value types for each object kind. There is no
runtime object hierarchy and no executable behavior in an object.

| Type | Reference arrays |
|---|---|
| `package` | `members` |
| `domain` | `components` |
| `component` | `contracts`, `requirements` |
| `contract` | None in format 1.0 |
| `requirement` | `satisfied_by` |

Every array contains object identifiers. Type-specific prose or structured
data belongs in `properties`; vendor-specific data belongs in a namespaced
extension. The compiler preserves properties in the internal model without
executing them as runtime behavior.

## Relationships

A relationship is a stable, directed edge with an `id`, `type`, `source`, and
`target`. Both endpoints must resolve to objects. A duplicate is either:

- a repeated relationship identifier; or
- the same `(type, source, target)` triple under another identifier.

Self-relationships are permitted unless an applicable validation rule forbids
them. Relationships do not imply dependency ordering. The top-level
`dependencies` collection is the only authoritative dependency graph.

## Validation rules

Rule records declare a stable identifier, category, severity, expression,
message, and suggestion. The expression is preserved as a declarative string.
IS-002 implements the built-in schema and semantic checks documented in
[validation.md](../docs/validation.md); it inventories custom expressions but
does not execute an expression language.

This boundary avoids silently inventing a rules engine while keeping the
canonical format forward-compatible with one.

## Artifact requests

Supported artifact types are:

- `documentation_index`;
- `dependency_graph`;
- `specification_report`;
- `validation_report`;
- `object_inventory`;
- `architecture_summary`;
- `placeholder_code`.

`output` is a normalized relative path under the selected output directory.
Absolute paths and parent-directory traversal are invalid. Generators write
only the documented IS-002 reports. `placeholder_code` produces a README that
explicitly states production code generation is not implemented.

## Deterministic interpretation

The compiler does not consult the network, clock, locale, random source, or
global mutable state. Diagnostics sort by path, line, column, code, and
message. Model collections and generated inventories sort lexically by stable
identifier. Generated content contains no timestamps or machine-specific
absolute paths.

Two equivalent documents produce equivalent diagnostics and artifact bytes
when compiled with the same compiler version and explicit output options.

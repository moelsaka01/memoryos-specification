# Invalid canonical specification fixtures

These fixtures are intentionally invalid and must never be presented as
authoring templates.

| Fixture | Expected validation category |
|---|---|
| [schema-violation.yaml](schema-violation.yaml) | Missing root `id`, unknown object kind, invalid metadata value, and unknown core property |
| [duplicate-identifiers.yaml](duplicate-identifiers.yaml) | Duplicate object identifier |
| [circular-dependency.yaml](circular-dependency.yaml) | Cycle in the top-level dependency graph |
| [unresolved-reference.yaml](unresolved-reference.yaml) | Relationship endpoint does not resolve |
| [duplicate-relationship.yaml](duplicate-relationship.yaml) | Duplicate `(type, source, target)` relationship |
| [incompatible-version.yaml](incompatible-version.yaml) | Package version does not satisfy dependency constraint |

Except for `schema-violation.yaml`, each fixture conforms structurally so a
test can isolate one semantic failure. Diagnostic identifiers and locations
must remain stable for equivalent input.

# Canonical internal model

The internal model is a typed, architecture-neutral projection of a validated
canonical document. It is built after dependency resolution and is the only
input accepted by artifact generators.

## Value types

| Type | Responsibility |
|---|---|
| `Identifier` | Validated stable lowercase dotted or hyphenated identity |
| `Version` | Parsed semantic version and deterministic text conversion |
| `Metadata` | Name, description, authors, and ordered labels |
| `Category` | Declared object classification |
| `Package` | Package header, structured properties, and member references |
| `Domain` | Domain header, structured properties, and component references |
| `Component` | Component header, structured properties, and contract/requirement references |
| `Contract` | Contract header and structured properties |
| `Requirement` | Requirement header, structured properties, and satisfaction references |
| `Relationship` | Stable typed edge between model objects |
| `Dependency` | Directed object edge with version constraint and optionality |
| `ValidationRule` | Declarative rule inventory record |
| `ArtifactRequest` | Requested output type, path, and deterministic options |
| `Specification` | Aggregate root for the complete model |
| `ValidationResult` | Ordered diagnostics accumulated through all stages |

Common object data is composed through an `ObjectHeader`; model types do not
inherit from a behavioral base class. The model contains no virtual runtime
objects, service locators, persistence handles, or generated-code behavior.

## Syntax/model separation

`CanonicalValue` is the recursive, YAML-independent syntax value. It retains
source locations and uses an ordered map for object members. Schema validation
and semantic analysis operate on this representation because they need exact
source evidence.

`Specification` is constructed only after those checks succeed. It uses strong
identifiers and versions, typed collections, and value ownership. Generators
therefore do not repeat parsing or reinterpret arbitrary YAML.

## Ownership and mutability

The model follows RAII and value semantics:

- strings, collections, annotations, and extensions are owned;
- raw owning pointers are absent;
- source loaders are injected behind an interface;
- a built model is treated as an immutable input by analysis and generation;
- there is no global model registry.

This composition supports deterministic tests and future format evolution
without coupling the canonical syntax tree to output implementations.

## Scope boundary

The words component, contract, requirement, and runtime category describe
architecture records only. They do not instantiate a CCA runtime, execute a
contract, evaluate cognition, or provide MemoryOS. Custom extension values are
preserved as data and are never loaded as plugins.

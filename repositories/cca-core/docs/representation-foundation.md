# Representation Foundation

## Status and authority

This document describes the `cca::representation` implementation of the
CCA Representation Foundation. The frozen CCA-REP-1.0 specification package
remains authoritative:

1. API-001-HPP (`api.hpp.md`) defines the public C++ declarations;
2. API-001 (`api.md`) defines their public behavior;
3. SP-002 defines the architecture;
4. RR-001 (`requirements.yaml`) defines the mandatory requirements; and
5. IS-004 (`implementation.md`) defines the implementation constraints.

Include the complete public surface with:

```cpp
#include <cca/representation/representation.hpp>
```

The full executable example is
[representation_usage.cpp](../examples/representation_usage.cpp).

## Architecture

Representation is a passive, in-memory semantic layer. It describes meaning;
it does not execute a model, persist it, serialize it, schedule work, or
provide runtime, networking, AI, or user-interface behavior.

`RepresentationDocument` is the root of one semantic model. Its ownership
tree is:

```text
RepresentationDocument
|- RepresentationMetadata
|- RepresentationEntity (creation order)
|  `- RepresentationProperty (creation order)
`- RepresentationRelationship (creation order)
   `- RepresentationProperty (creation order)
```

Each relationship refers to exactly one source entity and one target entity
owned by the same document. A self-relationship is valid. Services are
stateless with respect to the semantic model; the document retains all
semantic ownership.

Entities, relationships, and properties are identity-bearing objects. They
are document- or owner-created, cannot be copied by callers, and share one
document-wide identifier namespace. Identifiers, types, enumeration wrappers,
values, and metadata are independent value types. The document copies the
type and value arguments supplied during construction.

## Public API

All declarations below are in `cca::representation`.

### Value types

#### `RepresentationId`

`RepresentationId(std::string)` creates an immutable identifier value for
lookup, comparison, and identifier-valued properties. `value()` returns a
non-owning string view, `toString()` returns an owning string, equality
compares exact text, and ordering uses lexicographic byte order.

Document-generated identifiers use a monotonically increasing document-local
ordinal shared by entities, relationships, and properties. The first value is:

```text
cca-rep-0000000000000001
```

The suffix is a lower-case hexadecimal ordinal padded to sixteen digits.
Allocated identifiers are never reused, including after removal or rollback.
Separate documents may generate equal identifier text.

#### `RepresentationType`

`RepresentationType(std::string)` owns an exact, case-sensitive semantic type
name. Empty names are representable so validation can report `MissingType`.

#### `EnumerationValue`

`EnumerationValue(std::string)` is the strong construction wrapper that keeps
enumeration text distinct from ordinary string text.

#### `RepresentationValue` and `ValueKind`

Each constructor selects one value kind:

| Constructor input | `ValueKind` | Accessor |
|---|---|---|
| `bool` | `Boolean` | `asBoolean()` |
| `std::int64_t` | `Integer` | `asInteger()` |
| `double` | `FloatingPoint` | `asFloatingPoint()` |
| `std::string` or non-null `const char*` | `String` | `asString()` |
| `EnumerationValue` | `Enumeration` | `asString()` |
| `RepresentationId` | `Identifier` | `asIdentifier()` |
| `std::vector<RepresentationValue>` | `Collection` | `asCollection()` |

`kind()` reports the active category. An incompatible accessor throws
`std::bad_variant_access`; constructing a string value from a null pointer
throws `std::invalid_argument`. Returned views and references remain valid
until the supplying value is replaced or destroyed.

### Semantic objects

#### `RepresentationProperty`

A property exposes its immutable `id()`, exact `name()`, semantic `type()`,
and typed `value()`. A property is created only by `addProperty` on an entity
or relationship. Its name must be non-empty and unique within that owner.

#### `RepresentationEntity`

An entity exposes its immutable `id()`, semantic `type()`, and live,
creation-ordered `properties()` view. `addProperty(name, type, value)` creates
an owned property. `property(name)` returns the matching property or `nullptr`.

#### `RepresentationRelationship`

A relationship exposes its immutable `id()`, semantic `type()`, `source()`,
`target()`, and live, creation-ordered `properties()` view.
`addProperty(name, type, value)` creates an owned relationship property.

#### `RepresentationMetadata`

Metadata owns exact author, version, and provenance strings. Its constructor
defaults each field to an empty string. Accessors return views, and document
metadata cannot be changed after document construction.

#### `RepresentationDocument`

`RepresentationDocument(metadata)` creates the non-copyable, non-movable root
owner. Its public operations are:

- `createEntity(type)` creates and appends an entity;
- `createRelationship(source, target, type)` creates and appends a
  relationship whose endpoints must belong to this document;
- `removeEntity(id)` removes an entity with no incident relationships;
- `removeRelationship(id)` removes a relationship;
- `entities()` and `relationships()` expose const, creation-ordered live
  views;
- `metadata()` exposes immutable document metadata; and
- `isFrozen()` reports whether the document has reached Frozen.

Removing an unknown identifier is a no-op. An entity with an incident
relationship must not be removed until those relationships are removed.

`EntityCollection`, `RelationshipCollection`, and `PropertyCollection` contain
`std::reference_wrapper<const T>` values. The collection object remains valid
for the lifetime of its owner. Mutation may invalidate its iterators and
references to wrapper elements, but it does not invalidate references to
unaffected semantic objects.

### Diagnostics and validation

`Diagnostic` contains a `DiagnosticCode`, `DiagnosticSeverity`, and
deterministic message. `ValidationResult` contains `valid` and the complete
diagnostic sequence. `valid` is true exactly when no diagnostic has Error
severity.

`ValidationService::validate(document)` recursively and read-only validates
the document, entities, relationships, and properties. It is available in
every lifecycle state and does not perform a lifecycle transition.

Validation reports these categories:

| Violation | `DiagnosticCode` |
|---|---|
| Repeated document-wide identifier | `DuplicateIdentifier` |
| Empty entity, relationship, or property type | `MissingType` |
| Repeated property name within one owner | `DuplicateProperty` |
| Relationship endpoint absent from its document | `InvalidRelationship` |
| Other structural failure | `ValidationError` |

Validation diagnostics have Error severity. Diagnostics are ordered by
ascending numeric diagnostic code, then by document insertion order and owner
property insertion order. Message wording is deterministic for equivalent
state but is not a source-compatibility contract.

### Transactions

`TransactionService::begin(document)` creates the sole active transaction
handle for a document. Begin rejects a frozen document, a nested transaction,
or an invalid baseline with `std::logic_error`. It otherwise snapshots
semantic state, insertion order, and lifecycle without changing observable
semantic state.

Normal document and owner mutations participate while a transaction is
active. `Transaction::commit()` validates the tentative model:

- success returns a valid result, establishes Validated, and deactivates the
  handle;
- validation failure returns the diagnostics, preserves tentative mutations,
  and leaves the handle active for repair or rollback.

`rollback()` restores captured semantic state, insertion order, and lifecycle,
but does not restore identifier allocation or make allocated identifiers
reusable. Rollback may invalidate every semantic-object reference and
collection iterator, including references acquired before begin.

`Transaction` is move-only. Moving transfers its document-bound handle and
leaves the source inactive. Destroying an active handle rolls back without
throwing. Calling `commit()` or `rollback()` on an inactive handle throws
`std::logic_error`; the document must outlive its active transaction.

### Freeze

The internal lifecycle is:

```text
Mutable -> Validated -> Frozen
```

The Validated state is deliberately not exposed as a public enum or setter.
Successful transaction commit establishes it. A later successful semantic
mutation returns the lifecycle to Mutable. Standalone validation does not
change lifecycle.

`FreezeService::freeze(document)` validates and freezes as one operation.
Validation failure leaves lifecycle unchanged. Freezing during an active
transaction returns an invalid result with one Error-severity
`TransactionError` diagnostic and changes neither object. Freezing an already
frozen document is idempotent and validates it again.

Frozen documents continue to support validation and queries but reject every
entity, relationship, and property mutation with `std::logic_error`.

### Queries

`QueryService` is read-only and deterministic:

- `findEntity(document, id)` returns a const entity pointer or `nullptr`;
- `findRelationship(document, id)` returns a const relationship pointer or
  `nullptr`; and
- `entitiesByType(document, type)` returns a creation-ordered collection by
  value using exact, case-sensitive type equality.

Queries are available during a transaction and after freeze. They have no
side effects and do not invalidate references.

## Developer guide

### Build a document

Create metadata and the document, then use owner-mediated mutation:

```cpp
namespace rep = cca::representation;

rep::RepresentationDocument document{
    rep::RepresentationMetadata{"CCA", "1.0", "example"}};

const rep::RepresentationType component_type{"Component"};
auto& component = document.createEntity(component_type);
component.addProperty(
    "name",
    rep::RepresentationType{"Text"},
    rep::RepresentationValue{"gateway"});
```

Direct mutation is allowed whenever the document is not frozen. A transaction
is optional, but it provides validation-backed commit and deterministic
rollback:

```cpp
rep::TransactionService transactions;
auto transaction = transactions.begin(document);

auto& worker = document.createEntity(component_type);
document.createRelationship(
    component,
    worker,
    rep::RepresentationType{"DependsOn"});

const rep::ValidationResult commit_result = transaction.commit();
if (!commit_result.valid) {
    transaction.rollback();
}
```

Do not use semantic-object references after rollback. Use saved identifier
values and read-only query services where a post-rollback lookup is needed.

### Validate and freeze

Validation is always read-only:

```cpp
const rep::ValidationResult validation =
    rep::ValidationService{}.validate(document);
```

Freeze performs its own validation. Check its result before assuming the
document is frozen:

```cpp
const rep::ValidationResult freeze_result =
    rep::FreezeService{}.freeze(document);

if (freeze_result.valid && document.isFrozen()) {
    // Read-only queries and validation remain available.
}
```

### Preserve deterministic behavior

For equivalent successful mutation sequences:

- generated identifiers are equal;
- entities, relationships, and properties retain creation order;
- filtered entity queries retain entity creation order; and
- validation emits diagnostics in the specified stable order.

Do not infer ordering from private containers or indexes. Use the public
collection and query order.

### Handle standard failures

The API has no implementation-specific public exception hierarchy:

| Condition | Public result |
|---|---|
| Any semantic mutation of a frozen document | `std::logic_error` |
| Foreign relationship endpoint | `std::invalid_argument` |
| Empty or duplicate property name | `std::invalid_argument` |
| Remove entity with an incident relationship | `std::logic_error` |
| Remove unknown entity or relationship | No-op |
| Invalid, frozen, or nested transaction begin | `std::logic_error` |
| Inactive transaction commit or rollback | `std::logic_error` |
| Incompatible value accessor | `std::bad_variant_access` |
| Null `const char*` value | `std::invalid_argument` |
| Identifier ordinal exhaustion | `std::overflow_error` |

All document, entity, and relationship mutators check frozen state first.
For mutable documents, relationship creation checks endpoint ownership before
identifier allocation. Property creation checks empty name and then duplicate
name before allocation. Mutators provide the strong exception guarantee.
Standard allocation failures may propagate.

### Respect lifetimes and synchronization

Entity and relationship references remain valid until object removal,
rollback, or document destruction. Property references remain valid until
rollback, removal of their owner, or document destruction. Creating other
objects does not invalidate semantic-object references, and adding another
property does not invalidate existing property references.

The API provides no thread-safety guarantee for a document, its owned objects,
or an active transaction. Externally synchronize concurrent access.
Independent immutable value objects may be read concurrently.

## Complexity and resource notes

CCA-REP-1.0 intentionally leaves storage, indexing, allocation, containers,
and lookup algorithms implementation-defined. Consequently, Big-O bounds are
not part of the public compatibility contract and callers must not depend on a
particular index or container.

The following workload characteristics follow from required behavior:

- validation considers the complete document and emits every detected
  violation in deterministic order, so its work and result storage grow with
  model size and diagnostic count;
- `entitiesByType` returns a collection by value, so result storage grows with
  the number of matches even when an internal index is used;
- direct collection access returns an owner-held view and does not copy the
  semantic objects;
- transaction begin must preserve enough state to restore semantic content,
  insertion order, and lifecycle; the exact snapshot, copy-on-write, or undo
  strategy is private;
- rollback restoration cost and temporary storage depend on that private
  transaction strategy; and
- freeze includes validation and therefore includes the validation workload.

Document ownership is RAII-based: destroying the document releases its
entities, relationships, properties, metadata, and private indexes. An active
transaction adds temporary restoration state until commit, rollback, or
handle destruction.

## RR-001 coverage and conformance index

The index below maps every mandatory requirement to its public contract
surface and the behavior that automated conformance tests must verify.

| Requirement | Contract surface | Automated conformance test |
|---|---|---|
| `RR-ARCH-001` | Representation semantic types and services | `RepresentationArchitectureTest.PublicTypesEnforceTheFrozenOwnershipModel` |
| `RR-ARCH-002` | Entire `cca::representation` surface | `RepresentationArchitectureTest.PublicTypesEnforceTheFrozenOwnershipModel` |
| `RR-ARCH-003` | IDs, collections, validation, queries, transactions | `ValidationTest.ValidDocumentsProduceAStableReadOnlySuccessfulResult` |
| `RR-ARCH-004` | Public interfaces and opaque private storage | `RepresentationArchitectureTest.PublicTypesEnforceTheFrozenOwnershipModel` |
| `RR-DOC-001` | `RepresentationDocument` | `DocumentTest.CollectionsAreStableLiveViewsInSuccessfulCreationOrder` |
| `RR-DOC-002` | Document construction and collections | `DocumentTest.MetadataIsOwnedExactlyAndDefaultsToEmptyStrings`; `DocumentTest.CollectionsAreStableLiveViewsInSuccessfulCreationOrder` |
| `RR-ENTITY-001` | `createEntity` | `RelationshipTest.ForeignEndpointsAreRejectedBeforeIdentifierAllocation` |
| `RR-ENTITY-002` | `RepresentationEntity::type` | `EntityTest.EntityCopiesItsTypeAndFindsPropertiesByExactCaseSensitiveName` |
| `RR-REL-001` | `createRelationship`, `source`, `target` | `RelationshipTest.RelationshipHasExactlyTwoOwnedEndpointsAndItsOwnTypeAndIdentity` |
| `RR-REL-002` | `RepresentationRelationship::id` | `RelationshipTest.RelationshipHasExactlyTwoOwnedEndpointsAndItsOwnTypeAndIdentity` |
| `RR-REL-003` | `RepresentationRelationship::type` | `RelationshipTest.RelationshipHasExactlyTwoOwnedEndpointsAndItsOwnTypeAndIdentity` |
| `RR-PROP-001` | Property accessors and `addProperty` | `PropertyTest.EntityPropertiesOwnCopiedNameTypeAndValueInCreationOrder` |
| `RR-PROP-002` | `addProperty` | `PropertyTest.EmptyAndDuplicateNamesFailStronglyWithoutConsumingIdentifiers` |
| `RR-TYPE-001` | Entity, relationship, and property `type()` | `EntityTest.EntityCopiesItsTypeAndFindsPropertiesByExactCaseSensitiveName`; `RelationshipTest.RelationshipHasExactlyTwoOwnedEndpointsAndItsOwnTypeAndIdentity`; `PropertyTest.EntityPropertiesOwnCopiedNameTypeAndValueInCreationOrder` |
| `RR-VALUE-001` | Boolean value constructor/accessor | `ValueTest.EveryMandatoryValueCategoryHasItsStronglyTypedConstructionPath` |
| `RR-VALUE-002` | Integer value constructor/accessor | `ValueTest.EveryMandatoryValueCategoryHasItsStronglyTypedConstructionPath` |
| `RR-VALUE-003` | Floating-point constructor/accessor | `ValueTest.EveryMandatoryValueCategoryHasItsStronglyTypedConstructionPath` |
| `RR-VALUE-004` | String constructors and `asString` | `ValueTest.IncompatibleAccessAndNullCharacterPointerUseStandardExceptions` |
| `RR-VALUE-005` | `EnumerationValue` constructor path | `ValueTest.EnumerationTextIsDistinctFromOrdinaryStringText` |
| `RR-VALUE-006` | Identifier value constructor/accessor | `ValueTest.EveryMandatoryValueCategoryHasItsStronglyTypedConstructionPath` |
| `RR-VALUE-007` | Collection value constructor/accessor | `ValueTest.EveryMandatoryValueCategoryHasItsStronglyTypedConstructionPath` |
| `RR-ID-001` | IDs on entities, relationships, and properties | `IdentityTest.AllSemanticObjectsShareOneDeterministicDocumentLocalSequence` |
| `RR-ID-002` | Const ID accessors and value behavior | `RepresentationArchitectureTest.PublicTypesEnforceTheFrozenOwnershipModel`; `IdentityTest.IdentifierValuePreservesExactTextAndLexicographicOrdering` |
| `RR-ID-003` | Allocation, removal, and rollback | `IdentityTest.RemovalRetiresIdentifiersPermanently`; `TransactionTest.RollbackRestoresSemanticStateOrderAndRetiresAllTentativeIds` |
| `RR-VAL-001` | `ValidationService::validate` | `ValidationTest.ValidationRecursesAndReportsEveryMissingTypeDeterministically` |
| `RR-VAL-002` | `ValidationService::validate` | `ValidationTest.ValidDocumentsProduceAStableReadOnlySuccessfulResult` |
| `RR-VAL-003` | `ValidationResult` and `Diagnostic` | `ValidationInternalTest.ReportsEveryDefensiveCategoryInNormativeOrder` |
| `RR-TXN-001` | `TransactionService::begin` | `TransactionTest.BeginCapturesAValidBaselineWithoutChangingObservableState` |
| `RR-TXN-002` | `Transaction::commit` | `TransactionTest.SuccessfulCommitValidatesPersistsAndDeactivates` |
| `RR-TXN-003` | `Transaction::rollback` and destructor | `TransactionTest.RollbackRestoresSemanticStateOrderAndRetiresAllTentativeIds`; `TransactionTest.DestroyingAnActiveHandleRollsBackWithoutThrowing` |
| `RR-TXN-004` | `Transaction::commit` | `TransactionTest.FailedCommitPreservesTentativeStateAndAllowsRepair` |
| `RR-TXN-005` | `Transaction::rollback` | `TransactionTest.RollbackRestoresSemanticStateOrderAndRetiresAllTentativeIds` |
| `RR-QUERY-001` | `QueryService` | `QueryTest.LookupsAreCategorySpecificAndUnknownIdsReturnNull` |
| `RR-QUERY-002` | `QueryService` | `QueryTest.QueriesAreSideEffectFreeAndAvailableDuringTransactions` |
| `RR-QUERY-003` | Query result pointers and collections | `RepresentationArchitectureTest.PublicTypesEnforceTheFrozenOwnershipModel` |
| `RR-FREEZE-001` | `FreezeService`, all mutators | `FreezeTest.AllSemanticMutatorsRejectAndFrozenPrecedenceIsUniform` |
| `RR-FREEZE-002` | `QueryService` | `FreezeTest.QueriesAndValidationRemainAvailableAfterFreeze` |
| `RR-FREEZE-003` | `ValidationService` | `FreezeTest.QueriesAndValidationRemainAvailableAfterFreeze` |
| `RR-SERVICE-001` | `ValidationService` | `RepresentationArchitectureTest.PublicTypesEnforceTheFrozenOwnershipModel` |
| `RR-SERVICE-002` | `QueryService` | `RepresentationArchitectureTest.PublicTypesEnforceTheFrozenOwnershipModel` |
| `RR-SERVICE-003` | `TransactionService` and `Transaction` | `RepresentationArchitectureTest.PublicTypesEnforceTheFrozenOwnershipModel` |
| `RR-SERVICE-004` | `FreezeService` | `RepresentationArchitectureTest.PublicTypesEnforceTheFrozenOwnershipModel` |
| `RR-CONF-001` | Complete public and behavioral contract | All 45 tests in `representation_test.cpp` and `representation_internal_test.cpp` |

Conformance additionally requires warning-free compilation with warnings
treated as errors and successful completion of all Representation test suites.

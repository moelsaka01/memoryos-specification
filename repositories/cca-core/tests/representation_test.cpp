#include <cca/representation/representation.hpp>

#include <gtest/gtest.h>

#include <array>
#include <bit>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <iomanip>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <tuple>
#include <type_traits>
#include <utility>
#include <variant>
#include <vector>

#include "representation_test_access.hpp"

namespace {

using cca::representation::Diagnostic;
using cca::representation::DiagnosticCode;
using cca::representation::DiagnosticSeverity;
using cca::representation::EntityCollection;
using cca::representation::EnumerationValue;
using cca::representation::FreezeService;
using cca::representation::PropertyCollection;
using cca::representation::QueryService;
using cca::representation::RelationshipCollection;
using cca::representation::RepresentationDocument;
using cca::representation::RepresentationEntity;
using cca::representation::RepresentationId;
using cca::representation::RepresentationInternalAccess;
using cca::representation::RepresentationLifecycleState;
using cca::representation::RepresentationMetadata;
using cca::representation::RepresentationProperty;
using cca::representation::RepresentationRelationship;
using cca::representation::RepresentationType;
using cca::representation::RepresentationValue;
using cca::representation::Transaction;
using cca::representation::TransactionService;
using cca::representation::ValidationResult;
using cca::representation::ValidationService;
using cca::representation::ValueKind;

[[nodiscard]] std::string expected_id(const std::uint64_t ordinal) {
    std::ostringstream stream;
    stream << "cca-rep-" << std::hex << std::nouppercase << std::setfill('0') << std::setw(16)
           << ordinal;
    return stream.str();
}

template <typename Collection>
[[nodiscard]] std::vector<std::string> ids_of(const Collection& collection) {
    std::vector<std::string> ids;
    ids.reserve(collection.size());
    for (const auto& object : collection) {
        ids.push_back(object.get().id().toString());
    }
    return ids;
}

[[nodiscard]] std::vector<std::string> property_names_of(const PropertyCollection& properties) {
    std::vector<std::string> names;
    names.reserve(properties.size());
    for (const auto& property : properties) {
        names.emplace_back(property.get().name());
    }
    return names;
}

using DiagnosticFingerprint = std::tuple<DiagnosticCode, DiagnosticSeverity, std::string>;

[[nodiscard]] std::vector<DiagnosticFingerprint>
fingerprint_of(const std::vector<Diagnostic>& diagnostics) {
    std::vector<DiagnosticFingerprint> fingerprint;
    fingerprint.reserve(diagnostics.size());
    for (const auto& diagnostic : diagnostics) {
        fingerprint.emplace_back(diagnostic.code, diagnostic.severity, diagnostic.message);
    }
    return fingerprint;
}

struct ValueSnapshot final {
    ValueKind kind{ValueKind::Boolean};
    bool boolean{};
    std::int64_t integer{};
    std::array<std::byte, sizeof(double)> floating_point{};
    std::string text;
    std::vector<ValueSnapshot> collection;

    bool operator==(const ValueSnapshot&) const = default;
};

[[nodiscard]] ValueSnapshot snapshot_of(const RepresentationValue& value) {
    ValueSnapshot snapshot;
    snapshot.kind = value.kind();
    switch (value.kind()) {
    case ValueKind::Boolean:
        snapshot.boolean = value.asBoolean();
        break;
    case ValueKind::Integer:
        snapshot.integer = value.asInteger();
        break;
    case ValueKind::FloatingPoint:
        snapshot.floating_point =
            std::bit_cast<decltype(snapshot.floating_point)>(
                value.asFloatingPoint());
        break;
    case ValueKind::String:
    case ValueKind::Enumeration:
        snapshot.text = value.asString();
        break;
    case ValueKind::Identifier:
        snapshot.text = value.asIdentifier().toString();
        break;
    case ValueKind::Collection:
        snapshot.collection.reserve(value.asCollection().size());
        for (const auto& element : value.asCollection()) {
            snapshot.collection.push_back(snapshot_of(element));
        }
        break;
    }
    return snapshot;
}

struct PropertySnapshot final {
    std::string id;
    std::string name;
    std::string type;
    ValueSnapshot value;

    bool operator==(const PropertySnapshot&) const = default;
};

[[nodiscard]] PropertySnapshot
snapshot_of(const RepresentationProperty& property) {
    return PropertySnapshot{
        .id = property.id().toString(),
        .name = std::string{property.name()},
        .type = std::string{property.type().name()},
        .value = snapshot_of(property.value()),
    };
}

[[nodiscard]] std::vector<PropertySnapshot>
snapshot_of(const PropertyCollection& properties) {
    std::vector<PropertySnapshot> snapshots;
    snapshots.reserve(properties.size());
    for (const auto& property : properties) {
        snapshots.push_back(snapshot_of(property.get()));
    }
    return snapshots;
}

struct EntitySnapshot final {
    std::string id;
    std::string type;
    std::vector<PropertySnapshot> properties;

    bool operator==(const EntitySnapshot&) const = default;
};

struct RelationshipSnapshot final {
    std::string id;
    std::string type;
    std::optional<std::size_t> source_index;
    std::optional<std::size_t> target_index;
    std::string source_id;
    std::string target_id;
    std::vector<PropertySnapshot> properties;

    bool operator==(const RelationshipSnapshot&) const = default;
};

[[nodiscard]] std::optional<std::size_t>
entity_index(const RepresentationDocument& document,
             const RepresentationEntity& expected) noexcept {
    for (std::size_t index = 0U; index < document.entities().size(); ++index) {
        if (&document.entities()[index].get() == &expected) {
            return index;
        }
    }
    return std::nullopt;
}

struct DocumentSnapshot final {
    std::string author;
    std::string version;
    std::string provenance;
    std::vector<EntitySnapshot> entities;
    std::vector<RelationshipSnapshot> relationships;
    RepresentationLifecycleState lifecycle;
    bool frozen;

    bool operator==(const DocumentSnapshot&) const = default;
};

[[nodiscard]] DocumentSnapshot snapshot_of(const RepresentationDocument& document) {
    std::vector<EntitySnapshot> entities;
    entities.reserve(document.entities().size());
    for (const auto& entity_reference : document.entities()) {
        const auto& entity = entity_reference.get();
        entities.push_back(EntitySnapshot{
            .id = entity.id().toString(),
            .type = std::string{entity.type().name()},
            .properties = snapshot_of(entity.properties()),
        });
    }

    std::vector<RelationshipSnapshot> relationships;
    relationships.reserve(document.relationships().size());
    for (const auto& relationship_reference : document.relationships()) {
        const auto& relationship = relationship_reference.get();
        relationships.push_back(RelationshipSnapshot{
            .id = relationship.id().toString(),
            .type = std::string{relationship.type().name()},
            .source_index = entity_index(document, relationship.source()),
            .target_index = entity_index(document, relationship.target()),
            .source_id = relationship.source().id().toString(),
            .target_id = relationship.target().id().toString(),
            .properties = snapshot_of(relationship.properties()),
        });
    }

    return DocumentSnapshot{
        .author = std::string{document.metadata().author()},
        .version = std::string{document.metadata().version()},
        .provenance = std::string{document.metadata().provenance()},
        .entities = std::move(entities),
        .relationships = std::move(relationships),
        .lifecycle = RepresentationInternalAccess::lifecycleState(document),
        .frozen = document.isFrozen(),
    };
}

TEST(RepresentationArchitectureTest, PublicTypesEnforceTheFrozenOwnershipModel) {
    static_assert(std::is_copy_constructible_v<RepresentationId>);
    static_assert(std::is_copy_assignable_v<RepresentationId>);
    static_assert(std::is_copy_constructible_v<RepresentationType>);
    static_assert(std::is_copy_assignable_v<RepresentationType>);
    static_assert(std::is_copy_constructible_v<EnumerationValue>);
    static_assert(std::is_copy_constructible_v<RepresentationValue>);
    static_assert(std::is_copy_assignable_v<RepresentationValue>);
    static_assert(std::is_copy_constructible_v<RepresentationMetadata>);

    static_assert(!std::is_default_constructible_v<RepresentationEntity>);
    static_assert(!std::is_copy_constructible_v<RepresentationEntity>);
    static_assert(!std::is_move_constructible_v<RepresentationEntity>);
    static_assert(!std::is_default_constructible_v<RepresentationRelationship>);
    static_assert(!std::is_copy_constructible_v<RepresentationRelationship>);
    static_assert(!std::is_move_constructible_v<RepresentationRelationship>);
    static_assert(!std::is_default_constructible_v<RepresentationProperty>);
    static_assert(!std::is_copy_constructible_v<RepresentationProperty>);
    static_assert(!std::is_move_constructible_v<RepresentationProperty>);

    static_assert(!std::is_copy_constructible_v<RepresentationDocument>);
    static_assert(!std::is_copy_assignable_v<RepresentationDocument>);
    static_assert(!std::is_move_constructible_v<RepresentationDocument>);
    static_assert(!std::is_move_assignable_v<RepresentationDocument>);

    static_assert(!std::is_default_constructible_v<Transaction>);
    static_assert(!std::is_copy_constructible_v<Transaction>);
    static_assert(!std::is_copy_assignable_v<Transaction>);
    static_assert(std::is_move_constructible_v<Transaction>);
    static_assert(std::is_move_assignable_v<Transaction>);

    static_assert(std::is_same_v<decltype(std::declval<RepresentationDocument&>().metadata()),
                                 const RepresentationMetadata&>);
    static_assert(std::is_same_v<decltype(std::declval<RepresentationDocument&>().entities()),
                                 const EntityCollection&>);
    static_assert(
        std::is_same_v<decltype(std::declval<RepresentationDocument&>().relationships()),
                       const RelationshipCollection&>);
    static_assert(
        std::is_same_v<decltype(std::declval<RepresentationEntity&>().properties()),
                       const PropertyCollection&>);
    static_assert(std::is_same_v<
                  decltype(std::declval<QueryService&>().findEntity(
                      std::declval<const RepresentationDocument&>(),
                      std::declval<const RepresentationId&>())),
                  const RepresentationEntity*>);
    static_assert(std::is_same_v<
                  decltype(std::declval<QueryService&>().findRelationship(
                      std::declval<const RepresentationDocument&>(),
                      std::declval<const RepresentationId&>())),
                  const RepresentationRelationship*>);

    ValidationService validation;
    QueryService query;
    TransactionService transactions;
    FreezeService freeze;
    static_cast<void>(validation);
    static_cast<void>(query);
    static_cast<void>(transactions);
    static_cast<void>(freeze);
    SUCCEED();
}

TEST(IdentityTest, IdentifierValuePreservesExactTextAndLexicographicOrdering) {
    const RepresentationId alpha{"Alpha"};
    const RepresentationId alpha_copy{"Alpha"};
    const RepresentationId beta{"Beta"};

    EXPECT_EQ(alpha.value(), "Alpha");
    EXPECT_EQ(alpha.toString(), "Alpha");
    EXPECT_EQ(alpha, alpha_copy);
    EXPECT_FALSE(alpha != alpha_copy);
    EXPECT_NE(alpha, beta);
    EXPECT_TRUE(alpha < beta);

    const RepresentationId lower_byte{std::string(1U, static_cast<char>(0x7f))};
    const RepresentationId higher_byte{std::string(1U, static_cast<char>(0x80))};
    EXPECT_TRUE(lower_byte < higher_byte);

    const std::string owning_copy = alpha.toString();
    RepresentationId reassigned{"replacement"};
    reassigned = alpha;
    EXPECT_EQ(owning_copy, "Alpha");
    EXPECT_EQ(reassigned.value(), "Alpha");
}

TEST(IdentityTest, AllSemanticObjectsShareOneDeterministicDocumentLocalSequence) {
    RepresentationDocument document;
    auto& source = document.createEntity(RepresentationType{"Source"});
    auto& source_property = source.addProperty(
        "enabled", RepresentationType{"Boolean"}, RepresentationValue{true});
    auto& target = document.createEntity(RepresentationType{"Target"});
    auto& relationship =
        document.createRelationship(source, target, RepresentationType{"Connects"});
    auto& relationship_property = relationship.addProperty(
        "weight", RepresentationType{"Integer"}, RepresentationValue{std::int64_t{7}});

    EXPECT_EQ(source.id().toString(), expected_id(1U));
    EXPECT_EQ(source_property.id().toString(), expected_id(2U));
    EXPECT_EQ(target.id().toString(), expected_id(3U));
    EXPECT_EQ(relationship.id().toString(), expected_id(4U));
    EXPECT_EQ(relationship_property.id().toString(), expected_id(5U));
}

TEST(IdentityTest, IndependentDocumentsUseIndependentDeterministicSequences) {
    RepresentationDocument first;
    RepresentationDocument second;

    const auto& first_entity = first.createEntity(RepresentationType{"Node"});
    const auto& second_entity = second.createEntity(RepresentationType{"Node"});

    EXPECT_EQ(first_entity.id(), second_entity.id());
    EXPECT_EQ(first_entity.id().toString(), expected_id(1U));
    EXPECT_EQ(second_entity.id().toString(), expected_id(1U));
}

TEST(IdentityTest, RemovalRetiresIdentifiersPermanently) {
    RepresentationDocument document;
    auto& removed = document.createEntity(RepresentationType{"Removed"});
    const std::string removed_id = removed.id().toString();
    const auto& retained = document.createEntity(RepresentationType{"Retained"});

    document.removeEntity(RepresentationId{removed_id});
    const auto& replacement = document.createEntity(RepresentationType{"Replacement"});

    EXPECT_EQ(retained.id().toString(), expected_id(2U));
    EXPECT_EQ(replacement.id().toString(), expected_id(3U));
    EXPECT_NE(replacement.id().toString(), removed_id);
}

TEST(DocumentTest, MetadataIsOwnedExactlyAndDefaultsToEmptyStrings) {
    const RepresentationDocument default_document;
    EXPECT_TRUE(default_document.metadata().author().empty());
    EXPECT_TRUE(default_document.metadata().version().empty());
    EXPECT_TRUE(default_document.metadata().provenance().empty());

    RepresentationMetadata metadata{"Ada", "1.2.3", "model-import"};
    RepresentationDocument document{metadata};
    metadata = RepresentationMetadata{"changed", "changed", "changed"};

    EXPECT_EQ(document.metadata().author(), "Ada");
    EXPECT_EQ(document.metadata().version(), "1.2.3");
    EXPECT_EQ(document.metadata().provenance(), "model-import");
}

TEST(DocumentTest, CollectionsAreStableLiveViewsInSuccessfulCreationOrder) {
    RepresentationDocument document;
    const EntityCollection* const entities_view = &document.entities();
    const RelationshipCollection* const relationships_view = &document.relationships();

    auto& first = document.createEntity(RepresentationType{"First"});
    auto& second = document.createEntity(RepresentationType{"Second"});
    auto& third = document.createEntity(RepresentationType{"Third"});
    auto& first_relationship =
        document.createRelationship(first, second, RepresentationType{"FirstEdge"});
    auto& second_relationship =
        document.createRelationship(second, third, RepresentationType{"SecondEdge"});

    EXPECT_EQ(&document.entities(), entities_view);
    EXPECT_EQ(&document.relationships(), relationships_view);
    EXPECT_EQ(ids_of(document.entities()),
              (std::vector<std::string>{
                  first.id().toString(), second.id().toString(), third.id().toString()}));
    EXPECT_EQ(ids_of(document.relationships()),
              (std::vector<std::string>{
                  first_relationship.id().toString(), second_relationship.id().toString()}));

    document.removeRelationship(first_relationship.id());
    document.removeEntity(first.id());
    EXPECT_EQ(ids_of(document.entities()),
              (std::vector<std::string>{second.id().toString(), third.id().toString()}));
    EXPECT_EQ(ids_of(document.relationships()),
              (std::vector<std::string>{second_relationship.id().toString()}));
}

TEST(DocumentTest, UnknownRemovalIsANoOpAndIncidentRelationshipsProtectEntities) {
    RepresentationDocument document;
    auto& source = document.createEntity(RepresentationType{"Source"});
    auto& target = document.createEntity(RepresentationType{"Target"});
    auto& relationship =
        document.createRelationship(source, target, RepresentationType{"Connects"});
    const DocumentSnapshot original = snapshot_of(document);

    document.removeEntity(RepresentationId{"unknown-entity"});
    document.removeRelationship(RepresentationId{"unknown-relationship"});
    document.removeEntity(relationship.id());
    document.removeRelationship(source.id());
    EXPECT_EQ(snapshot_of(document), original);

    EXPECT_THROW(document.removeEntity(source.id()), std::logic_error);
    EXPECT_EQ(snapshot_of(document), original);

    const RepresentationId relationship_id = relationship.id();
    const RepresentationId source_id = source.id();
    document.removeRelationship(relationship_id);
    document.removeEntity(source_id);

    EXPECT_EQ(document.relationships().size(), 0U);
    ASSERT_EQ(document.entities().size(), 1U);
    EXPECT_EQ(document.entities().front().get().id(), target.id());
}

TEST(EntityTest, EntityCopiesItsTypeAndFindsPropertiesByExactCaseSensitiveName) {
    RepresentationDocument document;
    RepresentationType supplied_type{"Original"};
    auto& entity = document.createEntity(supplied_type);
    supplied_type = RepresentationType{"Changed"};

    auto& upper = entity.addProperty(
        "Name", RepresentationType{"String"}, RepresentationValue{"upper"});
    auto& lower = entity.addProperty(
        "name", RepresentationType{"String"}, RepresentationValue{"lower"});

    EXPECT_EQ(entity.type().name(), "Original");
    EXPECT_EQ(entity.property("Name"), &upper);
    EXPECT_EQ(entity.property("name"), &lower);
    EXPECT_EQ(entity.property("NAME"), nullptr);
    EXPECT_EQ(entity.property("missing"), nullptr);
}

TEST(EntityTest, EntityAndCollectionReferencesSurviveUnrelatedCreation) {
    RepresentationDocument document;
    auto& first = document.createEntity(RepresentationType{"Stable"});
    const RepresentationEntity* const first_address = &first;
    const std::string_view id_view = first.id().value();
    const std::string_view type_view = first.type().name();
    const EntityCollection* const collection_address = &document.entities();

    for (std::uint64_t ordinal = 0U; ordinal < 64U; ++ordinal) {
        document.createEntity(RepresentationType{"Other-" + std::to_string(ordinal)});
    }

    EXPECT_EQ(&first, first_address);
    EXPECT_EQ(&document.entities(), collection_address);
    EXPECT_EQ(id_view, expected_id(1U));
    EXPECT_EQ(type_view, "Stable");
}

TEST(RelationshipTest, RelationshipHasExactlyTwoOwnedEndpointsAndItsOwnTypeAndIdentity) {
    RepresentationDocument document;
    auto& source = document.createEntity(RepresentationType{"Node"});
    auto& target = document.createEntity(RepresentationType{"Node"});
    auto& relationship =
        document.createRelationship(source, target, RepresentationType{"DirectedEdge"});

    EXPECT_EQ(&relationship.source(), &source);
    EXPECT_EQ(&relationship.target(), &target);
    EXPECT_EQ(relationship.type().name(), "DirectedEdge");
    EXPECT_NE(relationship.id(), source.id());
    EXPECT_NE(relationship.id(), target.id());
}

TEST(RelationshipTest, SelfRelationshipsArePermitted) {
    RepresentationDocument document;
    auto& entity = document.createEntity(RepresentationType{"Node"});
    auto& relationship =
        document.createRelationship(entity, entity, RepresentationType{"Self"});

    EXPECT_EQ(&relationship.source(), &entity);
    EXPECT_EQ(&relationship.target(), &entity);
    EXPECT_EQ(document.relationships().size(), 1U);
}

TEST(RelationshipTest, ForeignEndpointsAreRejectedBeforeIdentifierAllocation) {
    RepresentationDocument document;
    RepresentationDocument foreign_document;
    auto& local = document.createEntity(RepresentationType{"Local"});
    auto& foreign = foreign_document.createEntity(RepresentationType{"Foreign"});

    EXPECT_THROW(
        document.createRelationship(local, foreign, RepresentationType{"Invalid"}),
        std::invalid_argument);
    EXPECT_THROW(
        document.createRelationship(foreign, local, RepresentationType{"Invalid"}),
        std::invalid_argument);
    EXPECT_TRUE(document.relationships().empty());

    const auto& next = document.createEntity(RepresentationType{"Next"});
    EXPECT_EQ(next.id().toString(), expected_id(2U));
}

TEST(RelationshipTest, RelationshipReferencesSurviveUnrelatedCreation) {
    RepresentationDocument document;
    auto& source = document.createEntity(RepresentationType{"Node"});
    auto& target = document.createEntity(RepresentationType{"Node"});
    auto& stable =
        document.createRelationship(source, target, RepresentationType{"Stable"});
    const RepresentationRelationship* const stable_address = &stable;
    const RepresentationEntity* const source_address = &stable.source();
    const RelationshipCollection* const collection_address = &document.relationships();

    for (std::uint64_t ordinal = 0U; ordinal < 64U; ++ordinal) {
        document.createRelationship(
            source, target, RepresentationType{"Other-" + std::to_string(ordinal)});
    }

    EXPECT_EQ(&stable, stable_address);
    EXPECT_EQ(&stable.source(), source_address);
    EXPECT_EQ(&document.relationships(), collection_address);
}

TEST(PropertyTest, EntityPropertiesOwnCopiedNameTypeAndValueInCreationOrder) {
    RepresentationDocument document;
    auto& entity = document.createEntity(RepresentationType{"Node"});
    RepresentationType supplied_type{"Integer"};
    RepresentationValue supplied_value{std::int64_t{42}};

    auto& first = entity.addProperty("answer", supplied_type, supplied_value);
    auto& second = entity.addProperty(
        "enabled", RepresentationType{"Boolean"}, RepresentationValue{true});
    supplied_type = RepresentationType{"Changed"};
    supplied_value = RepresentationValue{std::int64_t{99}};

    EXPECT_EQ(first.name(), "answer");
    EXPECT_EQ(first.type().name(), "Integer");
    EXPECT_EQ(first.value().kind(), ValueKind::Integer);
    EXPECT_EQ(first.value().asInteger(), 42);
    EXPECT_EQ(property_names_of(entity.properties()),
              (std::vector<std::string>{"answer", "enabled"}));
    EXPECT_EQ(ids_of(entity.properties()),
              (std::vector<std::string>{first.id().toString(), second.id().toString()}));
}

TEST(PropertyTest, RelationshipsOwnIndependentStablePropertyCollections) {
    RepresentationDocument document;
    auto& source = document.createEntity(RepresentationType{"Node"});
    auto& target = document.createEntity(RepresentationType{"Node"});
    auto& relationship =
        document.createRelationship(source, target, RepresentationType{"Edge"});
    const PropertyCollection* const collection_address = &relationship.properties();

    auto& stable = relationship.addProperty(
        "first", RepresentationType{"String"}, RepresentationValue{"stable"});
    const RepresentationProperty* const stable_address = &stable;
    for (std::uint64_t ordinal = 0U; ordinal < 32U; ++ordinal) {
        relationship.addProperty(
            "property-" + std::to_string(ordinal),
            RepresentationType{"Integer"},
            RepresentationValue{static_cast<std::int64_t>(ordinal)});
    }

    EXPECT_EQ(&relationship.properties(), collection_address);
    EXPECT_EQ(&stable, stable_address);
    EXPECT_EQ(stable.name(), "first");
    EXPECT_EQ(stable.value().asString(), "stable");
    EXPECT_EQ(relationship.properties().size(), 33U);
}

TEST(PropertyTest, EmptyAndDuplicateNamesFailStronglyWithoutConsumingIdentifiers) {
    RepresentationDocument document;
    auto& entity = document.createEntity(RepresentationType{"Node"});

    const auto original_properties = ids_of(entity.properties());
    EXPECT_THROW(
        entity.addProperty(
            "", RepresentationType{"String"}, RepresentationValue{"invalid"}),
        std::invalid_argument);
    EXPECT_EQ(ids_of(entity.properties()), original_properties);

    auto& first =
        entity.addProperty("name", RepresentationType{"String"}, RepresentationValue{"first"});
    const auto after_first = ids_of(entity.properties());
    EXPECT_THROW(
        entity.addProperty(
            "name", RepresentationType{"Other"}, RepresentationValue{"duplicate"}),
        std::invalid_argument);
    EXPECT_EQ(ids_of(entity.properties()), after_first);

    const auto& next = document.createEntity(RepresentationType{"Next"});
    EXPECT_EQ(first.id().toString(), expected_id(2U));
    EXPECT_EQ(next.id().toString(), expected_id(3U));
}

TEST(PropertyTest, RelationshipPropertyPreconditionsAreStrongAndOwnerLocal) {
    RepresentationDocument document;
    auto& source = document.createEntity(RepresentationType{"Source"});
    auto& target = document.createEntity(RepresentationType{"Target"});
    source.addProperty(
        "shared-name", RepresentationType{"String"}, RepresentationValue{"entity"});
    auto& relationship =
        document.createRelationship(source, target, RepresentationType{"Connects"});

    const auto original_properties = ids_of(relationship.properties());
    EXPECT_THROW(
        relationship.addProperty(
            "", RepresentationType{"String"}, RepresentationValue{"invalid"}),
        std::invalid_argument);
    EXPECT_EQ(ids_of(relationship.properties()), original_properties);

    auto& first = relationship.addProperty(
        "shared-name", RepresentationType{"String"}, RepresentationValue{"relationship"});
    const auto after_first = ids_of(relationship.properties());
    EXPECT_THROW(
        relationship.addProperty(
            "shared-name",
            RepresentationType{"Other"},
            RepresentationValue{"duplicate"}),
        std::invalid_argument);
    EXPECT_EQ(ids_of(relationship.properties()), after_first);

    const auto& next = document.createEntity(RepresentationType{"Next"});
    EXPECT_EQ(first.id().toString(), expected_id(5U));
    EXPECT_EQ(next.id().toString(), expected_id(6U));
}

TEST(ValueTest, EveryMandatoryValueCategoryHasItsStronglyTypedConstructionPath) {
    const RepresentationValue boolean{true};
    const RepresentationValue integer{std::int64_t{-42}};
    const RepresentationValue floating_point{3.5};
    const RepresentationValue owning_string{std::string{"owned"}};
    const RepresentationValue character_string{"literal"};
    const RepresentationValue enumeration{EnumerationValue{"Ready"}};
    const RepresentationValue identifier{RepresentationId{"object-id"}};
    const RepresentationValue collection{std::vector<RepresentationValue>{
        RepresentationValue{false},
        RepresentationValue{std::int64_t{9}},
        RepresentationValue{"nested"},
    }};

    EXPECT_EQ(boolean.kind(), ValueKind::Boolean);
    EXPECT_TRUE(boolean.asBoolean());
    EXPECT_EQ(integer.kind(), ValueKind::Integer);
    EXPECT_EQ(integer.asInteger(), -42);
    EXPECT_EQ(floating_point.kind(), ValueKind::FloatingPoint);
    EXPECT_DOUBLE_EQ(floating_point.asFloatingPoint(), 3.5);
    EXPECT_EQ(owning_string.kind(), ValueKind::String);
    EXPECT_EQ(owning_string.asString(), "owned");
    EXPECT_EQ(character_string.kind(), ValueKind::String);
    EXPECT_EQ(character_string.asString(), "literal");
    EXPECT_EQ(enumeration.kind(), ValueKind::Enumeration);
    EXPECT_EQ(enumeration.asString(), "Ready");
    EXPECT_EQ(identifier.kind(), ValueKind::Identifier);
    EXPECT_EQ(identifier.asIdentifier(), RepresentationId{"object-id"});
    ASSERT_EQ(collection.kind(), ValueKind::Collection);
    ASSERT_EQ(collection.asCollection().size(), 3U);
    EXPECT_FALSE(collection.asCollection()[0].asBoolean());
    EXPECT_EQ(collection.asCollection()[1].asInteger(), 9);
    EXPECT_EQ(collection.asCollection()[2].asString(), "nested");
}

TEST(ValueTest, EnumerationTextIsDistinctFromOrdinaryStringText) {
    const EnumerationValue enumeration_text{"Running"};
    const RepresentationValue enumeration{enumeration_text};
    const RepresentationValue string{std::string{"Running"}};

    EXPECT_EQ(enumeration_text.value(), "Running");
    EXPECT_EQ(enumeration.kind(), ValueKind::Enumeration);
    EXPECT_EQ(string.kind(), ValueKind::String);
    EXPECT_EQ(enumeration.asString(), string.asString());
}

TEST(ValueTest, IncompatibleAccessAndNullCharacterPointerUseStandardExceptions) {
    const RepresentationValue boolean{true};
    const RepresentationValue integer{std::int64_t{1}};
    const RepresentationValue floating_point{1.0};
    const RepresentationValue string{"text"};
    const RepresentationValue identifier{RepresentationId{"id"}};
    const RepresentationValue collection{std::vector<RepresentationValue>{}};

    EXPECT_THROW(boolean.asInteger(), std::bad_variant_access);
    EXPECT_THROW(integer.asFloatingPoint(), std::bad_variant_access);
    EXPECT_THROW(floating_point.asString(), std::bad_variant_access);
    EXPECT_THROW(string.asBoolean(), std::bad_variant_access);
    EXPECT_THROW(identifier.asCollection(), std::bad_variant_access);
    EXPECT_THROW(collection.asIdentifier(), std::bad_variant_access);
    EXPECT_THROW(
        RepresentationValue{static_cast<const char*>(nullptr)}, std::invalid_argument);
}

TEST(ValueTest, ReturnedViewsAndReferencesRemainValidAcrossCopiesAndSourceAssignment) {
    RepresentationId source_id{"stable-id"};
    RepresentationType source_type{"StableType"};
    RepresentationValue source_value{std::string{"stable-value"}};
    RepresentationMetadata source_metadata{"author", "version", "provenance"};

    const std::string_view id_view = source_id.value();
    const std::string_view type_view = source_type.name();
    const std::string_view value_view = source_value.asString();
    const std::string_view author_view = source_metadata.author();

    RepresentationId target_id{"target"};
    RepresentationType target_type{"Target"};
    RepresentationValue target_value{"target"};
    RepresentationMetadata target_metadata;
    target_id = source_id;
    target_type = source_type;
    target_value = source_value;
    target_metadata = source_metadata;

    EXPECT_EQ(id_view, "stable-id");
    EXPECT_EQ(type_view, "StableType");
    EXPECT_EQ(value_view, "stable-value");
    EXPECT_EQ(author_view, "author");
    EXPECT_EQ(target_id.value(), id_view);
    EXPECT_EQ(target_type.name(), type_view);
    EXPECT_EQ(target_value.asString(), value_view);
    EXPECT_EQ(target_metadata.provenance(), "provenance");
}

TEST(TypeTest, TypeNamesAreExactCaseSensitiveAndEmptyNamesAreRepresentable) {
    const RepresentationType upper{"Node"};
    const RepresentationType same{"Node"};
    const RepresentationType lower{"node"};
    const RepresentationType empty{""};

    EXPECT_EQ(upper.name(), "Node");
    EXPECT_EQ(upper, same);
    EXPECT_FALSE(upper == lower);
    EXPECT_TRUE(empty.name().empty());
}

TEST(ValidationTest, ValidDocumentsProduceAStableReadOnlySuccessfulResult) {
    RepresentationDocument document;
    EXPECT_EQ(RepresentationInternalAccess::lifecycleState(document),
              RepresentationLifecycleState::Mutable);
    auto& source = document.createEntity(RepresentationType{"Source"});
    auto& target = document.createEntity(RepresentationType{"Target"});
    source.addProperty(
        "enabled", RepresentationType{"Boolean"}, RepresentationValue{true});
    auto& relationship =
        document.createRelationship(source, target, RepresentationType{"Connects"});
    relationship.addProperty(
        "weight", RepresentationType{"Integer"}, RepresentationValue{std::int64_t{3}});
    const DocumentSnapshot before = snapshot_of(document);
    const auto source_properties = ids_of(source.properties());
    const auto relationship_properties = ids_of(relationship.properties());

    ValidationService validation;
    const ValidationResult first = validation.validate(document);
    const ValidationResult second = validation.validate(document);

    EXPECT_TRUE(first.valid);
    EXPECT_TRUE(first.diagnostics.empty());
    EXPECT_TRUE(second.valid);
    EXPECT_EQ(fingerprint_of(first.diagnostics), fingerprint_of(second.diagnostics));
    EXPECT_EQ(snapshot_of(document), before);
    EXPECT_EQ(RepresentationInternalAccess::lifecycleState(document),
              RepresentationLifecycleState::Mutable);
    EXPECT_EQ(ids_of(source.properties()), source_properties);
    EXPECT_EQ(ids_of(relationship.properties()), relationship_properties);
}

TEST(ValidationTest, ValidationRecursesAndReportsEveryMissingTypeDeterministically) {
    RepresentationDocument document;
    auto& first = document.createEntity(RepresentationType{""});
    auto& second = document.createEntity(RepresentationType{"Valid"});
    auto& first_property = first.addProperty(
        "first-empty", RepresentationType{""}, RepresentationValue{"value"});
    auto& second_property = second.addProperty(
        "second-empty", RepresentationType{""}, RepresentationValue{"value"});
    auto& relationship =
        document.createRelationship(first, second, RepresentationType{""});
    auto& relationship_property = relationship.addProperty(
        "relationship-empty", RepresentationType{""}, RepresentationValue{"value"});
    const DocumentSnapshot before = snapshot_of(document);
    const std::array<std::string, 5U> expected_diagnostic_subjects{
        first.id().toString(),
        first_property.id().toString(),
        second_property.id().toString(),
        relationship.id().toString(),
        relationship_property.id().toString(),
    };

    ValidationService validation;
    const ValidationResult first_result = validation.validate(document);
    const ValidationResult second_result = validation.validate(document);

    EXPECT_FALSE(first_result.valid);
    ASSERT_EQ(first_result.diagnostics.size(), 5U);
    for (std::size_t index = 0U;
         index < first_result.diagnostics.size();
         ++index) {
        const auto& diagnostic = first_result.diagnostics[index];
        EXPECT_EQ(diagnostic.code, DiagnosticCode::MissingType);
        EXPECT_EQ(diagnostic.severity, DiagnosticSeverity::Error);
        EXPECT_FALSE(diagnostic.message.empty());
        EXPECT_NE(
            diagnostic.message.find(expected_diagnostic_subjects[index]),
            std::string::npos);
    }
    EXPECT_EQ(fingerprint_of(first_result.diagnostics),
              fingerprint_of(second_result.diagnostics));
    EXPECT_EQ(snapshot_of(document), before);
}

TEST(ValidationTest, DiagnosticCategoriesHaveTheNormativeAscendingOrder) {
    EXPECT_LT(static_cast<int>(DiagnosticCode::None),
              static_cast<int>(DiagnosticCode::DuplicateIdentifier));
    EXPECT_LT(static_cast<int>(DiagnosticCode::DuplicateIdentifier),
              static_cast<int>(DiagnosticCode::MissingType));
    EXPECT_LT(static_cast<int>(DiagnosticCode::MissingType),
              static_cast<int>(DiagnosticCode::DuplicateProperty));
    EXPECT_LT(static_cast<int>(DiagnosticCode::DuplicateProperty),
              static_cast<int>(DiagnosticCode::InvalidRelationship));
    EXPECT_LT(static_cast<int>(DiagnosticCode::InvalidRelationship),
              static_cast<int>(DiagnosticCode::FrozenDocument));
    EXPECT_LT(static_cast<int>(DiagnosticCode::FrozenDocument),
              static_cast<int>(DiagnosticCode::ValidationError));
    EXPECT_LT(static_cast<int>(DiagnosticCode::ValidationError),
              static_cast<int>(DiagnosticCode::TransactionError));
    EXPECT_LT(static_cast<int>(DiagnosticSeverity::Information),
              static_cast<int>(DiagnosticSeverity::Warning));
    EXPECT_LT(static_cast<int>(DiagnosticSeverity::Warning),
              static_cast<int>(DiagnosticSeverity::Error));
}

TEST(TransactionTest, BeginCapturesAValidBaselineWithoutChangingObservableState) {
    RepresentationDocument document;
    document.createEntity(RepresentationType{"Baseline"});
    const DocumentSnapshot before = snapshot_of(document);

    TransactionService service;
    auto transaction = service.begin(document);

    EXPECT_TRUE(transaction.active());
    EXPECT_EQ(snapshot_of(document), before);
    transaction.rollback();
    EXPECT_FALSE(transaction.active());
    EXPECT_EQ(snapshot_of(document), before);
}

TEST(TransactionTest, NestedFrozenAndInvalidBaselineBeginsAreRejectedStrongly) {
    TransactionService service;

    RepresentationDocument active_document;
    active_document.createEntity(RepresentationType{"Valid"});
    auto active = service.begin(active_document);
    const DocumentSnapshot active_before = snapshot_of(active_document);
    EXPECT_THROW(service.begin(active_document), std::logic_error);
    EXPECT_TRUE(active.active());
    EXPECT_EQ(snapshot_of(active_document), active_before);
    active.rollback();

    RepresentationDocument frozen_document;
    frozen_document.createEntity(RepresentationType{"Valid"});
    ASSERT_TRUE(FreezeService{}.freeze(frozen_document).valid);
    const DocumentSnapshot frozen_before = snapshot_of(frozen_document);
    EXPECT_THROW(service.begin(frozen_document), std::logic_error);
    EXPECT_EQ(snapshot_of(frozen_document), frozen_before);

    RepresentationDocument invalid_document;
    auto& invalid = invalid_document.createEntity(RepresentationType{""});
    const RepresentationId invalid_id = invalid.id();
    const DocumentSnapshot invalid_before = snapshot_of(invalid_document);
    EXPECT_THROW(service.begin(invalid_document), std::logic_error);
    EXPECT_EQ(snapshot_of(invalid_document), invalid_before);
    invalid_document.removeEntity(invalid_id);
    const auto& next = invalid_document.createEntity(RepresentationType{"Valid"});
    EXPECT_EQ(next.id().toString(), expected_id(2U));
}

TEST(TransactionTest, SuccessfulCommitValidatesPersistsAndDeactivates) {
    RepresentationDocument document;
    EXPECT_EQ(RepresentationInternalAccess::lifecycleState(document),
              RepresentationLifecycleState::Mutable);
    TransactionService service;
    QueryService query;
    auto transaction = service.begin(document);
    auto& entity = document.createEntity(RepresentationType{"Committed"});
    const RepresentationId entity_id = entity.id();

    const ValidationResult result = transaction.commit();

    EXPECT_TRUE(result.valid);
    EXPECT_TRUE(result.diagnostics.empty());
    EXPECT_FALSE(transaction.active());
    EXPECT_EQ(RepresentationInternalAccess::lifecycleState(document),
              RepresentationLifecycleState::Validated);
    ASSERT_NE(query.findEntity(document, entity_id), nullptr);
    EXPECT_EQ(query.findEntity(document, entity_id)->type().name(), "Committed");
    EXPECT_THROW(transaction.commit(), std::logic_error);
    EXPECT_THROW(transaction.rollback(), std::logic_error);

    const ValidationResult frozen = FreezeService{}.freeze(document);
    EXPECT_TRUE(frozen.valid);
    EXPECT_EQ(RepresentationInternalAccess::lifecycleState(document),
              RepresentationLifecycleState::Frozen);
}

TEST(TransactionTest, FailedCommitPreservesTentativeStateAndAllowsRepair) {
    RepresentationDocument document;
    auto& baseline = document.createEntity(RepresentationType{"Baseline"});
    const RepresentationId baseline_id = baseline.id();
    TransactionService service;
    QueryService query;
    auto transaction = service.begin(document);
    auto& invalid = document.createEntity(RepresentationType{""});
    const RepresentationId invalid_id = invalid.id();

    const ValidationResult failed = transaction.commit();

    EXPECT_FALSE(failed.valid);
    EXPECT_TRUE(transaction.active());
    EXPECT_NE(query.findEntity(document, invalid_id), nullptr);
    EXPECT_NE(query.findEntity(document, baseline_id), nullptr);

    document.removeEntity(invalid_id);
    const ValidationResult repaired = transaction.commit();
    EXPECT_TRUE(repaired.valid);
    EXPECT_FALSE(transaction.active());
    EXPECT_EQ(query.findEntity(document, invalid_id), nullptr);
    EXPECT_NE(query.findEntity(document, baseline_id), nullptr);

    const auto& next = document.createEntity(RepresentationType{"Next"});
    EXPECT_EQ(next.id().toString(), expected_id(3U));
}

TEST(TransactionTest, RollbackRestoresSemanticStateOrderAndRetiresAllTentativeIds) {
    RepresentationDocument document;
    auto& source = document.createEntity(RepresentationType{"Source"});
    auto& target = document.createEntity(RepresentationType{"Target"});
    auto& source_property = source.addProperty(
        "baseline", RepresentationType{"String"}, RepresentationValue{"kept"});
    auto& target_rank = target.addProperty(
        "rank",
        RepresentationType{"Integer"},
        RepresentationValue{std::int64_t{17}});
    auto& target_label = target.addProperty(
        "label",
        RepresentationType{"String"},
        RepresentationValue{"target-kept"});
    auto& relationship =
        document.createRelationship(source, target, RepresentationType{"Connects"});
    auto& relationship_property = relationship.addProperty(
        "baseline-edge", RepresentationType{"Boolean"}, RepresentationValue{true});
    auto& relationship_label = relationship.addProperty(
        "edge-label",
        RepresentationType{"String"},
        RepresentationValue{"relationship-kept"});
    auto& observer = document.createEntity(RepresentationType{"Observer"});
    auto& retained_relationship = document.createRelationship(
        source, observer, RepresentationType{"Observes"});

    const RepresentationId source_id = source.id();
    const RepresentationId target_id = target.id();
    const RepresentationId observer_id = observer.id();
    const RepresentationId source_property_id = source_property.id();
    const RepresentationId target_rank_id = target_rank.id();
    const RepresentationId target_label_id = target_label.id();
    const RepresentationId relationship_id = relationship.id();
    const RepresentationId retained_relationship_id = retained_relationship.id();
    const RepresentationId relationship_property_id = relationship_property.id();
    const RepresentationId relationship_label_id = relationship_label.id();
    TransactionService service;
    {
        auto establish_validated_baseline = service.begin(document);
        ASSERT_TRUE(establish_validated_baseline.commit().valid);
    }
    ASSERT_EQ(RepresentationInternalAccess::lifecycleState(document),
              RepresentationLifecycleState::Validated);
    const DocumentSnapshot baseline = snapshot_of(document);

    QueryService query;
    auto transaction = service.begin(document);
    auto& discarded_source_property = source.addProperty(
        "discarded",
        RepresentationType{"String"},
        RepresentationValue{"discarded"});
    auto& discarded_target_property = target.addProperty(
        "discarded",
        RepresentationType{"String"},
        RepresentationValue{"discarded"});
    auto& discarded_relationship_property = relationship.addProperty(
        "discarded",
        RepresentationType{"String"},
        RepresentationValue{"discarded"});
    auto& discarded_retained_relationship_property =
        retained_relationship.addProperty(
            "discarded",
            RepresentationType{"String"},
            RepresentationValue{"discarded"});
    const RepresentationId discarded_source_property_id =
        discarded_source_property.id();
    const RepresentationId discarded_target_property_id =
        discarded_target_property.id();
    const RepresentationId discarded_relationship_property_id =
        discarded_relationship_property.id();
    const RepresentationId discarded_retained_relationship_property_id =
        discarded_retained_relationship_property.id();
    document.removeRelationship(relationship_id);
    document.removeEntity(target_id);
    auto& tentative = document.createEntity(RepresentationType{"Tentative"});
    const RepresentationId tentative_id = tentative.id();
    auto& tentative_property = tentative.addProperty(
        "tentative", RepresentationType{"String"}, RepresentationValue{"temporary"});
    const RepresentationId tentative_property_id = tentative_property.id();
    EXPECT_EQ(RepresentationInternalAccess::lifecycleState(document),
              RepresentationLifecycleState::Mutable);

    transaction.rollback();

    EXPECT_FALSE(transaction.active());
    EXPECT_EQ(RepresentationInternalAccess::lifecycleState(document),
              RepresentationLifecycleState::Validated);
    EXPECT_EQ(snapshot_of(document), baseline);
    EXPECT_EQ(query.findEntity(document, tentative_id), nullptr);
    EXPECT_EQ(query.findEntity(document, source_id), &source);
    EXPECT_EQ(query.findEntity(document, observer_id), &observer);
    const auto* restored_target = query.findEntity(document, target_id);
    ASSERT_EQ(restored_target, &target);
    const auto* restored_relationship =
        query.findRelationship(document, relationship_id);
    ASSERT_EQ(restored_relationship, &relationship);
    EXPECT_EQ(query.findRelationship(document, retained_relationship_id),
              &retained_relationship);
    EXPECT_EQ(restored_relationship->source().id(), source_id);
    EXPECT_EQ(restored_relationship->target().id(), target_id);
    EXPECT_EQ(source.type().name(), "Source");
    EXPECT_EQ(restored_target->type().name(), "Target");
    EXPECT_EQ(restored_relationship->type().name(), "Connects");
    ASSERT_EQ(query.findEntity(document, source_id)->properties().size(), 1U);
    EXPECT_EQ(query.findEntity(document, source_id)->properties().front().get().id(),
              source_property_id);
    EXPECT_EQ(source.property("discarded"), nullptr);
    EXPECT_EQ(target.property("discarded"), nullptr);
    EXPECT_EQ(&query.findEntity(document, source_id)->properties().front().get(),
              &source_property);
    EXPECT_EQ(source_property.name(), "baseline");
    EXPECT_EQ(source_property.type().name(), "String");
    EXPECT_EQ(source_property.value().asString(), "kept");
    ASSERT_EQ(restored_target->properties().size(), 2U);
    EXPECT_EQ(property_names_of(restored_target->properties()),
              (std::vector<std::string>{"rank", "label"}));
    EXPECT_EQ(&restored_target->properties()[0].get(), &target_rank);
    EXPECT_EQ(target_rank.id(), target_rank_id);
    EXPECT_EQ(target_rank.type().name(), "Integer");
    EXPECT_EQ(target_rank.value().asInteger(), 17);
    EXPECT_EQ(&restored_target->properties()[1].get(), &target_label);
    EXPECT_EQ(target_label.id(), target_label_id);
    EXPECT_EQ(target_label.type().name(), "String");
    EXPECT_EQ(target_label.value().asString(), "target-kept");
    ASSERT_EQ(restored_relationship->properties().size(), 2U);
    EXPECT_EQ(property_names_of(restored_relationship->properties()),
              (std::vector<std::string>{"baseline-edge", "edge-label"}));
    EXPECT_EQ(restored_relationship->properties().front().get().id(),
              relationship_property_id);
    EXPECT_EQ(&restored_relationship->properties().front().get(),
              &relationship_property);
    EXPECT_EQ(relationship_property.type().name(), "Boolean");
    EXPECT_TRUE(relationship_property.value().asBoolean());
    EXPECT_EQ(&restored_relationship->properties()[1].get(),
              &relationship_label);
    EXPECT_EQ(relationship_label.id(), relationship_label_id);
    EXPECT_EQ(relationship_label.type().name(), "String");
    EXPECT_EQ(relationship_label.value().asString(), "relationship-kept");
    EXPECT_TRUE(retained_relationship.properties().empty());

    const auto& after_rollback = document.createEntity(RepresentationType{"AfterRollback"});
    EXPECT_EQ(discarded_source_property_id.toString(), expected_id(11U));
    EXPECT_EQ(discarded_target_property_id.toString(), expected_id(12U));
    EXPECT_EQ(discarded_relationship_property_id.toString(), expected_id(13U));
    EXPECT_EQ(discarded_retained_relationship_property_id.toString(),
              expected_id(14U));
    EXPECT_EQ(tentative_id.toString(), expected_id(15U));
    EXPECT_EQ(tentative_property_id.toString(), expected_id(16U));
    EXPECT_EQ(after_rollback.id().toString(), expected_id(17U));

    const auto& source_after_rollback = source.addProperty(
        "after-rollback",
        RepresentationType{"String"},
        RepresentationValue{"source"});
    const auto& target_after_rollback = target.addProperty(
        "after-rollback",
        RepresentationType{"String"},
        RepresentationValue{"target"});
    const auto& relationship_after_rollback = relationship.addProperty(
        "after-rollback",
        RepresentationType{"String"},
        RepresentationValue{"relationship"});
    const auto& retained_relationship_after_rollback =
        retained_relationship.addProperty(
            "after-rollback",
            RepresentationType{"String"},
            RepresentationValue{"retained-relationship"});
    const auto& new_relationship = document.createRelationship(
        source, target, RepresentationType{"AfterRollback"});

    EXPECT_EQ(source_after_rollback.id().toString(), expected_id(18U));
    EXPECT_EQ(target_after_rollback.id().toString(), expected_id(19U));
    EXPECT_EQ(relationship_after_rollback.id().toString(), expected_id(20U));
    EXPECT_EQ(retained_relationship_after_rollback.id().toString(),
              expected_id(21U));
    EXPECT_EQ(new_relationship.id().toString(), expected_id(22U));
    EXPECT_EQ(source.property("after-rollback"), &source_after_rollback);
    EXPECT_EQ(target.property("after-rollback"), &target_after_rollback);
    EXPECT_EQ(relationship.properties().back().get().id(),
              relationship_after_rollback.id());
    EXPECT_EQ(retained_relationship.properties().back().get().id(),
              retained_relationship_after_rollback.id());
    EXPECT_EQ(&new_relationship.source(), &source);
    EXPECT_EQ(&new_relationship.target(), &target);
    EXPECT_EQ(document.relationships().back().get().id(),
              new_relationship.id());
}

TEST(TransactionTest, DestroyingAnActiveHandleRollsBackWithoutThrowing) {
    RepresentationDocument document;
    auto& baseline = document.createEntity(RepresentationType{"Baseline"});
    const RepresentationId baseline_id = baseline.id();
    RepresentationId tentative_id{"unset"};

    {
        auto transaction = TransactionService{}.begin(document);
        auto& tentative = document.createEntity(RepresentationType{"Tentative"});
        tentative_id = tentative.id();
        ASSERT_TRUE(transaction.active());
    }

    QueryService query;
    EXPECT_NE(query.findEntity(document, baseline_id), nullptr);
    EXPECT_EQ(query.findEntity(document, tentative_id), nullptr);
    const auto& next = document.createEntity(RepresentationType{"Next"});
    EXPECT_EQ(next.id().toString(), expected_id(3U));
}

TEST(TransactionTest, MoveConstructionTransfersTheOnlyActiveHandle) {
    RepresentationDocument document;
    auto source = TransactionService{}.begin(document);
    auto& entity = document.createEntity(RepresentationType{"MovedTransaction"});
    const RepresentationId entity_id = entity.id();

    Transaction destination{std::move(source)};

    EXPECT_FALSE(source.active());
    EXPECT_TRUE(destination.active());
    EXPECT_THROW(source.commit(), std::logic_error);
    EXPECT_THROW(source.rollback(), std::logic_error);
    EXPECT_TRUE(destination.commit().valid);
    EXPECT_FALSE(destination.active());
    EXPECT_NE(QueryService{}.findEntity(document, entity_id), nullptr);
}

TEST(TransactionTest, MoveAssignmentRollsBackItsActiveHandleBeforeTransfer) {
    RepresentationDocument first_document;
    RepresentationDocument second_document;
    auto& first_baseline = first_document.createEntity(RepresentationType{"FirstBaseline"});
    auto& second_baseline =
        second_document.createEntity(RepresentationType{"SecondBaseline"});
    const RepresentationId first_baseline_id = first_baseline.id();
    const RepresentationId second_baseline_id = second_baseline.id();

    TransactionService service;
    auto destination = service.begin(first_document);
    auto& first_tentative =
        first_document.createEntity(RepresentationType{"FirstTentative"});
    const RepresentationId first_tentative_id = first_tentative.id();

    auto source = service.begin(second_document);
    auto& second_tentative =
        second_document.createEntity(RepresentationType{"SecondTentative"});
    const RepresentationId second_tentative_id = second_tentative.id();

    destination = std::move(source);

    QueryService query;
    EXPECT_FALSE(source.active());
    EXPECT_TRUE(destination.active());
    EXPECT_NE(query.findEntity(first_document, first_baseline_id), nullptr);
    EXPECT_EQ(query.findEntity(first_document, first_tentative_id), nullptr);
    EXPECT_NE(query.findEntity(second_document, second_baseline_id), nullptr);
    EXPECT_NE(query.findEntity(second_document, second_tentative_id), nullptr);

    destination.rollback();
    EXPECT_FALSE(destination.active());
    EXPECT_EQ(query.findEntity(second_document, second_tentative_id), nullptr);

    const auto& first_next = first_document.createEntity(RepresentationType{"FirstNext"});
    const auto& second_next =
        second_document.createEntity(RepresentationType{"SecondNext"});
    EXPECT_EQ(first_next.id().toString(), expected_id(3U));
    EXPECT_EQ(second_next.id().toString(), expected_id(3U));
}

TEST(TransactionTest, SuccessfulMutationAfterCommitCanBeRevalidatedAndFrozen) {
    RepresentationDocument document;
    EXPECT_EQ(RepresentationInternalAccess::lifecycleState(document),
              RepresentationLifecycleState::Mutable);
    auto initial = TransactionService{}.begin(document);
    document.createEntity(RepresentationType{"Initial"});
    ASSERT_TRUE(initial.commit().valid);
    EXPECT_EQ(RepresentationInternalAccess::lifecycleState(document),
              RepresentationLifecycleState::Validated);

    const auto& direct = document.createEntity(RepresentationType{"DirectAfterCommit"});
    EXPECT_EQ(direct.id().toString(), expected_id(2U));
    EXPECT_EQ(RepresentationInternalAccess::lifecycleState(document),
              RepresentationLifecycleState::Mutable);

    const ValidationResult frozen = FreezeService{}.freeze(document);
    EXPECT_TRUE(frozen.valid);
    EXPECT_TRUE(document.isFrozen());
    EXPECT_EQ(RepresentationInternalAccess::lifecycleState(document),
              RepresentationLifecycleState::Frozen);
}

TEST(FreezeTest, FreezeValidatesAtomicallyAndIsIdempotent) {
    RepresentationDocument document;
    auto& entity = document.createEntity(RepresentationType{"Node"});
    const RepresentationId entity_id = entity.id();
    FreezeService freeze;

    const ValidationResult first = freeze.freeze(document);
    const ValidationResult second = freeze.freeze(document);

    EXPECT_TRUE(first.valid);
    EXPECT_TRUE(second.valid);
    EXPECT_TRUE(document.isFrozen());
    EXPECT_EQ(fingerprint_of(first.diagnostics), fingerprint_of(second.diagnostics));
    EXPECT_NE(QueryService{}.findEntity(document, entity_id), nullptr);
}

TEST(FreezeTest, InvalidDocumentIsReportedAndLifecycleAndStateRemainUnchanged) {
    RepresentationDocument document;
    auto& invalid = document.createEntity(RepresentationType{""});
    const RepresentationId invalid_id = invalid.id();
    const DocumentSnapshot before = snapshot_of(document);

    const ValidationResult result = FreezeService{}.freeze(document);

    EXPECT_FALSE(result.valid);
    EXPECT_FALSE(result.diagnostics.empty());
    EXPECT_FALSE(document.isFrozen());
    EXPECT_EQ(snapshot_of(document), before);
    document.removeEntity(invalid_id);
    EXPECT_TRUE(FreezeService{}.freeze(document).valid);
}

TEST(FreezeTest, ActiveTransactionProducesOneTransactionErrorAndChangesNothing) {
    RepresentationDocument document;
    document.createEntity(RepresentationType{"Baseline"});
    auto transaction = TransactionService{}.begin(document);
    auto& tentative = document.createEntity(RepresentationType{"Tentative"});
    const RepresentationId tentative_id = tentative.id();
    const DocumentSnapshot before = snapshot_of(document);

    const ValidationResult result = FreezeService{}.freeze(document);

    EXPECT_FALSE(result.valid);
    ASSERT_EQ(result.diagnostics.size(), 1U);
    EXPECT_EQ(result.diagnostics.front().code, DiagnosticCode::TransactionError);
    EXPECT_EQ(result.diagnostics.front().severity, DiagnosticSeverity::Error);
    EXPECT_TRUE(transaction.active());
    EXPECT_FALSE(document.isFrozen());
    EXPECT_EQ(snapshot_of(document), before);
    EXPECT_NE(QueryService{}.findEntity(document, tentative_id), nullptr);
    transaction.rollback();
}

TEST(FreezeTest, AllSemanticMutatorsRejectAndFrozenPrecedenceIsUniform) {
    RepresentationDocument document;
    RepresentationDocument foreign_document;
    auto& source = document.createEntity(RepresentationType{"Source"});
    auto& target = document.createEntity(RepresentationType{"Target"});
    auto& foreign = foreign_document.createEntity(RepresentationType{"Foreign"});
    auto& source_property = source.addProperty(
        "existing", RepresentationType{"String"}, RepresentationValue{"value"});
    auto& relationship =
        document.createRelationship(source, target, RepresentationType{"Connects"});
    auto& relationship_property = relationship.addProperty(
        "existing", RepresentationType{"String"}, RepresentationValue{"value"});
    const auto source_properties = ids_of(source.properties());
    const auto relationship_properties = ids_of(relationship.properties());

    ASSERT_TRUE(FreezeService{}.freeze(document).valid);
    const DocumentSnapshot frozen_before = snapshot_of(document);

    EXPECT_THROW(document.createEntity(RepresentationType{""}), std::logic_error);
    EXPECT_THROW(
        document.createRelationship(
            foreign, foreign, RepresentationType{"ForeignEndpoints"}),
        std::logic_error);
    EXPECT_THROW(
        source.addProperty("", RepresentationType{""}, RepresentationValue{"invalid"}),
        std::logic_error);
    EXPECT_THROW(
        source.addProperty(
            std::string{source_property.name()},
            RepresentationType{"Duplicate"},
            RepresentationValue{"invalid"}),
        std::logic_error);
    EXPECT_THROW(
        relationship.addProperty(
            std::string{relationship_property.name()},
            RepresentationType{"Duplicate"},
            RepresentationValue{"invalid"}),
        std::logic_error);
    EXPECT_THROW(document.removeEntity(RepresentationId{"unknown"}), std::logic_error);
    EXPECT_THROW(
        document.removeRelationship(RepresentationId{"unknown"}), std::logic_error);
    EXPECT_THROW(document.removeEntity(source.id()), std::logic_error);
    EXPECT_THROW(document.removeRelationship(relationship.id()), std::logic_error);

    EXPECT_EQ(snapshot_of(document), frozen_before);
    EXPECT_TRUE(document.isFrozen());
    EXPECT_EQ(ids_of(source.properties()), source_properties);
    EXPECT_EQ(ids_of(relationship.properties()), relationship_properties);
}

TEST(FreezeTest, QueriesAndValidationRemainAvailableAfterFreeze) {
    RepresentationDocument document;
    auto& entity = document.createEntity(RepresentationType{"Node"});
    const RepresentationId entity_id = entity.id();
    ASSERT_TRUE(FreezeService{}.freeze(document).valid);

    const ValidationResult validation = ValidationService{}.validate(document);
    const auto* queried = QueryService{}.findEntity(document, entity_id);
    const auto by_type =
        QueryService{}.entitiesByType(document, RepresentationType{"Node"});

    EXPECT_TRUE(validation.valid);
    ASSERT_NE(queried, nullptr);
    EXPECT_EQ(queried->id(), entity_id);
    ASSERT_EQ(by_type.size(), 1U);
    EXPECT_EQ(&by_type.front().get(), queried);
    EXPECT_TRUE(document.isFrozen());
}

TEST(QueryTest, LookupsAreCategorySpecificAndUnknownIdsReturnNull) {
    RepresentationDocument document;
    auto& source = document.createEntity(RepresentationType{"Node"});
    auto& target = document.createEntity(RepresentationType{"Node"});
    auto& relationship =
        document.createRelationship(source, target, RepresentationType{"Edge"});
    QueryService query;

    EXPECT_EQ(query.findEntity(document, source.id()), &source);
    EXPECT_EQ(query.findRelationship(document, relationship.id()), &relationship);
    EXPECT_EQ(query.findEntity(document, relationship.id()), nullptr);
    EXPECT_EQ(query.findRelationship(document, source.id()), nullptr);
    EXPECT_EQ(query.findEntity(document, RepresentationId{"unknown"}), nullptr);
    EXPECT_EQ(
        query.findRelationship(document, RepresentationId{"unknown"}), nullptr);
}

TEST(QueryTest, TypeQueriesAreExactCaseSensitiveAndPreserveInsertionOrder) {
    RepresentationDocument document;
    auto& first = document.createEntity(RepresentationType{"Node"});
    document.createEntity(RepresentationType{"Other"});
    auto& second = document.createEntity(RepresentationType{"Node"});
    document.createEntity(RepresentationType{"node"});
    auto& third = document.createEntity(RepresentationType{"Node"});
    const DocumentSnapshot before = snapshot_of(document);

    QueryService query;
    const EntityCollection nodes =
        query.entitiesByType(document, RepresentationType{"Node"});
    const EntityCollection lower_nodes =
        query.entitiesByType(document, RepresentationType{"node"});
    const EntityCollection absent =
        query.entitiesByType(document, RepresentationType{"Missing"});

    EXPECT_EQ(ids_of(nodes),
              (std::vector<std::string>{
                  first.id().toString(), second.id().toString(), third.id().toString()}));
    ASSERT_EQ(lower_nodes.size(), 1U);
    EXPECT_EQ(lower_nodes.front().get().type().name(), "node");
    EXPECT_TRUE(absent.empty());
    EXPECT_EQ(snapshot_of(document), before);
}

TEST(QueryTest, QueriesAreSideEffectFreeAndAvailableDuringTransactions) {
    RepresentationDocument document;
    auto& baseline = document.createEntity(RepresentationType{"Node"});
    const RepresentationId baseline_id = baseline.id();
    QueryService query;
    auto transaction = TransactionService{}.begin(document);
    auto& tentative = document.createEntity(RepresentationType{"Node"});
    const RepresentationId tentative_id = tentative.id();
    const DocumentSnapshot before_queries = snapshot_of(document);
    const RepresentationEntity* const baseline_address =
        query.findEntity(document, baseline_id);

    EXPECT_NE(query.findEntity(document, tentative_id), nullptr);
    EXPECT_EQ(query.entitiesByType(document, RepresentationType{"Node"}).size(), 2U);
    EXPECT_EQ(query.findEntity(document, baseline_id), baseline_address);
    EXPECT_EQ(snapshot_of(document), before_queries);

    transaction.rollback();
    EXPECT_NE(query.findEntity(document, baseline_id), nullptr);
    EXPECT_EQ(query.findEntity(document, tentative_id), nullptr);
}

} // namespace

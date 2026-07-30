#include <cca/process/process.hpp>
#include <cca/representation/representation.hpp>
#include <cca/runtime/provider.hpp>
#include <cca/runtime/runtime.hpp>
#include <cca/runtime/runtime_builder.hpp>

#include <gtest/gtest.h>

#include <algorithm>
#include <array>
#include <bit>
#include <cstddef>
#include <cstdint>
#include <future>
#include <iomanip>
#include <memory>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <tuple>
#include <type_traits>
#include <utility>
#include <vector>

#include "../src/process/process_runtime_integration.hpp"
#include "../src/process/process_test_access.hpp"
#include "../src/representation/representation_test_access.hpp"

/*
CCA-PROC-1.0 requirement coverage
---------------------------------
CCA-PROC-001: RuntimeIntegrationTest.ExposesTheProcessDomainServiceThroughRuntime
CCA-PROC-002: ProcessApiTest.PublicSurfacePreservesLayerBoundaries
CCA-PROC-003: RuntimeIntegrationTest.ExposesTheProcessDomainServiceThroughRuntime
CCA-PROC-004: ProcessInputTest.PreservesCompleteMutableValidatedAndFrozenState
CCA-PROC-005: ProcessDeterminismTest.EquivalentSemanticVariantsProduceEqualOutcomes
CCA-PROC-006: RuntimeIntegrationTest.KeepsRuntimeInstancesAndEnginesIsolated
CCA-PROC-007: ProcessDeterminismTest.GraphShapesRemainStructuralAndSideEffectFree
CCA-PROC-008: ProcessDeterminismTest.EquivalentSemanticVariantsProduceEqualOutcomes
CCA-PROC-009: ProcessApiTest.RequiredEmptyDocumentExampleSucceeds
CCA-PROC-010: ProcessInputTest.InvalidDirectInputIsValidatedBeforeExecution
CCA-PROC-011: ProcessInputTest.PreservesCompleteMutableValidatedAndFrozenState
CCA-PROC-012: ProcessInputTest.InvalidDirectInputIsValidatedBeforeExecution
CCA-PROC-013: ProcessDefinitionTest.InvalidConstructionIsDeterministicAndStrong
CCA-PROC-014: ProcessDefinitionTest.MaterializesCanonicalOwnedOrderAndCounts
CCA-PROC-015: ProcessDefinitionTest.PlanSurvivesMutationRemovalRollbackAndDestruction
CCA-PROC-016: ProcessDefinitionTest.MaterializesCanonicalOwnedOrderAndCounts
CCA-PROC-017: ProcessDeterminismTest.GraphShapesRemainStructuralAndSideEffectFree
CCA-PROC-018: ProcessDeterminismTest.EquivalentSemanticVariantsProduceEqualOutcomes
CCA-PROC-019: ProcessApiTest.PublicDeclarationsMatchTheFrozenContract
CCA-PROC-020: ExecutionContextTest.ReadyExecutionCompletesWithTheCanonicalTrace
CCA-PROC-021: ExecutionContextTest.CompletedContextIsOneShotAndRejectedStrongly
CCA-PROC-022: ExecutionContextTest.ContextsOwnIsolatedDefinitionStateAndTraces
CCA-PROC-023: ProcessResultTest.SuccessValuesOwnEveryRequiredInvariant
CCA-PROC-024: ProcessInputTest.InvalidDirectInputIsValidatedBeforeExecution
CCA-PROC-025: ProcessInputTest.InvalidDirectInputIsValidatedBeforeExecution
CCA-PROC-026: ProcessApiTest.RequiredEmptyDocumentExampleSucceeds
CCA-PROC-027: ExecutionContextTest.ReadyExecutionCompletesWithTheCanonicalTrace
CCA-PROC-028: ProcessApiTest.PublicDeclarationsMatchTheFrozenContract
CCA-PROC-029: ProcessEngineTest.AllValidEntrySurfacesAreEquivalent
CCA-PROC-030: ProcessDefinitionTest.InvalidConstructionIsDeterministicAndStrong;
              ExecutionContextTest.CompletedContextIsOneShotAndRejectedStrongly
CCA-PROC-031: RuntimeIntegrationTest.ExposesTheProcessDomainServiceThroughRuntime
CCA-PROC-032: ProcessApiTest.PublicSurfacePreservesLayerBoundaries
CCA-PROC-033: RuntimeIntegrationTest.ProviderLifecycleSurroundsHostedExecution
CCA-PROC-034: RuntimeIntegrationTest.KeepsRuntimeInstancesAndEnginesIsolated
CCA-PROC-035: RuntimeIntegrationTest.InvalidInputDoesNotFailTheRunningRuntime
CCA-PROC-036: ProcessThreadSafetyTest.SupportsTheDocumentedConcurrentOperations
CCA-PROC-037: ProcessApiTest.PublicDeclarationsMatchTheFrozenContract
CCA-PROC-038: this table and the complete Process Foundation test suite
*/

namespace {

using cca::process::ExecutionContext;
using cca::process::ExecutionResult;
using cca::process::ExecutionState;
using cca::process::ProcessDefinition;
using cca::process::ProcessEngine;
using cca::process::ProcessInternalAccess;
using cca::representation::Diagnostic;
using cca::representation::DiagnosticCode;
using cca::representation::DiagnosticSeverity;
using cca::representation::FreezeService;
using cca::representation::PropertyCollection;
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
using cca::representation::TransactionService;
using cca::representation::ValidationService;
using cca::representation::ValueKind;
using cca::runtime::Runtime;
using cca::runtime::RuntimeBuilder;
using cca::runtime::RuntimeContext;
using cca::runtime::RuntimeId;
using cca::runtime::RuntimeMetric;
using cca::runtime::RuntimeResult;
using cca::runtime::RuntimeState;
using cca::runtime::ServiceProvider;

[[nodiscard]] std::string expected_id(const std::uint64_t ordinal) {
    std::ostringstream stream;
    stream << "cca-rep-" << std::hex << std::nouppercase << std::setfill('0')
           << std::setw(16) << ordinal;
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

[[nodiscard]] std::vector<std::string>
ids_of(const std::vector<RepresentationId>& ids) {
    std::vector<std::string> values;
    values.reserve(ids.size());
    for (const auto& id : ids) {
        values.push_back(id.toString());
    }
    return values;
}

[[nodiscard]] std::vector<std::string>
ids_of(const ProcessDefinition& definition) {
    std::vector<std::string> ids;
    ids.reserve(definition.executionOrder().size());
    for (const auto& id : definition.executionOrder()) {
        ids.push_back(id.toString());
    }
    return ids;
}

using DiagnosticFingerprint =
    std::tuple<DiagnosticCode, DiagnosticSeverity, std::string>;

[[nodiscard]] std::vector<DiagnosticFingerprint>
fingerprint_of(const std::vector<Diagnostic>& diagnostics) {
    std::vector<DiagnosticFingerprint> fingerprint;
    fingerprint.reserve(diagnostics.size());
    for (const auto& diagnostic : diagnostics) {
        fingerprint.emplace_back(
            diagnostic.code, diagnostic.severity, diagnostic.message);
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
    RepresentationLifecycleState lifecycle{
        RepresentationLifecycleState::Mutable};
    bool frozen{};

    bool operator==(const DocumentSnapshot&) const = default;
};

[[nodiscard]] DocumentSnapshot
snapshot_of(const RepresentationDocument& document) {
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
        .lifecycle =
            RepresentationInternalAccess::lifecycleState(document),
        .frozen = document.isFrozen(),
    };
}

struct DefinitionSnapshot final {
    std::vector<std::string> order;
    std::size_t entity_count{};
    std::size_t relationship_count{};
    std::size_t property_count{};

    bool operator==(const DefinitionSnapshot&) const = default;
};

[[nodiscard]] DefinitionSnapshot
snapshot_of(const ProcessDefinition& definition) {
    return DefinitionSnapshot{
        .order = ids_of(definition),
        .entity_count = definition.entityCount(),
        .relationship_count = definition.relationshipCount(),
        .property_count = definition.propertyCount(),
    };
}

struct ResultSnapshot final {
    bool succeeded{};
    ExecutionState state{ExecutionState::Ready};
    ExecutionResult::Code code{ExecutionResult::Code::Success};
    std::string message;
    std::vector<std::string> trace;
    std::vector<DiagnosticFingerprint> diagnostics;

    bool operator==(const ResultSnapshot&) const = default;
};

[[nodiscard]] ResultSnapshot snapshot_of(const ExecutionResult& result) {
    std::vector<std::string> trace;
    trace.reserve(result.trace().size());
    for (const auto& id : result.trace()) {
        trace.push_back(id.toString());
    }

    return ResultSnapshot{
        .succeeded = result.succeeded(),
        .state = result.state(),
        .code = result.code(),
        .message = std::string{result.message()},
        .trace = std::move(trace),
        .diagnostics = fingerprint_of(result.diagnostics()),
    };
}

void populate_canonical_document(RepresentationDocument& document,
                                 const bool semantic_variant = false) {
    const std::string prefix = semantic_variant ? "Variant-" : "Canonical-";

    auto& first =
        document.createEntity(RepresentationType{prefix + "First"});
    auto& second =
        document.createEntity(RepresentationType{prefix + "Second"});
    auto& early = document.createRelationship(
        semantic_variant ? second : first,
        semantic_variant ? first : second,
        RepresentationType{prefix + "Early"});

    first.addProperty(
        semantic_variant ? "changed-name" : "first-value",
        RepresentationType{prefix + "Value"},
        semantic_variant
            ? RepresentationValue{std::string{"semantic-variant"}}
            : RepresentationValue{std::int64_t{41}});
    early.addProperty(
        semantic_variant ? "changed-edge-name" : "early-weight",
        RepresentationType{prefix + "Weight"},
        semantic_variant ? RepresentationValue{false}
                         : RepresentationValue{3.5});

    auto& third =
        document.createEntity(RepresentationType{prefix + "Third"});
    second.addProperty(
        semantic_variant ? "changed-second-name" : "second-value",
        RepresentationType{prefix + "Value"},
        semantic_variant ? RepresentationValue{std::int64_t{-8}}
                         : RepresentationValue{true});

    auto& late = document.createRelationship(
        semantic_variant ? third : second,
        third,
        RepresentationType{prefix + "Late"});
    third.addProperty(
        semantic_variant ? "changed-third-a" : "third-a",
        RepresentationType{prefix + "Value"},
        semantic_variant ? RepresentationValue{7.25}
                         : RepresentationValue{std::string{"a"}});
    third.addProperty(
        semantic_variant ? "changed-third-b" : "third-b",
        RepresentationType{prefix + "Value"},
        semantic_variant
            ? RepresentationValue{std::vector<RepresentationValue>{
                  RepresentationValue{std::int64_t{1}},
                  RepresentationValue{std::string{"two"}},
              }}
            : RepresentationValue{std::string{"b"}});
    late.addProperty(
        semantic_variant ? "changed-late-name" : "late-label",
        RepresentationType{prefix + "Label"},
        semantic_variant ? RepresentationValue{std::string{"different"}}
                         : RepresentationValue{std::string{"late"}});
}

[[nodiscard]] std::vector<std::string> canonical_order() {
    return {
        expected_id(1U),
        expected_id(4U),
        expected_id(2U),
        expected_id(7U),
        expected_id(6U),
        expected_id(9U),
        expected_id(10U),
        expected_id(3U),
        expected_id(5U),
        expected_id(8U),
        expected_id(11U),
    };
}

void populate_graph_document(RepresentationDocument& document,
                             const bool alternate_shape) {
    auto& first =
        document.createEntity(RepresentationType{"GraphEntity"});
    auto& second =
        document.createEntity(RepresentationType{"GraphEntity"});
    auto& third =
        document.createEntity(RepresentationType{"GraphEntity"});
    auto& disconnected =
        document.createEntity(RepresentationType{"GraphEntity"});

    if (!alternate_shape) {
        document.createRelationship(
            first, second, RepresentationType{"Edge"});
        document.createRelationship(
            second, first, RepresentationType{"Edge"});
        document.createRelationship(
            third, third, RepresentationType{"Self"});
    } else {
        document.createRelationship(
            disconnected, disconnected, RepresentationType{"Self"});
        document.createRelationship(
            first, third, RepresentationType{"Edge"});
        document.createRelationship(
            third, second, RepresentationType{"Edge"});
    }
}

void populate_invalid_document(RepresentationDocument& document,
                               RepresentationDocument& foreign_document) {
    auto& missing_entity =
        document.createEntity(RepresentationType{""});
    missing_entity.addProperty(
        "missing-property-type",
        RepresentationType{""},
        RepresentationValue{std::string{"value"}});
    auto& duplicate =
        document.createEntity(RepresentationType{"Duplicate"});
    auto& relationship = document.createRelationship(
        missing_entity, duplicate, RepresentationType{""});
    relationship.addProperty(
        "missing-relationship-property-type",
        RepresentationType{""},
        RepresentationValue{std::int64_t{7}});

    auto& foreign =
        foreign_document.createEntity(RepresentationType{"Foreign"});
    RepresentationInternalAccess::replaceId(
        duplicate, RepresentationId{missing_entity.id().toString()});
    RepresentationInternalAccess::setEndpoints(
        relationship, foreign, duplicate);
}

[[nodiscard]] ProcessDefinition definition_from_destroyed_source() {
    auto document = std::make_unique<RepresentationDocument>(
        RepresentationMetadata{"ephemeral", "1", "unit-test"});
    populate_canonical_document(*document);
    return ProcessDefinition{*document};
}

[[nodiscard]] std::unique_ptr<Runtime>
make_process_runtime(std::string runtime_id) {
    RuntimeBuilder builder{RuntimeId{std::move(runtime_id)}};
    cca::process::detail::add_process_runtime_integration(builder);
    return std::move(builder).build();
}

enum class ProviderFailure {
    Start,
    Stop,
};

class FailingProcessProvider final
    : public ProcessEngine,
      public ServiceProvider {
  public:
    explicit FailingProcessProvider(const ProviderFailure failure) noexcept
        : failure_(failure) {}

    [[nodiscard]] RuntimeResult
    start(RuntimeContext& context) override {
        static_cast<void>(context);
        if (failure_ == ProviderFailure::Start) {
            return RuntimeResult::failure(
                "process.test.start-failure",
                "injected Process Provider start failure");
        }
        return RuntimeResult::success();
    }

    [[nodiscard]] RuntimeResult
    stop(RuntimeContext& context) override {
        static_cast<void>(context);
        if (failure_ == ProviderFailure::Stop) {
            return RuntimeResult::failure(
                "process.test.stop-failure",
                "injected Process Provider stop failure");
        }
        return RuntimeResult::success();
    }

  private:
    ProviderFailure failure_;
};

[[nodiscard]] bool
contains_state(const std::vector<RuntimeState>& history,
               const RuntimeState expected) {
    return std::find(history.begin(), history.end(), expected) !=
           history.end();
}

TEST(ProcessApiTest, PublicDeclarationsMatchTheFrozenContract) {
    static_assert(
        std::is_constructible_v<ProcessDefinition,
                                const RepresentationDocument&>);
    static_assert(!std::is_default_constructible_v<ProcessDefinition>);
    static_assert(std::is_copy_constructible_v<ProcessDefinition>);
    static_assert(std::is_copy_assignable_v<ProcessDefinition>);
    static_assert(std::is_nothrow_move_constructible_v<ProcessDefinition>);
    static_assert(std::is_nothrow_move_assignable_v<ProcessDefinition>);

    static_assert(
        std::is_constructible_v<ExecutionContext, ProcessDefinition>);
    static_assert(!std::is_default_constructible_v<ExecutionContext>);
    static_assert(!std::is_copy_constructible_v<ExecutionContext>);
    static_assert(!std::is_copy_assignable_v<ExecutionContext>);
    static_assert(!std::is_move_constructible_v<ExecutionContext>);
    static_assert(!std::is_move_assignable_v<ExecutionContext>);

    static_assert(!std::is_default_constructible_v<ExecutionResult>);
    static_assert(std::is_copy_constructible_v<ExecutionResult>);
    static_assert(std::is_copy_assignable_v<ExecutionResult>);
    static_assert(std::is_nothrow_move_constructible_v<ExecutionResult>);
    static_assert(std::is_nothrow_move_assignable_v<ExecutionResult>);

    static_assert(std::is_nothrow_default_constructible_v<ProcessEngine>);
    static_assert(std::is_copy_constructible_v<ProcessEngine>);
    static_assert(std::is_copy_assignable_v<ProcessEngine>);
    static_assert(std::is_move_constructible_v<ProcessEngine>);
    static_assert(std::is_move_assignable_v<ProcessEngine>);

    using DocumentExecute = ExecutionResult (ProcessEngine::*)(
        const RepresentationDocument&) const;
    using DefinitionExecute = ExecutionResult (ProcessEngine::*)(
        const ProcessDefinition&) const;
    using ContextExecute = ExecutionResult (ProcessEngine::*)(
        ExecutionContext&) const;

    static_assert(std::is_same_v<
                  decltype(static_cast<DocumentExecute>(
                      &ProcessEngine::execute)),
                  DocumentExecute>);
    static_assert(std::is_same_v<
                  decltype(static_cast<DefinitionExecute>(
                      &ProcessEngine::execute)),
                  DefinitionExecute>);
    static_assert(std::is_same_v<
                  decltype(static_cast<ContextExecute>(
                      &ProcessEngine::execute)),
                  ContextExecute>);

    EXPECT_EQ(
        (std::array{
            ExecutionState::Ready,
            ExecutionState::Running,
            ExecutionState::Completed,
            ExecutionState::Failed,
        }).size(),
        4U);
}

TEST(ProcessApiTest, PublicSurfacePreservesLayerBoundaries) {
    static_assert(
        !std::is_base_of_v<ServiceProvider, ProcessEngine>);
    static_assert(
        std::is_same_v<
            decltype(std::declval<const ProcessEngine&>().execute(
                std::declval<const RepresentationDocument&>())),
            ExecutionResult>);

    ProcessEngine engine;
    RepresentationDocument document;
    const auto result = engine.execute(document);

    EXPECT_TRUE(result.succeeded());
}

TEST(ProcessApiTest, RequiredEmptyDocumentExampleSucceeds) {
    RepresentationDocument model;
    ProcessEngine engine;
    ExecutionResult result = engine.execute(model);

    EXPECT_TRUE(result.succeeded());
    EXPECT_EQ(result.state(), ExecutionState::Completed);
    EXPECT_EQ(result.code(), ExecutionResult::Code::Success);
    EXPECT_TRUE(result.message().empty());
    EXPECT_TRUE(result.trace().empty());
    EXPECT_TRUE(result.diagnostics().empty());
}

TEST(ProcessDefinitionTest, MaterializesCanonicalOwnedOrderAndCounts) {
    RepresentationDocument document{
        RepresentationMetadata{"author", "1.0", "unit-test"}};
    populate_canonical_document(document);
    const auto before = snapshot_of(document);

    const ProcessDefinition definition{document};

    EXPECT_EQ(snapshot_of(document), before);
    EXPECT_EQ(ids_of(definition), canonical_order());
    EXPECT_EQ(definition.entityCount(), 3U);
    EXPECT_EQ(definition.relationshipCount(), 2U);
    EXPECT_EQ(definition.propertyCount(), 6U);
    EXPECT_EQ(
        definition.executionOrder().size(),
        definition.entityCount() + definition.relationshipCount() +
            definition.propertyCount());

    const ProcessDefinition copy{definition};
    EXPECT_EQ(snapshot_of(copy), snapshot_of(definition));
    EXPECT_NE(&copy.executionOrder(), &definition.executionOrder());

    ProcessDefinition assigned{document};
    assigned = definition;
    EXPECT_EQ(snapshot_of(assigned), snapshot_of(definition));

    ProcessDefinition moved{std::move(assigned)};
    EXPECT_EQ(snapshot_of(moved), snapshot_of(definition));

    ProcessDefinition move_assigned{document};
    move_assigned = std::move(moved);
    EXPECT_EQ(snapshot_of(move_assigned), snapshot_of(definition));
}

TEST(ProcessDefinitionTest,
     InvalidConstructionIsDeterministicAndStrong) {
    RepresentationDocument document;
    RepresentationDocument foreign;
    populate_invalid_document(document, foreign);
    const auto before = snapshot_of(document);

    std::string first_message;
    std::string second_message;
    try {
        const ProcessDefinition definition{document};
        static_cast<void>(definition);
        FAIL() << "invalid definition construction unexpectedly succeeded";
    } catch (const std::invalid_argument& exception) {
        first_message = exception.what();
    }

    EXPECT_EQ(snapshot_of(document), before);

    try {
        const ProcessDefinition definition{document};
        static_cast<void>(definition);
        FAIL() << "invalid definition construction unexpectedly succeeded";
    } catch (const std::invalid_argument& exception) {
        second_message = exception.what();
    }

    EXPECT_FALSE(first_message.empty());
    EXPECT_EQ(second_message, first_message);
    EXPECT_EQ(snapshot_of(document), before);
}

TEST(ProcessDefinitionTest,
     PlanSurvivesMutationRemovalRollbackAndDestruction) {
    ProcessEngine engine;
    RepresentationDocument document;
    populate_canonical_document(document);

    const ProcessDefinition original{document};
    const auto original_snapshot = snapshot_of(original);

    auto& added =
        document.createEntity(RepresentationType{"AddedAfterMaterialization"});
    added.addProperty(
        "new",
        RepresentationType{"Value"},
        RepresentationValue{std::int64_t{99}});

    const auto first_relationship_id =
        document.relationships().front().get().id().toString();
    const auto second_relationship_id =
        document.relationships().back().get().id().toString();
    document.removeRelationship(
        RepresentationId{first_relationship_id});
    document.removeRelationship(
        RepresentationId{second_relationship_id});
    document.removeEntity(RepresentationId{expected_id(6U)});

    EXPECT_EQ(snapshot_of(original), original_snapshot);
    EXPECT_EQ(
        snapshot_of(engine.execute(original)).trace,
        original_snapshot.order);

    RepresentationDocument transactional_document;
    transactional_document.createEntity(
        RepresentationType{"Baseline"});
    auto transaction =
        TransactionService{}.begin(transactional_document);
    auto& tentative = transactional_document.createEntity(
        RepresentationType{"Tentative"});
    tentative.addProperty(
        "tentative",
        RepresentationType{"Value"},
        RepresentationValue{std::string{"retained by definition"}});

    const ProcessDefinition tentative_definition{
        transactional_document};
    const auto tentative_snapshot =
        snapshot_of(tentative_definition);
    transaction.rollback();

    ASSERT_EQ(transactional_document.entities().size(), 1U);
    EXPECT_EQ(
        snapshot_of(engine.execute(tentative_definition)).trace,
        tentative_snapshot.order);
    EXPECT_EQ(
        tentative_snapshot.order,
        (std::vector<std::string>{
            expected_id(1U), expected_id(2U), expected_id(3U)}));

    const ProcessDefinition destroyed_source_definition =
        definition_from_destroyed_source();
    EXPECT_EQ(
        snapshot_of(destroyed_source_definition).order,
        canonical_order());
    EXPECT_EQ(
        snapshot_of(engine.execute(destroyed_source_definition)).trace,
        canonical_order());
}

TEST(ProcessInputTest,
     PreservesCompleteMutableValidatedAndFrozenState) {
    RepresentationDocument mutable_document{
        RepresentationMetadata{"same", "1", "lifecycle"}};
    RepresentationDocument validated_document{
        RepresentationMetadata{"same", "1", "lifecycle"}};
    RepresentationDocument frozen_document{
        RepresentationMetadata{"same", "1", "lifecycle"}};
    populate_canonical_document(mutable_document);
    populate_canonical_document(validated_document);
    populate_canonical_document(frozen_document);

    auto validation_transaction =
        TransactionService{}.begin(validated_document);
    ASSERT_TRUE(validation_transaction.commit().valid);
    ASSERT_EQ(
        RepresentationInternalAccess::lifecycleState(
            validated_document),
        RepresentationLifecycleState::Validated);

    const auto freeze_result =
        FreezeService{}.freeze(frozen_document);
    ASSERT_TRUE(freeze_result.valid);
    ASSERT_EQ(
        RepresentationInternalAccess::lifecycleState(frozen_document),
        RepresentationLifecycleState::Frozen);

    const auto mutable_before = snapshot_of(mutable_document);
    const auto validated_before = snapshot_of(validated_document);
    const auto frozen_before = snapshot_of(frozen_document);

    ProcessEngine engine;
    const ProcessDefinition mutable_definition{mutable_document};
    const ProcessDefinition validated_definition{validated_document};
    const ProcessDefinition frozen_definition{frozen_document};
    const auto mutable_result = engine.execute(mutable_document);
    const auto validated_result = engine.execute(validated_document);
    const auto frozen_result = engine.execute(frozen_document);

    EXPECT_EQ(snapshot_of(mutable_document), mutable_before);
    EXPECT_EQ(snapshot_of(validated_document), validated_before);
    EXPECT_EQ(snapshot_of(frozen_document), frozen_before);
    EXPECT_EQ(
        snapshot_of(mutable_definition),
        snapshot_of(validated_definition));
    EXPECT_EQ(
        snapshot_of(validated_definition),
        snapshot_of(frozen_definition));
    EXPECT_EQ(snapshot_of(mutable_result), snapshot_of(validated_result));
    EXPECT_EQ(snapshot_of(validated_result), snapshot_of(frozen_result));
}

TEST(ProcessInputTest, InvalidDirectInputIsValidatedBeforeExecution) {
    RepresentationDocument document;
    RepresentationDocument foreign;
    populate_invalid_document(document, foreign);
    const auto before = snapshot_of(document);
    const auto direct_validation =
        ValidationService{}.validate(document);
    ASSERT_FALSE(direct_validation.valid);
    ASSERT_GE(direct_validation.diagnostics.size(), 6U);

    ProcessEngine engine;
    const auto first = engine.execute(document);
    const auto second = engine.execute(document);

    EXPECT_FALSE(first.succeeded());
    EXPECT_EQ(first.state(), ExecutionState::Failed);
    EXPECT_EQ(
        first.code(), ExecutionResult::Code::InvalidRepresentation);
    EXPECT_FALSE(first.message().empty());
    EXPECT_TRUE(first.trace().empty());
    EXPECT_EQ(
        fingerprint_of(first.diagnostics()),
        fingerprint_of(direct_validation.diagnostics));
    EXPECT_EQ(snapshot_of(second), snapshot_of(first));
    EXPECT_EQ(snapshot_of(document), before);

    ExecutionResult copy{first};
    EXPECT_EQ(snapshot_of(copy), snapshot_of(first));
    ExecutionResult moved{std::move(copy)};
    EXPECT_EQ(snapshot_of(moved), snapshot_of(first));

    const auto fingerprint = fingerprint_of(first.diagnostics());
    ASSERT_FALSE(fingerprint.empty());
    EXPECT_EQ(
        std::get<0>(fingerprint.front()),
        DiagnosticCode::DuplicateIdentifier);
    EXPECT_EQ(
        std::get<0>(fingerprint.back()),
        DiagnosticCode::InvalidRelationship);

    std::vector<std::string> missing_type_messages;
    for (const auto& diagnostic : first.diagnostics()) {
        if (diagnostic.code == DiagnosticCode::MissingType) {
            missing_type_messages.push_back(diagnostic.message);
        }
    }
    ASSERT_EQ(missing_type_messages.size(), 4U);
    EXPECT_NE(
        missing_type_messages[0].find(expected_id(1U)),
        std::string::npos);
    EXPECT_NE(
        missing_type_messages[1].find(expected_id(2U)),
        std::string::npos);
    EXPECT_NE(
        missing_type_messages[2].find(expected_id(4U)),
        std::string::npos);
    EXPECT_NE(
        missing_type_messages[3].find(expected_id(5U)),
        std::string::npos);
}

TEST(ExecutionContextTest,
     ReadyExecutionCompletesWithTheCanonicalTrace) {
    RepresentationDocument document;
    populate_canonical_document(document);
    const ProcessDefinition definition{document};
    ExecutionContext context{definition};

    EXPECT_EQ(context.definition().executionOrder(),
              definition.executionOrder());
    EXPECT_EQ(context.state(), ExecutionState::Ready);
    EXPECT_TRUE(context.trace().empty());

    ProcessEngine engine;
    const auto result = engine.execute(context);

    EXPECT_EQ(context.state(), ExecutionState::Completed);
    EXPECT_EQ(context.trace(), definition.executionOrder());
    EXPECT_EQ(
        ProcessInternalAccess::stateTransitions(context),
        (std::vector<ExecutionState>{
            ExecutionState::Ready,
            ExecutionState::Running,
            ExecutionState::Completed,
        }));
    EXPECT_EQ(result.state(), ExecutionState::Completed);
    EXPECT_EQ(result.trace(), context.trace());
    EXPECT_EQ(ids_of(context.definition()), canonical_order());
}

TEST(ExecutionContextTest,
     CompletedContextIsOneShotAndRejectedStrongly) {
    RepresentationDocument document;
    populate_canonical_document(document);
    ExecutionContext context{ProcessDefinition{document}};
    ProcessEngine engine;
    const auto result = engine.execute(context);
    ASSERT_TRUE(result.succeeded());

    const auto definition_before = snapshot_of(context.definition());
    const auto state_before = context.state();
    const auto trace_before = ids_of(context.trace());

    EXPECT_THROW(
        static_cast<void>(engine.execute(context)),
        std::logic_error);

    EXPECT_EQ(snapshot_of(context.definition()), definition_before);
    EXPECT_EQ(context.state(), state_before);
    EXPECT_EQ(ids_of(context.trace()), trace_before);
}

TEST(ExecutionContextTest,
     EveryNonReadyStateIsRejectedWithoutMutation) {
    RepresentationDocument document;
    populate_canonical_document(document);
    const ProcessDefinition definition{document};
    ProcessEngine engine;

    for (const auto state : {
             ExecutionState::Running,
             ExecutionState::Failed,
         }) {
        ExecutionContext context{definition};
        ProcessInternalAccess::setState(context, state);
        const auto definition_before = snapshot_of(context.definition());
        const auto trace_before = ids_of(context.trace());

        EXPECT_THROW(
            static_cast<void>(engine.execute(context)),
            std::logic_error);

        EXPECT_EQ(context.state(), state);
        EXPECT_EQ(snapshot_of(context.definition()), definition_before);
        EXPECT_EQ(ids_of(context.trace()), trace_before);
    }
}

TEST(ExecutionContextTest,
     ContextsOwnIsolatedDefinitionStateAndTraces) {
    RepresentationDocument document;
    populate_canonical_document(document);
    const ProcessDefinition definition{document};
    ExecutionContext first{definition};
    ExecutionContext second{definition};
    ProcessEngine engine;

    const auto first_result = engine.execute(first);

    EXPECT_TRUE(first_result.succeeded());
    EXPECT_EQ(first.state(), ExecutionState::Completed);
    EXPECT_FALSE(first.trace().empty());
    EXPECT_EQ(second.state(), ExecutionState::Ready);
    EXPECT_TRUE(second.trace().empty());
    EXPECT_NE(&first.definition(), &second.definition());
    EXPECT_NE(
        &first.definition().executionOrder(),
        &second.definition().executionOrder());

    const auto second_result = engine.execute(second);
    EXPECT_EQ(snapshot_of(first_result), snapshot_of(second_result));
    EXPECT_EQ(first.trace(), second.trace());
}

TEST(ProcessResultTest, SuccessValuesOwnEveryRequiredInvariant) {
    RepresentationDocument document;
    populate_canonical_document(document);
    ProcessEngine engine;
    ExecutionResult result = engine.execute(document);
    const auto expected = snapshot_of(result);

    EXPECT_TRUE(result.succeeded());
    EXPECT_EQ(result.state(), ExecutionState::Completed);
    EXPECT_EQ(result.code(), ExecutionResult::Code::Success);
    EXPECT_TRUE(result.message().empty());
    EXPECT_EQ(expected.trace, canonical_order());
    EXPECT_TRUE(result.diagnostics().empty());

    ExecutionResult copy{result};
    EXPECT_EQ(snapshot_of(copy), expected);

    ExecutionResult moved{std::move(copy)};
    EXPECT_EQ(snapshot_of(moved), expected);

    RepresentationDocument empty_document;
    ExecutionResult copy_assigned = engine.execute(empty_document);
    copy_assigned = result;
    EXPECT_EQ(snapshot_of(copy_assigned), expected);

    ExecutionResult move_assigned = engine.execute(empty_document);
    move_assigned = std::move(copy_assigned);
    EXPECT_EQ(snapshot_of(move_assigned), expected);
}

TEST(ProcessEngineTest, AllValidEntrySurfacesAreEquivalent) {
    RepresentationDocument document;
    populate_canonical_document(document);
    ProcessEngine engine;
    const ProcessDefinition definition{document};
    ExecutionContext context{definition};

    const auto document_result = engine.execute(document);
    const auto definition_result = engine.execute(definition);
    const auto context_result = engine.execute(context);

    EXPECT_EQ(snapshot_of(document_result), snapshot_of(definition_result));
    EXPECT_EQ(snapshot_of(definition_result), snapshot_of(context_result));
    EXPECT_EQ(context.state(), ExecutionState::Completed);
    EXPECT_EQ(ids_of(context.trace()), canonical_order());
}

TEST(ProcessDeterminismTest,
     EquivalentSemanticVariantsProduceEqualOutcomes) {
    RepresentationDocument canonical{
        RepresentationMetadata{"first-author", "1", "first-origin"}};
    RepresentationDocument variant{
        RepresentationMetadata{"other-author", "99", "other-origin"}};
    populate_canonical_document(canonical, false);
    populate_canonical_document(variant, true);

    const ProcessDefinition canonical_definition{canonical};
    const ProcessDefinition variant_definition{variant};
    EXPECT_EQ(
        snapshot_of(canonical_definition),
        snapshot_of(variant_definition));

    ProcessEngine engine;
    const auto canonical_result = engine.execute(canonical);
    const auto variant_result = engine.execute(variant);
    const auto repeated_result = engine.execute(canonical);

    EXPECT_EQ(snapshot_of(canonical_result), snapshot_of(variant_result));
    EXPECT_EQ(snapshot_of(repeated_result), snapshot_of(canonical_result));
}

TEST(ProcessDeterminismTest,
     GraphShapesRemainStructuralAndSideEffectFree) {
    RepresentationDocument cyclic_and_disconnected;
    RepresentationDocument alternate;
    populate_graph_document(cyclic_and_disconnected, false);
    populate_graph_document(alternate, true);
    const auto first_before = snapshot_of(cyclic_and_disconnected);
    const auto second_before = snapshot_of(alternate);

    ProcessEngine engine;
    const auto first = engine.execute(cyclic_and_disconnected);
    const auto second = engine.execute(alternate);

    EXPECT_EQ(snapshot_of(first), snapshot_of(second));
    EXPECT_EQ(
        snapshot_of(cyclic_and_disconnected), first_before);
    EXPECT_EQ(snapshot_of(alternate), second_before);
    EXPECT_EQ(
        snapshot_of(first).trace,
        (std::vector<std::string>{
            expected_id(1U),
            expected_id(2U),
            expected_id(3U),
            expected_id(4U),
            expected_id(5U),
            expected_id(6U),
            expected_id(7U),
        }));
}

TEST(ProcessThreadSafetyTest,
     SupportsTheDocumentedConcurrentOperations) {
    RepresentationDocument document;
    populate_canonical_document(document);
    const ProcessDefinition definition{document};
    ProcessEngine engine;

    constexpr std::size_t worker_count = 8U;
    std::vector<std::unique_ptr<ExecutionContext>> contexts;
    contexts.reserve(worker_count);
    for (std::size_t index = 0U; index < worker_count; ++index) {
        static_cast<void>(index);
        contexts.push_back(
            std::make_unique<ExecutionContext>(definition));
    }

    std::vector<std::future<ResultSnapshot>> executions;
    executions.reserve(worker_count);
    for (const auto& context : contexts) {
        executions.push_back(std::async(
            std::launch::async,
            [&engine, execution_context = context.get()] {
                return snapshot_of(
                    engine.execute(*execution_context));
            }));
    }

    std::optional<ResultSnapshot> baseline;
    for (auto& execution : executions) {
        const auto observed = execution.get();
        if (!baseline.has_value()) {
            baseline = observed;
        } else {
            EXPECT_EQ(observed, *baseline);
        }
    }
    ASSERT_TRUE(baseline.has_value());

    for (const auto& context : contexts) {
        EXPECT_EQ(context->state(), ExecutionState::Completed);
        EXPECT_EQ(ids_of(context->trace()), baseline->trace);
    }

    const auto immutable_result = engine.execute(definition);
    const auto immutable_snapshot = snapshot_of(immutable_result);
    std::vector<std::future<bool>> readers;
    readers.reserve(worker_count);
    for (std::size_t index = 0U; index < worker_count; ++index) {
        static_cast<void>(index);
        readers.push_back(std::async(
            std::launch::async,
            [&definition, &immutable_result, &immutable_snapshot] {
                for (std::size_t iteration = 0U;
                     iteration < 100U;
                     ++iteration) {
                    if (definition.executionOrder().size() != 11U ||
                        definition.entityCount() != 3U ||
                        snapshot_of(immutable_result) !=
                            immutable_snapshot) {
                        return false;
                    }
                }
                return true;
            }));
    }

    for (auto& reader : readers) {
        EXPECT_TRUE(reader.get());
    }
}

TEST(RuntimeIntegrationTest,
     ExposesTheProcessDomainServiceThroughRuntime) {
    using Contract = cca::process::detail::ProcessEngineContract;
    static_assert(
        Contract::cardinality ==
        cca::runtime::ServiceCardinality::exactly_one);
    static_assert(
        std::is_same_v<typename Contract::interface_type, ProcessEngine>);

    auto runtime = make_process_runtime("process-runtime");
    ASSERT_EQ(runtime->state(), RuntimeState::constructed);
    ASSERT_TRUE(runtime->start().ok());
    ASSERT_EQ(runtime->state(), RuntimeState::running);
    ASSERT_TRUE(runtime->frozen());

    auto& engine =
        runtime->service_registry().resolve<Contract>();
    RepresentationDocument document;
    populate_canonical_document(document);
    const auto result = engine.execute(document);

    EXPECT_TRUE(result.succeeded());
    EXPECT_EQ(snapshot_of(result).trace, canonical_order());

    ASSERT_TRUE(runtime->stop().ok());
    EXPECT_EQ(runtime->state(), RuntimeState::destroyed);
}

TEST(RuntimeIntegrationTest,
     ProviderLifecycleSurroundsHostedExecution) {
    using Contract = cca::process::detail::ProcessEngineContract;
    auto runtime = make_process_runtime("process-lifecycle-runtime");

    ASSERT_TRUE(runtime->start().ok());
    ASSERT_EQ(runtime->state(), RuntimeState::running);
    const auto before_execution = runtime->lifecycle_history();
    EXPECT_EQ(
        runtime->observability().metric_value(
            RuntimeMetric::providers_started),
        1U);
    EXPECT_EQ(
        runtime->observability().metric_value(
            RuntimeMetric::providers_stopped),
        0U);

    auto& engine =
        runtime->service_registry().resolve<Contract>();
    RepresentationDocument document;
    const auto result = engine.execute(document);

    EXPECT_TRUE(result.succeeded());
    EXPECT_EQ(runtime->state(), RuntimeState::running);
    EXPECT_EQ(runtime->lifecycle_history(), before_execution);
    EXPECT_TRUE(
        contains_state(before_execution, RuntimeState::starting));
    EXPECT_EQ(before_execution.back(), RuntimeState::running);

    ASSERT_TRUE(runtime->stop().ok());
    const auto complete_history = runtime->lifecycle_history();
    EXPECT_TRUE(
        contains_state(complete_history, RuntimeState::stopping));
    EXPECT_TRUE(
        contains_state(complete_history, RuntimeState::stopped));
    EXPECT_EQ(complete_history.back(), RuntimeState::destroyed);
    EXPECT_EQ(
        runtime->observability().metric_value(
            RuntimeMetric::providers_started),
        1U);
    EXPECT_EQ(
        runtime->observability().metric_value(
            RuntimeMetric::providers_stopped),
        1U);
}

TEST(RuntimeIntegrationTest,
     KeepsRuntimeInstancesAndEnginesIsolated) {
    using Contract = cca::process::detail::ProcessEngineContract;
    auto first_runtime = make_process_runtime("process-instance-one");
    auto second_runtime = make_process_runtime("process-instance-two");

    ASSERT_TRUE(first_runtime->start().ok());
    ASSERT_TRUE(second_runtime->start().ok());
    auto& first_engine =
        first_runtime->service_registry().resolve<Contract>();
    auto& second_engine =
        second_runtime->service_registry().resolve<Contract>();

    EXPECT_NE(&first_engine, &second_engine);
    EXPECT_NE(
        first_runtime->runtime_id(), second_runtime->runtime_id());

    RepresentationDocument first_document;
    populate_canonical_document(first_document);
    RepresentationDocument second_document;
    const auto first_result = first_engine.execute(first_document);
    const auto second_result = second_engine.execute(second_document);
    EXPECT_EQ(snapshot_of(first_result).trace, canonical_order());
    EXPECT_TRUE(second_result.trace().empty());

    ASSERT_TRUE(first_runtime->stop().ok());
    EXPECT_EQ(first_runtime->state(), RuntimeState::destroyed);
    EXPECT_EQ(second_runtime->state(), RuntimeState::running);
    EXPECT_TRUE(second_engine.execute(second_document).succeeded());

    ASSERT_TRUE(second_runtime->stop().ok());
    EXPECT_EQ(second_runtime->state(), RuntimeState::destroyed);
}

TEST(RuntimeIntegrationTest,
     InvalidInputDoesNotFailTheRunningRuntime) {
    using Contract = cca::process::detail::ProcessEngineContract;
    auto runtime = make_process_runtime("process-invalid-input-runtime");
    ASSERT_TRUE(runtime->start().ok());
    auto& engine =
        runtime->service_registry().resolve<Contract>();

    RepresentationDocument invalid;
    RepresentationDocument foreign;
    populate_invalid_document(invalid, foreign);
    const auto history_before = runtime->lifecycle_history();
    const auto result = engine.execute(invalid);

    EXPECT_FALSE(result.succeeded());
    EXPECT_EQ(
        result.code(), ExecutionResult::Code::InvalidRepresentation);
    EXPECT_EQ(runtime->state(), RuntimeState::running);
    EXPECT_EQ(runtime->lifecycle_history(), history_before);

    ASSERT_TRUE(runtime->stop().ok());
}

TEST(RuntimeIntegrationTest,
     ProcessProviderLifecycleFailuresRemainRuntimeFailures) {
    using Contract = cca::process::detail::ProcessEngineContract;

    RuntimeBuilder start_failure_builder{
        RuntimeId{"process-start-failure"}};
    start_failure_builder.declare_contract<Contract>();
    start_failure_builder
        .add_provider<Contract, FailingProcessProvider>([] {
            return std::make_unique<FailingProcessProvider>(
                ProviderFailure::Start);
        });
    auto start_failure_runtime =
        std::move(start_failure_builder).build();

    const auto start_result = start_failure_runtime->start();
    EXPECT_FALSE(start_result.ok());
    EXPECT_EQ(
        start_result.code(), "process.test.start-failure");
    EXPECT_EQ(
        start_failure_runtime->state(), RuntimeState::destroyed);
    const auto start_history =
        start_failure_runtime->lifecycle_history();
    EXPECT_TRUE(
        contains_state(start_history, RuntimeState::failed));
    EXPECT_TRUE(
        contains_state(start_history, RuntimeState::rollback));

    RuntimeBuilder stop_failure_builder{
        RuntimeId{"process-stop-failure"}};
    stop_failure_builder.declare_contract<Contract>();
    stop_failure_builder
        .add_provider<Contract, FailingProcessProvider>([] {
            return std::make_unique<FailingProcessProvider>(
                ProviderFailure::Stop);
        });
    auto stop_failure_runtime =
        std::move(stop_failure_builder).build();

    ASSERT_TRUE(stop_failure_runtime->start().ok());
    const auto stop_result = stop_failure_runtime->stop();
    EXPECT_FALSE(stop_result.ok());
    EXPECT_EQ(
        stop_result.code(), "process.test.stop-failure");
    EXPECT_EQ(
        stop_failure_runtime->state(), RuntimeState::destroyed);
    const auto stop_history =
        stop_failure_runtime->lifecycle_history();
    EXPECT_TRUE(
        contains_state(stop_history, RuntimeState::failed));
    EXPECT_TRUE(
        contains_state(stop_history, RuntimeState::rollback));
}

} // namespace

#include <cca/process/process.hpp>
#include <cca/representation/representation.hpp>

#include <gtest/gtest.h>

#include <cstddef>
#include <cstdlib>
#include <limits>
#include <new>
#include <string>
#include <utility>
#include <vector>

// CCA-PROC-030: inject every allocation failure point independently and
// verify the strong guarantee for construction and all execute overloads.

namespace allocation_failure_support {

constexpr auto disabled = std::numeric_limits<std::size_t>::max();
thread_local std::size_t allocations_before_failure = disabled;

void fail_after(const std::size_t successful_allocations) noexcept {
    allocations_before_failure = successful_allocations;
}

void disable() noexcept {
    allocations_before_failure = disabled;
}

[[nodiscard]] bool should_fail() noexcept {
    if (allocations_before_failure == disabled) {
        return false;
    }
    if (allocations_before_failure == 0U) {
        disable();
        return true;
    }
    --allocations_before_failure;
    return false;
}

[[nodiscard]] void* allocate(const std::size_t requested_size) {
    if (should_fail()) {
        throw std::bad_alloc{};
    }

    const auto size = requested_size == 0U ? 1U : requested_size;
    if (auto* allocation = std::malloc(size); allocation != nullptr) {
        return allocation;
    }
    throw std::bad_alloc{};
}

} // namespace allocation_failure_support

void* operator new(const std::size_t size) {
    return allocation_failure_support::allocate(size);
}

void* operator new[](const std::size_t size) {
    return allocation_failure_support::allocate(size);
}

void operator delete(void* allocation) noexcept {
    std::free(allocation);
}

void operator delete[](void* allocation) noexcept {
    std::free(allocation);
}

void operator delete(void* allocation, const std::size_t size) noexcept {
    static_cast<void>(size);
    std::free(allocation);
}

void operator delete[](void* allocation, const std::size_t size) noexcept {
    static_cast<void>(size);
    std::free(allocation);
}

namespace {

using cca::process::ExecutionContext;
using cca::process::ExecutionState;
using cca::process::ProcessDefinition;
using cca::process::ProcessEngine;
using cca::representation::RepresentationDocument;
using cca::representation::RepresentationId;
using cca::representation::RepresentationMetadata;
using cca::representation::RepresentationType;
using cca::representation::RepresentationValue;

constexpr std::size_t allocation_campaign_limit = 128U;

void populate_document(RepresentationDocument& document) {
    auto& first =
        document.createEntity(RepresentationType{"First"});
    auto& second =
        document.createEntity(RepresentationType{"Second"});
    first.addProperty(
        "name",
        RepresentationType{"Text"},
        RepresentationValue{std::string{"first"}});
    second.addProperty(
        "name",
        RepresentationType{"Text"},
        RepresentationValue{std::string{"second"}});
    auto& relationship = document.createRelationship(
        first, second, RepresentationType{"Directed"});
    relationship.addProperty(
        "weight",
        RepresentationType{"Integer"},
        RepresentationValue{std::int64_t{7}});
}

[[nodiscard]] std::vector<std::string>
document_fingerprint(const RepresentationDocument& document) {
    std::vector<std::string> fingerprint{
        std::string{document.metadata().author()},
        std::string{document.metadata().version()},
        std::string{document.metadata().provenance()},
        document.isFrozen() ? "frozen" : "mutable",
    };

    for (const auto& entity_reference : document.entities()) {
        const auto& entity = entity_reference.get();
        fingerprint.push_back(entity.id().toString());
        fingerprint.emplace_back(entity.type().name());
        for (const auto& property_reference : entity.properties()) {
            const auto& property = property_reference.get();
            fingerprint.push_back(property.id().toString());
            fingerprint.emplace_back(property.name());
            fingerprint.emplace_back(property.type().name());
            fingerprint.emplace_back(property.value().asString());
        }
    }

    for (const auto& relationship_reference : document.relationships()) {
        const auto& relationship = relationship_reference.get();
        fingerprint.push_back(relationship.id().toString());
        fingerprint.emplace_back(relationship.type().name());
        fingerprint.push_back(relationship.source().id().toString());
        fingerprint.push_back(relationship.target().id().toString());
        for (const auto& property_reference : relationship.properties()) {
            const auto& property = property_reference.get();
            fingerprint.push_back(property.id().toString());
            fingerprint.emplace_back(property.name());
            fingerprint.emplace_back(property.type().name());
            fingerprint.push_back(
                std::to_string(property.value().asInteger()));
        }
    }

    return fingerprint;
}

struct DefinitionFingerprint final {
    std::vector<std::string> order;
    std::size_t entity_count{};
    std::size_t relationship_count{};
    std::size_t property_count{};

    bool operator==(const DefinitionFingerprint&) const = default;
};

[[nodiscard]] DefinitionFingerprint
definition_fingerprint(const ProcessDefinition& definition) {
    std::vector<std::string> order;
    order.reserve(definition.executionOrder().size());
    for (const RepresentationId& id : definition.executionOrder()) {
        order.push_back(id.toString());
    }
    return DefinitionFingerprint{
        .order = std::move(order),
        .entity_count = definition.entityCount(),
        .relationship_count = definition.relationshipCount(),
        .property_count = definition.propertyCount(),
    };
}

TEST(ProcessAllocationFailureTest,
     DefinitionConstructionPreservesTheSourceAtEveryAllocationFailure) {
    RepresentationDocument document{
        RepresentationMetadata{"allocation-test", "1", "constructor"}};
    populate_document(document);
    const auto before = document_fingerprint(document);
    std::size_t observed_failures = 0U;
    bool completed = false;

    for (std::size_t index = 0U;
         index < allocation_campaign_limit;
         ++index) {
        allocation_failure_support::fail_after(index);
        try {
            const ProcessDefinition definition{document};
            allocation_failure_support::disable();
            EXPECT_FALSE(definition.executionOrder().empty());
            completed = true;
            break;
        } catch (const std::bad_alloc&) {
            allocation_failure_support::disable();
            ++observed_failures;
            EXPECT_EQ(document_fingerprint(document), before);
        } catch (...) {
            allocation_failure_support::disable();
            throw;
        }
    }

    EXPECT_TRUE(completed);
    EXPECT_GT(observed_failures, 0U);
    EXPECT_EQ(document_fingerprint(document), before);
}

TEST(ProcessAllocationFailureTest,
     DirectExecutionPreservesTheSourceAtEveryAllocationFailure) {
    RepresentationDocument document{
        RepresentationMetadata{"allocation-test", "1", "direct"}};
    populate_document(document);
    const auto before = document_fingerprint(document);
    ProcessEngine engine;
    std::size_t observed_failures = 0U;
    bool completed = false;

    for (std::size_t index = 0U;
         index < allocation_campaign_limit;
         ++index) {
        allocation_failure_support::fail_after(index);
        try {
            const auto result = engine.execute(document);
            allocation_failure_support::disable();
            EXPECT_TRUE(result.succeeded());
            completed = true;
            break;
        } catch (const std::bad_alloc&) {
            allocation_failure_support::disable();
            ++observed_failures;
            EXPECT_EQ(document_fingerprint(document), before);
        } catch (...) {
            allocation_failure_support::disable();
            throw;
        }
    }

    EXPECT_TRUE(completed);
    EXPECT_GT(observed_failures, 0U);
    EXPECT_EQ(document_fingerprint(document), before);
}

TEST(ProcessAllocationFailureTest,
     DefinitionExecutionPreservesTheDefinitionAtEveryAllocationFailure) {
    RepresentationDocument document;
    populate_document(document);
    const ProcessDefinition definition{document};
    const auto before = definition_fingerprint(definition);
    ProcessEngine engine;
    std::size_t observed_failures = 0U;
    bool completed = false;

    for (std::size_t index = 0U;
         index < allocation_campaign_limit;
         ++index) {
        allocation_failure_support::fail_after(index);
        try {
            const auto result = engine.execute(definition);
            allocation_failure_support::disable();
            EXPECT_TRUE(result.succeeded());
            completed = true;
            break;
        } catch (const std::bad_alloc&) {
            allocation_failure_support::disable();
            ++observed_failures;
            EXPECT_EQ(definition_fingerprint(definition), before);
        } catch (...) {
            allocation_failure_support::disable();
            throw;
        }
    }

    EXPECT_TRUE(completed);
    EXPECT_GT(observed_failures, 0U);
    EXPECT_EQ(definition_fingerprint(definition), before);
}

TEST(ProcessAllocationFailureTest,
     ContextExecutionPreservesReadyStateAtEveryAllocationFailure) {
    RepresentationDocument document;
    populate_document(document);
    const ProcessDefinition definition{document};
    const auto definition_before = definition_fingerprint(definition);
    ProcessEngine engine;
    std::size_t observed_failures = 0U;
    bool completed = false;

    for (std::size_t index = 0U;
         index < allocation_campaign_limit;
         ++index) {
        ExecutionContext context{definition};
        allocation_failure_support::fail_after(index);
        try {
            const auto result = engine.execute(context);
            allocation_failure_support::disable();
            EXPECT_TRUE(result.succeeded());
            completed = true;
            break;
        } catch (const std::bad_alloc&) {
            allocation_failure_support::disable();
            ++observed_failures;
            EXPECT_EQ(context.state(), ExecutionState::Ready);
            EXPECT_TRUE(context.trace().empty());
            EXPECT_EQ(
                definition_fingerprint(context.definition()),
                definition_before);
        } catch (...) {
            allocation_failure_support::disable();
            throw;
        }
    }

    EXPECT_TRUE(completed);
    EXPECT_GT(observed_failures, 0U);
}

} // namespace

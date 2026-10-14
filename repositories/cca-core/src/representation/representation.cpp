#include <cca/representation/representation.hpp>

#include <algorithm>
#include <array>
#include <cassert>
#include <charconv>
#include <cstddef>
#include <cstdint>
#include <limits>
#include <memory>
#include <set>
#include <stdexcept>
#include <string>
#include <string_view>
#include <system_error>
#include <utility>
#include <variant>
#include <vector>

#include "representation_test_access.hpp"

namespace cca::representation {
namespace {

enum class Lifecycle {
    Mutable,
    Validated,
    Frozen,
};

constexpr std::string_view identifier_prefix{"cca-rep-"};
constexpr std::size_t identifier_digits{16U};

RepresentationId make_identifier(const std::uint64_t ordinal) {
    std::array<char, identifier_digits> digits{};
    const auto conversion =
        std::to_chars(digits.data(), digits.data() + digits.size(), ordinal, 16);
    if (conversion.ec != std::errc{}) {
        throw std::overflow_error{"Unable to format representation identifier"};
    }

    const auto digit_count =
        static_cast<std::size_t>(conversion.ptr - digits.data());
    std::string value{identifier_prefix};
    value.append(identifier_digits - digit_count, '0');
    value.append(digits.data(), digit_count);
    return RepresentationId{std::move(value)};
}

std::string checked_string(const char* const value) {
    if (value == nullptr) {
        throw std::invalid_argument{
            "Representation string value cannot be constructed from null"};
    }
    return std::string{value};
}

void add_diagnostic(std::vector<Diagnostic>& diagnostics,
                    const DiagnosticCode code,
                    std::string message) {
    diagnostics.push_back(Diagnostic{
        .code = code,
        .severity = DiagnosticSeverity::Error,
        .message = std::move(message),
    });
}

template <typename Object>
std::unique_ptr<Object>
take_owned_object(std::vector<std::unique_ptr<Object>>& objects,
                  const Object* const expected) noexcept {
    const auto found =
        std::find_if(objects.begin(),
                     objects.end(),
                     [expected](const auto& object) {
                         return object.get() == expected;
                     });
    if (found == objects.end()) {
        return {};
    }
    return std::move(*found);
}

} // namespace

RepresentationId::RepresentationId(std::string value)
    : value_(std::move(value)) {}

std::string_view RepresentationId::value() const noexcept {
    return value_;
}

std::string RepresentationId::toString() const {
    return value_;
}

bool RepresentationId::operator==(const RepresentationId& other) const noexcept {
    return value_ == other.value_;
}

bool RepresentationId::operator!=(const RepresentationId& other) const noexcept {
    return !(*this == other);
}

bool RepresentationId::operator<(const RepresentationId& other) const noexcept {
    return std::lexicographical_compare(
        value_.begin(), value_.end(), other.value_.begin(), other.value_.end(),
        [](const char lhs, const char rhs) noexcept {
            return static_cast<unsigned char>(lhs) < static_cast<unsigned char>(rhs);
        });
}

RepresentationType::RepresentationType(std::string name)
    : name_(std::move(name)) {}

std::string_view RepresentationType::name() const noexcept {
    return name_;
}

bool RepresentationType::operator==(const RepresentationType& other) const noexcept {
    return name_ == other.name_;
}

EnumerationValue::EnumerationValue(std::string value)
    : value_(std::move(value)) {}

std::string_view EnumerationValue::value() const noexcept {
    return value_;
}

RepresentationValue::RepresentationValue(const bool value)
    : value_(value) {}

RepresentationValue::RepresentationValue(const std::int64_t value)
    : value_(value) {}

RepresentationValue::RepresentationValue(const double value)
    : value_(value) {}

RepresentationValue::RepresentationValue(std::string value)
    : value_(std::move(value)) {}

RepresentationValue::RepresentationValue(const char* const value)
    : value_(checked_string(value)) {}

RepresentationValue::RepresentationValue(EnumerationValue value)
    : value_(std::move(value)) {}

RepresentationValue::RepresentationValue(RepresentationId value)
    : value_(std::move(value)) {}

RepresentationValue::RepresentationValue(
    std::vector<RepresentationValue> value)
    : value_(std::move(value)) {}

ValueKind RepresentationValue::kind() const noexcept {
    return static_cast<ValueKind>(value_.index());
}

bool RepresentationValue::asBoolean() const {
    return std::get<bool>(value_);
}

std::int64_t RepresentationValue::asInteger() const {
    return std::get<std::int64_t>(value_);
}

double RepresentationValue::asFloatingPoint() const {
    return std::get<double>(value_);
}

std::string_view RepresentationValue::asString() const {
    if (const auto* const text = std::get_if<std::string>(&value_);
        text != nullptr) {
        return *text;
    }
    return std::get<EnumerationValue>(value_).value();
}

const RepresentationId& RepresentationValue::asIdentifier() const {
    return std::get<RepresentationId>(value_);
}

const std::vector<RepresentationValue>&
RepresentationValue::asCollection() const {
    return std::get<std::vector<RepresentationValue>>(value_);
}

RepresentationProperty::RepresentationProperty(RepresentationId id,
                                               std::string name,
                                               RepresentationType type,
                                               RepresentationValue value)
    : id_(std::move(id)), name_(std::move(name)), type_(std::move(type)),
      value_(std::move(value)) {}

const RepresentationId& RepresentationProperty::id() const noexcept {
    return id_;
}

std::string_view RepresentationProperty::name() const noexcept {
    return name_;
}

const RepresentationType& RepresentationProperty::type() const noexcept {
    return type_;
}

const RepresentationValue& RepresentationProperty::value() const noexcept {
    return value_;
}

RepresentationEntity::RepresentationEntity(RepresentationDocument& owner,
                                           RepresentationId id,
                                           RepresentationType type)
    : owner_(&owner), id_(std::move(id)), type_(std::move(type)) {}

const RepresentationId& RepresentationEntity::id() const noexcept {
    return id_;
}

const RepresentationType& RepresentationEntity::type() const noexcept {
    return type_;
}

const PropertyCollection& RepresentationEntity::properties() const noexcept {
    return property_view_;
}

RepresentationProperty&
RepresentationEntity::addProperty(std::string name,
                                  RepresentationType type,
                                  RepresentationValue value) {
    return owner_->addPropertyTo(
        *this, std::move(name), std::move(type), std::move(value));
}

const RepresentationProperty*
RepresentationEntity::property(const std::string_view name) const noexcept {
    const auto found =
        std::find_if(properties_.begin(),
                     properties_.end(),
                     [name](const auto& property) {
                         return property->name() == name;
                     });
    return found == properties_.end() ? nullptr : found->get();
}

RepresentationRelationship::RepresentationRelationship(
    RepresentationDocument& owner,
    RepresentationId id,
    RepresentationEntity& source,
    RepresentationEntity& target,
    RepresentationType type)
    : owner_(&owner), id_(std::move(id)), type_(std::move(type)),
      source_(&source), target_(&target) {}

const RepresentationId& RepresentationRelationship::id() const noexcept {
    return id_;
}

const RepresentationType& RepresentationRelationship::type() const noexcept {
    return type_;
}

const RepresentationEntity& RepresentationRelationship::source() const noexcept {
    return *source_;
}

const RepresentationEntity& RepresentationRelationship::target() const noexcept {
    return *target_;
}

RepresentationProperty&
RepresentationRelationship::addProperty(std::string name,
                                        RepresentationType type,
                                        RepresentationValue value) {
    return owner_->addPropertyTo(
        *this, std::move(name), std::move(type), std::move(value));
}

const PropertyCollection&
RepresentationRelationship::properties() const noexcept {
    return property_view_;
}

RepresentationMetadata::RepresentationMetadata(std::string author,
                                               std::string version,
                                               std::string provenance)
    : author_(std::move(author)), version_(std::move(version)),
      provenance_(std::move(provenance)) {}

std::string_view RepresentationMetadata::author() const noexcept {
    return author_;
}

std::string_view RepresentationMetadata::version() const noexcept {
    return version_;
}

std::string_view RepresentationMetadata::provenance() const noexcept {
    return provenance_;
}

struct RepresentationDocument::Impl {
    struct ModelState {
        Lifecycle lifecycle{Lifecycle::Mutable};
        std::vector<std::unique_ptr<RepresentationEntity>> entities;
        std::vector<std::unique_ptr<RepresentationRelationship>> relationships;
    };

    struct EntityBaseline {
        RepresentationEntity* object;
        std::size_t property_count;
    };

    struct RelationshipBaseline {
        RepresentationRelationship* object;
        std::size_t property_count;
    };

    struct TransactionSnapshot {
        Lifecycle lifecycle{Lifecycle::Mutable};
        std::vector<EntityBaseline> entities;
        std::vector<RelationshipBaseline> relationships;
        std::vector<std::unique_ptr<RepresentationEntity>> removed_entities;
        std::vector<std::unique_ptr<RepresentationRelationship>>
            removed_relationships;
        std::vector<std::unique_ptr<RepresentationEntity>> restored_entities;
        std::vector<std::unique_ptr<RepresentationRelationship>>
            restored_relationships;
    };

    explicit Impl(RepresentationMetadata document_metadata)
        : metadata(std::move(document_metadata)),
          state(std::make_unique<ModelState>()) {}

    RepresentationMetadata metadata;
    std::unique_ptr<ModelState> state;
    std::unique_ptr<TransactionSnapshot> snapshot;
    EntityCollection entity_view;
    RelationshipCollection relationship_view;
    std::uint64_t next_ordinal{1U};
    bool identifiers_exhausted{false};
    bool transaction_active{false};
};

RepresentationDocument::RepresentationDocument(RepresentationMetadata metadata)
    : impl_(std::make_unique<Impl>(std::move(metadata))) {}

RepresentationDocument::~RepresentationDocument() = default;

RepresentationLifecycleState RepresentationInternalAccess::lifecycleState(
    const RepresentationDocument& document) noexcept {
    switch (document.impl_->state->lifecycle) {
    case Lifecycle::Mutable:
        return RepresentationLifecycleState::Mutable;
    case Lifecycle::Validated:
        return RepresentationLifecycleState::Validated;
    case Lifecycle::Frozen:
        return RepresentationLifecycleState::Frozen;
    }
    assert(false);
    return RepresentationLifecycleState::Mutable;
}

void RepresentationInternalAccess::setIdentifierState(
    RepresentationDocument& document,
    const std::uint64_t next_ordinal,
    const bool exhausted) noexcept {
    document.impl_->next_ordinal = next_ordinal;
    document.impl_->identifiers_exhausted = exhausted;
}

void RepresentationInternalAccess::replaceId(RepresentationEntity& entity,
                                             RepresentationId id) {
    entity.id_ = std::move(id);
}

void RepresentationInternalAccess::replaceId(RepresentationProperty& property,
                                             RepresentationId id) {
    property.id_ = std::move(id);
}

void RepresentationInternalAccess::replaceId(
    RepresentationRelationship& relationship,
    RepresentationId id) {
    relationship.id_ = std::move(id);
}

void RepresentationInternalAccess::setLifecycleState(
    RepresentationDocument& document,
    const RepresentationLifecycleState state) noexcept {
    switch (state) {
    case RepresentationLifecycleState::Mutable:
        document.impl_->state->lifecycle = Lifecycle::Mutable;
        break;
    case RepresentationLifecycleState::Validated:
        document.impl_->state->lifecycle = Lifecycle::Validated;
        break;
    case RepresentationLifecycleState::Frozen:
        document.impl_->state->lifecycle = Lifecycle::Frozen;
        break;
    }
}

std::uint64_t RepresentationInternalAccess::nextIdentifierOrdinal(
    const RepresentationDocument& document) noexcept {
    return document.impl_->next_ordinal;
}

bool RepresentationInternalAccess::identifiersExhausted(
    const RepresentationDocument& document) noexcept {
    return document.impl_->identifiers_exhausted;
}

void RepresentationInternalAccess::renameProperty(
    RepresentationProperty& property,
    std::string name) {
    property.name_ = std::move(name);
}

void RepresentationInternalAccess::setEndpoints(
    RepresentationRelationship& relationship,
    RepresentationEntity& source,
    RepresentationEntity& target) noexcept {
    relationship.source_ = &source;
    relationship.target_ = &target;
}

void RepresentationDocument::ensureMutable() const {
    if (impl_->state->lifecycle == Lifecycle::Frozen) {
        throw std::logic_error{"Frozen representation document cannot be mutated"};
    }
}

RepresentationId RepresentationDocument::identifierCandidate() const {
    if (impl_->identifiers_exhausted) {
        throw std::overflow_error{"Representation identifier space exhausted"};
    }
    return make_identifier(impl_->next_ordinal);
}

void RepresentationDocument::consumeIdentifier() noexcept {
    if (impl_->next_ordinal == std::numeric_limits<std::uint64_t>::max()) {
        impl_->identifiers_exhausted = true;
        return;
    }
    ++impl_->next_ordinal;
}

void RepresentationDocument::markMutated() noexcept {
    if (impl_->state->lifecycle == Lifecycle::Validated) {
        impl_->state->lifecycle = Lifecycle::Mutable;
    }
}

void RepresentationDocument::rebuildViews() noexcept {
    assert(impl_->entity_view.capacity() >= impl_->state->entities.size());
    assert(impl_->relationship_view.capacity() >=
           impl_->state->relationships.size());

    impl_->entity_view.clear();
    for (const auto& entity : impl_->state->entities) {
        impl_->entity_view.emplace_back(*entity);
    }

    impl_->relationship_view.clear();
    for (const auto& relationship : impl_->state->relationships) {
        impl_->relationship_view.emplace_back(*relationship);
    }
}

bool RepresentationDocument::owns(
    const RepresentationEntity& entity) const noexcept {
    return std::any_of(
        impl_->state->entities.begin(),
        impl_->state->entities.end(),
        [&entity](const auto& candidate) { return candidate.get() == &entity; });
}

RepresentationEntity&
RepresentationDocument::createEntity(const RepresentationType& type) {
    ensureMutable();

    auto entity = std::unique_ptr<RepresentationEntity>{
        new RepresentationEntity{*this, identifierCandidate(), type}};

    const auto next_size = impl_->state->entities.size() + 1U;
    impl_->state->entities.reserve(next_size);
    impl_->entity_view.reserve(next_size);

    auto* const result = entity.get();
    impl_->state->entities.push_back(std::move(entity));
    impl_->entity_view.emplace_back(*result);
    consumeIdentifier();
    markMutated();
    return *result;
}

RepresentationRelationship& RepresentationDocument::createRelationship(
    RepresentationEntity& source,
    RepresentationEntity& target,
    const RepresentationType& type) {
    ensureMutable();
    if (!owns(source) || !owns(target)) {
        throw std::invalid_argument{
            "Relationship endpoints must belong to the receiving document"};
    }

    auto relationship = std::unique_ptr<RepresentationRelationship>{
        new RepresentationRelationship{
            *this, identifierCandidate(), source, target, type}};

    const auto next_size = impl_->state->relationships.size() + 1U;
    impl_->state->relationships.reserve(next_size);
    impl_->relationship_view.reserve(next_size);

    auto* const result = relationship.get();
    impl_->state->relationships.push_back(std::move(relationship));
    impl_->relationship_view.emplace_back(*result);
    consumeIdentifier();
    markMutated();
    return *result;
}

RepresentationProperty& RepresentationDocument::addPropertyTo(
    RepresentationEntity& owner,
    std::string name,
    RepresentationType type,
    RepresentationValue value) {
    ensureMutable();
    if (name.empty()) {
        throw std::invalid_argument{"Property name cannot be empty"};
    }
    if (owner.property(name) != nullptr) {
        throw std::invalid_argument{
            "Property name must be unique within its owner"};
    }

    auto property = std::unique_ptr<RepresentationProperty>{
        new RepresentationProperty{identifierCandidate(),
                                   std::move(name),
                                   std::move(type),
                                   std::move(value)}};

    const auto next_size = owner.properties_.size() + 1U;
    owner.properties_.reserve(next_size);
    owner.property_view_.reserve(next_size);

    auto* const result = property.get();
    owner.properties_.push_back(std::move(property));
    owner.property_view_.emplace_back(*result);
    consumeIdentifier();
    markMutated();
    return *result;
}

RepresentationProperty& RepresentationDocument::addPropertyTo(
    RepresentationRelationship& owner,
    std::string name,
    RepresentationType type,
    RepresentationValue value) {
    ensureMutable();
    if (name.empty()) {
        throw std::invalid_argument{"Property name cannot be empty"};
    }

    const auto duplicate =
        std::find_if(owner.properties_.begin(),
                     owner.properties_.end(),
                     [&name](const auto& property) {
                         return property->name() == name;
                     });
    if (duplicate != owner.properties_.end()) {
        throw std::invalid_argument{
            "Property name must be unique within its owner"};
    }

    auto property = std::unique_ptr<RepresentationProperty>{
        new RepresentationProperty{identifierCandidate(),
                                   std::move(name),
                                   std::move(type),
                                   std::move(value)}};

    const auto next_size = owner.properties_.size() + 1U;
    owner.properties_.reserve(next_size);
    owner.property_view_.reserve(next_size);

    auto* const result = property.get();
    owner.properties_.push_back(std::move(property));
    owner.property_view_.emplace_back(*result);
    consumeIdentifier();
    markMutated();
    return *result;
}

void RepresentationDocument::removeEntity(const RepresentationId& id) {
    ensureMutable();

    const auto found =
        std::find_if(impl_->state->entities.begin(),
                     impl_->state->entities.end(),
                     [&id](const auto& entity) { return entity->id() == id; });
    if (found == impl_->state->entities.end()) {
        return;
    }

    const auto* const entity = found->get();
    const auto incident =
        std::any_of(impl_->state->relationships.begin(),
                    impl_->state->relationships.end(),
                    [entity](const auto& relationship) {
                        return &relationship->source() == entity ||
                               &relationship->target() == entity;
                    });
    if (incident) {
        throw std::logic_error{
            "Entity with an incident relationship cannot be removed"};
    }

    if (impl_->transaction_active) {
        assert(impl_->snapshot != nullptr);
        const auto baseline =
            std::any_of(impl_->snapshot->entities.begin(),
                        impl_->snapshot->entities.end(),
                        [entity](const Impl::EntityBaseline& entry) {
                            return entry.object == entity;
                        });
        if (baseline) {
            assert(impl_->snapshot->removed_entities.size() <
                   impl_->snapshot->removed_entities.capacity());
            impl_->snapshot->removed_entities.push_back(std::move(*found));
        }
    }

    impl_->state->entities.erase(found);
    rebuildViews();
    markMutated();
}

void RepresentationDocument::removeRelationship(const RepresentationId& id) {
    ensureMutable();

    const auto found = std::find_if(
        impl_->state->relationships.begin(),
        impl_->state->relationships.end(),
        [&id](const auto& relationship) { return relationship->id() == id; });
    if (found == impl_->state->relationships.end()) {
        return;
    }

    if (impl_->transaction_active) {
        assert(impl_->snapshot != nullptr);
        const auto* const relationship = found->get();
        const auto baseline =
            std::any_of(impl_->snapshot->relationships.begin(),
                        impl_->snapshot->relationships.end(),
                        [relationship](
                            const Impl::RelationshipBaseline& entry) {
                            return entry.object == relationship;
                        });
        if (baseline) {
            assert(impl_->snapshot->removed_relationships.size() <
                   impl_->snapshot->removed_relationships.capacity());
            impl_->snapshot->removed_relationships.push_back(
                std::move(*found));
        }
    }

    impl_->state->relationships.erase(found);
    rebuildViews();
    markMutated();
}

const EntityCollection& RepresentationDocument::entities() const noexcept {
    return impl_->entity_view;
}

const RelationshipCollection&
RepresentationDocument::relationships() const noexcept {
    return impl_->relationship_view;
}

const RepresentationMetadata&
RepresentationDocument::metadata() const noexcept {
    return impl_->metadata;
}

bool RepresentationDocument::isFrozen() const noexcept {
    return impl_->state->lifecycle == Lifecycle::Frozen;
}

void RepresentationDocument::beginTransaction() {
    auto snapshot = std::make_unique<Impl::TransactionSnapshot>();
    snapshot->lifecycle = impl_->state->lifecycle;
    const auto entity_count = impl_->state->entities.size();
    const auto relationship_count = impl_->state->relationships.size();

    snapshot->entities.reserve(entity_count);
    snapshot->removed_entities.reserve(entity_count);
    snapshot->restored_entities.reserve(entity_count);
    snapshot->relationships.reserve(relationship_count);
    snapshot->removed_relationships.reserve(relationship_count);
    snapshot->restored_relationships.reserve(relationship_count);

    for (const auto& entity : impl_->state->entities) {
        snapshot->entities.push_back(Impl::EntityBaseline{
            .object = entity.get(),
            .property_count = entity->properties_.size(),
        });
    }

    for (const auto& relationship : impl_->state->relationships) {
        snapshot->relationships.push_back(Impl::RelationshipBaseline{
            .object = relationship.get(),
            .property_count = relationship->properties_.size(),
        });
    }

    impl_->snapshot = std::move(snapshot);
    impl_->transaction_active = true;
}

void RepresentationDocument::commitTransaction() noexcept {
    impl_->state->lifecycle = Lifecycle::Validated;
    impl_->transaction_active = false;
    impl_->snapshot.reset();
}

void RepresentationDocument::rollbackTransaction() noexcept {
    assert(impl_->snapshot != nullptr);
    auto& snapshot = *impl_->snapshot;

    assert(snapshot.restored_entities.empty());
    assert(snapshot.restored_relationships.empty());

    for (const auto& baseline : snapshot.entities) {
        auto restored =
            take_owned_object(impl_->state->entities, baseline.object);
        if (restored == nullptr) {
            restored =
                take_owned_object(snapshot.removed_entities, baseline.object);
        }
        assert(restored != nullptr);
        assert(restored->properties_.size() >= baseline.property_count);
        assert(restored->property_view_.size() >= baseline.property_count);
        while (restored->properties_.size() > baseline.property_count) {
            restored->property_view_.pop_back();
            restored->properties_.pop_back();
        }
        assert(restored->property_view_.size() ==
               restored->properties_.size());
        assert(snapshot.restored_entities.size() <
               snapshot.restored_entities.capacity());
        snapshot.restored_entities.push_back(std::move(restored));
    }

    for (const auto& baseline : snapshot.relationships) {
        auto restored =
            take_owned_object(impl_->state->relationships, baseline.object);
        if (restored == nullptr) {
            restored = take_owned_object(snapshot.removed_relationships,
                                         baseline.object);
        }
        assert(restored != nullptr);
        assert(restored->properties_.size() >= baseline.property_count);
        assert(restored->property_view_.size() >= baseline.property_count);
        while (restored->properties_.size() > baseline.property_count) {
            restored->property_view_.pop_back();
            restored->properties_.pop_back();
        }
        assert(restored->property_view_.size() ==
               restored->properties_.size());
        assert(snapshot.restored_relationships.size() <
               snapshot.restored_relationships.capacity());
        snapshot.restored_relationships.push_back(std::move(restored));
    }

    impl_->state->relationships.swap(snapshot.restored_relationships);
    impl_->state->entities.swap(snapshot.restored_entities);
    impl_->state->lifecycle = snapshot.lifecycle;
    rebuildViews();
    impl_->snapshot.reset();
    impl_->transaction_active = false;
}

ValidationResult
ValidationService::validate(const RepresentationDocument& document) const {
    std::vector<Diagnostic> diagnostics;

    std::set<std::string_view, std::less<>> identifiers;
    const auto inspect_identifier =
        [&diagnostics, &identifiers](const auto& object) {
            if (!identifiers.insert(object.id().value()).second) {
                add_diagnostic(
                    diagnostics,
                    DiagnosticCode::DuplicateIdentifier,
                    "Duplicate identifier: " + object.id().toString());
            }
        };

    for (const auto& entity_reference : document.entities()) {
        const auto& entity = entity_reference.get();
        inspect_identifier(entity);
        for (const auto& property_reference : entity.properties()) {
            inspect_identifier(property_reference.get());
        }
    }
    for (const auto& relationship_reference : document.relationships()) {
        const auto& relationship = relationship_reference.get();
        inspect_identifier(relationship);
        for (const auto& property_reference : relationship.properties()) {
            inspect_identifier(property_reference.get());
        }
    }

    for (const auto& entity_reference : document.entities()) {
        const auto& entity = entity_reference.get();
        if (entity.type().name().empty()) {
            add_diagnostic(diagnostics,
                           DiagnosticCode::MissingType,
                           "Entity has an empty type: " +
                               entity.id().toString());
        }
        for (const auto& property_reference : entity.properties()) {
            const auto& property = property_reference.get();
            if (property.type().name().empty()) {
                add_diagnostic(
                    diagnostics,
                    DiagnosticCode::MissingType,
                    "Property has an empty type: " +
                        property.id().toString());
            }
        }
    }
    for (const auto& relationship_reference : document.relationships()) {
        const auto& relationship = relationship_reference.get();
        if (relationship.type().name().empty()) {
            add_diagnostic(diagnostics,
                           DiagnosticCode::MissingType,
                           "Relationship has an empty type: " +
                               relationship.id().toString());
        }
        for (const auto& property_reference : relationship.properties()) {
            const auto& property = property_reference.get();
            if (property.type().name().empty()) {
                add_diagnostic(
                    diagnostics,
                    DiagnosticCode::MissingType,
                    "Property has an empty type: " +
                        property.id().toString());
            }
        }
    }

    for (const auto& entity_reference : document.entities()) {
        const auto& entity = entity_reference.get();
        std::set<std::string_view, std::less<>> names;
        for (const auto& property_reference : entity.properties()) {
            const auto& property = property_reference.get();
            if (!names.insert(property.name()).second) {
                add_diagnostic(
                    diagnostics,
                    DiagnosticCode::DuplicateProperty,
                    "Duplicate entity property: " +
                        std::string{property.name()});
            }
        }
    }
    for (const auto& relationship_reference : document.relationships()) {
        const auto& relationship = relationship_reference.get();
        std::set<std::string_view, std::less<>> names;
        for (const auto& property_reference : relationship.properties()) {
            const auto& property = property_reference.get();
            if (!names.insert(property.name()).second) {
                add_diagnostic(
                    diagnostics,
                    DiagnosticCode::DuplicateProperty,
                    "Duplicate relationship property: " +
                        std::string{property.name()});
            }
        }
    }

    for (const auto& relationship_reference : document.relationships()) {
        const auto& relationship = relationship_reference.get();
        const auto source_present = std::any_of(
            document.entities().begin(),
            document.entities().end(),
            [&relationship](const auto& entity_reference) {
                return &entity_reference.get() == &relationship.source();
            });
        const auto target_present = std::any_of(
            document.entities().begin(),
            document.entities().end(),
            [&relationship](const auto& entity_reference) {
                return &entity_reference.get() == &relationship.target();
            });
        if (!source_present || !target_present) {
            add_diagnostic(diagnostics,
                           DiagnosticCode::InvalidRelationship,
                           "Relationship endpoint is absent: " +
                               relationship.id().toString());
        }
    }

    for (const auto& entity_reference : document.entities()) {
        for (const auto& property_reference :
             entity_reference.get().properties()) {
            const auto& property = property_reference.get();
            if (property.name().empty()) {
                add_diagnostic(
                    diagnostics,
                    DiagnosticCode::ValidationError,
                    "Property has an empty name: " +
                        property.id().toString());
            }
        }
    }
    for (const auto& relationship_reference : document.relationships()) {
        for (const auto& property_reference :
             relationship_reference.get().properties()) {
            const auto& property = property_reference.get();
            if (property.name().empty()) {
                add_diagnostic(
                    diagnostics,
                    DiagnosticCode::ValidationError,
                    "Property has an empty name: " +
                        property.id().toString());
            }
        }
    }

    const auto has_error =
        std::any_of(diagnostics.begin(),
                    diagnostics.end(),
                    [](const Diagnostic& diagnostic) {
                        return diagnostic.severity ==
                               DiagnosticSeverity::Error;
                    });
    return ValidationResult{
        .valid = !has_error,
        .diagnostics = std::move(diagnostics),
    };
}

Transaction::Transaction(RepresentationDocument& document) noexcept
    : document_(&document), active_(true) {}

Transaction::Transaction(Transaction&& other) noexcept
    : document_(std::exchange(other.document_, nullptr)),
      active_(std::exchange(other.active_, false)) {}

Transaction& Transaction::operator=(Transaction&& other) noexcept {
    if (this == &other) {
        return *this;
    }

    if (active_) {
        document_->rollbackTransaction();
    }
    document_ = std::exchange(other.document_, nullptr);
    active_ = std::exchange(other.active_, false);
    return *this;
}

Transaction::~Transaction() {
    if (active_) {
        document_->rollbackTransaction();
    }
}

bool Transaction::active() const noexcept {
    return active_;
}

ValidationResult Transaction::commit() {
    if (!active_) {
        throw std::logic_error{"Cannot commit an inactive transaction"};
    }

    auto result = ValidationService{}.validate(*document_);
    if (result.valid) {
        document_->commitTransaction();
        active_ = false;
    }
    return result;
}

void Transaction::rollback() {
    if (!active_) {
        throw std::logic_error{"Cannot roll back an inactive transaction"};
    }

    document_->rollbackTransaction();
    active_ = false;
}

Transaction TransactionService::begin(RepresentationDocument& document) {
    if (document.isFrozen()) {
        throw std::logic_error{
            "Cannot begin a transaction on a frozen document"};
    }
    if (document.impl_->transaction_active) {
        throw std::logic_error{"Nested representation transactions are not supported"};
    }

    const auto baseline = ValidationService{}.validate(document);
    if (!baseline.valid) {
        throw std::logic_error{
            "Cannot begin a transaction from an invalid document"};
    }

    document.beginTransaction();
    return Transaction{document};
}

ValidationResult FreezeService::freeze(RepresentationDocument& document) {
    if (document.impl_->transaction_active) {
        std::vector<Diagnostic> diagnostics;
        add_diagnostic(diagnostics,
                       DiagnosticCode::TransactionError,
                       "Cannot freeze a document with an active transaction");
        return ValidationResult{
            .valid = false,
            .diagnostics = std::move(diagnostics),
        };
    }

    auto result = ValidationService{}.validate(document);
    if (result.valid) {
        document.impl_->state->lifecycle = Lifecycle::Frozen;
    }
    return result;
}

const RepresentationEntity* QueryService::findEntity(
    const RepresentationDocument& document,
    const RepresentationId& id) const noexcept {
    const auto found =
        std::find_if(document.entities().begin(),
                     document.entities().end(),
                     [&id](const auto& entity_reference) {
                         return entity_reference.get().id() == id;
                     });
    return found == document.entities().end() ? nullptr : &found->get();
}

const RepresentationRelationship* QueryService::findRelationship(
    const RepresentationDocument& document,
    const RepresentationId& id) const noexcept {
    const auto found =
        std::find_if(document.relationships().begin(),
                     document.relationships().end(),
                     [&id](const auto& relationship_reference) {
                         return relationship_reference.get().id() == id;
                     });
    return found == document.relationships().end() ? nullptr : &found->get();
}

EntityCollection QueryService::entitiesByType(
    const RepresentationDocument& document,
    const RepresentationType& type) const {
    EntityCollection result;
    result.reserve(document.entities().size());
    for (const auto& entity_reference : document.entities()) {
        if (entity_reference.get().type() == type) {
            result.push_back(entity_reference);
        }
    }
    return result;
}

} // namespace cca::representation

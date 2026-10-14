#pragma once

#include <cstdint>
#include <functional>
#include <memory>
#include <string>
#include <string_view>
#include <variant>
#include <vector>

namespace cca::representation {

class RepresentationDocument;
class RepresentationEntity;
class RepresentationRelationship;
class RepresentationProperty;
class RepresentationType;
class RepresentationValue;
class RepresentationMetadata;
class RepresentationId;
class EnumerationValue;

class ValidationService;
class QueryService;
class TransactionService;
class FreezeService;
class Transaction;

using EntityCollection =
    std::vector<std::reference_wrapper<const RepresentationEntity>>;

using RelationshipCollection =
    std::vector<std::reference_wrapper<const RepresentationRelationship>>;

using PropertyCollection =
    std::vector<std::reference_wrapper<const RepresentationProperty>>;

class RepresentationId {
  public:
    explicit RepresentationId(std::string value);

    std::string_view value() const noexcept;

    std::string toString() const;

    bool operator==(const RepresentationId&) const noexcept;

    bool operator!=(const RepresentationId&) const noexcept;

    bool operator<(const RepresentationId&) const noexcept;

  private:
    std::string value_;
};

class RepresentationType {
  public:
    explicit RepresentationType(std::string name);

    std::string_view name() const noexcept;

    bool operator==(const RepresentationType&) const noexcept;

  private:
    std::string name_;
};

class EnumerationValue {
  public:
    explicit EnumerationValue(std::string value);

    std::string_view value() const noexcept;

  private:
    std::string value_;
};

enum class ValueKind {
    Boolean,
    Integer,
    FloatingPoint,
    String,
    Enumeration,
    Identifier,
    Collection
};

class RepresentationValue {
  public:
    explicit RepresentationValue(bool value);

    explicit RepresentationValue(std::int64_t value);

    explicit RepresentationValue(double value);

    explicit RepresentationValue(std::string value);

    explicit RepresentationValue(const char* value);

    explicit RepresentationValue(EnumerationValue value);

    explicit RepresentationValue(RepresentationId value);

    explicit RepresentationValue(std::vector<RepresentationValue> value);

    ValueKind kind() const noexcept;

    bool asBoolean() const;

    std::int64_t asInteger() const;

    double asFloatingPoint() const;

    std::string_view asString() const;

    const RepresentationId& asIdentifier() const;

    const std::vector<RepresentationValue>& asCollection() const;

  private:
    using Storage = std::variant<bool,
                                 std::int64_t,
                                 double,
                                 std::string,
                                 EnumerationValue,
                                 RepresentationId,
                                 std::vector<RepresentationValue>>;

    Storage value_;
};

class RepresentationProperty {
  public:
    RepresentationProperty(const RepresentationProperty&) = delete;

    RepresentationProperty& operator=(const RepresentationProperty&) = delete;

    const RepresentationId& id() const noexcept;

    std::string_view name() const noexcept;

    const RepresentationType& type() const noexcept;

    const RepresentationValue& value() const noexcept;

  private:
    friend class RepresentationDocument;
    friend class RepresentationInternalAccess;

    RepresentationProperty(RepresentationId id,
                           std::string name,
                           RepresentationType type,
                           RepresentationValue value);

    RepresentationId id_;
    std::string name_;
    RepresentationType type_;
    RepresentationValue value_;
};

class RepresentationEntity {
  public:
    RepresentationEntity(const RepresentationEntity&) = delete;

    RepresentationEntity& operator=(const RepresentationEntity&) = delete;

    const RepresentationId& id() const noexcept;

    const RepresentationType& type() const noexcept;

    const PropertyCollection& properties() const noexcept;

    RepresentationProperty& addProperty(std::string name,
                                        RepresentationType type,
                                        RepresentationValue value);

    const RepresentationProperty* property(std::string_view name) const noexcept;

  private:
    friend class RepresentationDocument;
    friend class RepresentationInternalAccess;

    RepresentationEntity(RepresentationDocument& owner,
                         RepresentationId id,
                         RepresentationType type);

    RepresentationDocument* owner_;
    RepresentationId id_;
    RepresentationType type_;
    std::vector<std::unique_ptr<RepresentationProperty>> properties_;
    PropertyCollection property_view_;
};

class RepresentationRelationship {
  public:
    RepresentationRelationship(const RepresentationRelationship&) = delete;

    RepresentationRelationship&
    operator=(const RepresentationRelationship&) = delete;

    const RepresentationId& id() const noexcept;

    const RepresentationType& type() const noexcept;

    const RepresentationEntity& source() const noexcept;

    const RepresentationEntity& target() const noexcept;

    RepresentationProperty& addProperty(std::string name,
                                        RepresentationType type,
                                        RepresentationValue value);

    const PropertyCollection& properties() const noexcept;

  private:
    friend class RepresentationDocument;
    friend class RepresentationInternalAccess;

    RepresentationRelationship(RepresentationDocument& owner,
                               RepresentationId id,
                               RepresentationEntity& source,
                               RepresentationEntity& target,
                               RepresentationType type);

    RepresentationDocument* owner_;
    RepresentationId id_;
    RepresentationType type_;
    RepresentationEntity* source_;
    RepresentationEntity* target_;
    std::vector<std::unique_ptr<RepresentationProperty>> properties_;
    PropertyCollection property_view_;
};

class RepresentationMetadata {
  public:
    explicit RepresentationMetadata(std::string author = {},
                                    std::string version = {},
                                    std::string provenance = {});

    std::string_view author() const noexcept;

    std::string_view version() const noexcept;

    std::string_view provenance() const noexcept;

  private:
    std::string author_;
    std::string version_;
    std::string provenance_;
};

class RepresentationDocument {
  public:
    explicit RepresentationDocument(
        RepresentationMetadata metadata = RepresentationMetadata{});

    ~RepresentationDocument();

    RepresentationDocument(const RepresentationDocument&) = delete;

    RepresentationDocument& operator=(const RepresentationDocument&) = delete;

    RepresentationDocument(RepresentationDocument&&) = delete;

    RepresentationDocument& operator=(RepresentationDocument&&) = delete;

    RepresentationEntity& createEntity(const RepresentationType& type);

    RepresentationRelationship&
    createRelationship(RepresentationEntity& source,
                       RepresentationEntity& target,
                       const RepresentationType& type);

    void removeEntity(const RepresentationId& id);

    void removeRelationship(const RepresentationId& id);

    const EntityCollection& entities() const noexcept;

    const RelationshipCollection& relationships() const noexcept;

    const RepresentationMetadata& metadata() const noexcept;

    bool isFrozen() const noexcept;

  private:
    friend class FreezeService;
    friend class RepresentationEntity;
    friend class RepresentationInternalAccess;
    friend class RepresentationRelationship;
    friend class Transaction;
    friend class TransactionService;

    struct Impl;

    RepresentationProperty& addPropertyTo(RepresentationEntity& owner,
                                          std::string name,
                                          RepresentationType type,
                                          RepresentationValue value);
    RepresentationProperty& addPropertyTo(RepresentationRelationship& owner,
                                          std::string name,
                                          RepresentationType type,
                                          RepresentationValue value);
    void beginTransaction();
    void commitTransaction() noexcept;
    void rollbackTransaction() noexcept;
    void ensureMutable() const;
    RepresentationId identifierCandidate() const;
    void consumeIdentifier() noexcept;
    void markMutated() noexcept;
    void rebuildViews() noexcept;
    bool owns(const RepresentationEntity& entity) const noexcept;

    std::unique_ptr<Impl> impl_;
};

enum class DiagnosticSeverity {
    Information = 0,
    Warning = 1,
    Error = 2
};

enum class DiagnosticCode {
    None = 0,
    DuplicateIdentifier = 1,
    MissingType = 2,
    DuplicateProperty = 3,
    InvalidRelationship = 4,
    FrozenDocument = 5,
    ValidationError = 6,
    TransactionError = 7
};

struct Diagnostic {
    DiagnosticCode code;
    DiagnosticSeverity severity;
    std::string message;
};

struct ValidationResult {
    bool valid;
    std::vector<Diagnostic> diagnostics;
};

class ValidationService {
  public:
    ValidationResult validate(const RepresentationDocument& document) const;
};

class Transaction {
  public:
    Transaction(const Transaction&) = delete;

    Transaction& operator=(const Transaction&) = delete;

    Transaction(Transaction&& other) noexcept;

    Transaction& operator=(Transaction&& other) noexcept;

    ~Transaction();

    bool active() const noexcept;

    ValidationResult commit();

    void rollback();

  private:
    friend class TransactionService;

    explicit Transaction(RepresentationDocument& document) noexcept;

    RepresentationDocument* document_;
    bool active_;
};

class TransactionService {
  public:
    Transaction begin(RepresentationDocument& document);
};

class FreezeService {
  public:
    ValidationResult freeze(RepresentationDocument& document);
};

class QueryService {
  public:
    const RepresentationEntity*
    findEntity(const RepresentationDocument& document,
               const RepresentationId& id) const noexcept;

    const RepresentationRelationship*
    findRelationship(const RepresentationDocument& document,
                     const RepresentationId& id) const noexcept;

    EntityCollection
    entitiesByType(const RepresentationDocument& document,
                   const RepresentationType& type) const;
};

} // namespace cca::representation

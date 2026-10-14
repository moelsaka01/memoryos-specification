#include "long_term_memory_persistence.hpp"

#include <cca/persistence/persistence.hpp>

#include <cstdint>
#include <stdexcept>
#include <string>
#include <string_view>
#include <unordered_set>
#include <utility>
#include <vector>

namespace cca::memory::detail {
namespace {

using cca::representation::FreezeService;
using cca::representation::RepresentationDocument;
using cca::representation::RepresentationEntity;
using cca::representation::RepresentationMetadata;
using cca::representation::RepresentationProperty;
using cca::representation::RepresentationType;
using cca::representation::RepresentationValue;
using cca::representation::ValidationService;
using cca::representation::ValueKind;

constexpr std::string_view manifest_type{
    "cca.memory.long-term-memory.persistence.v1"};
constexpr std::string_view schema_property{"schema-version"};
constexpr std::string_view workspace_property{"workspace-identifier"};
constexpr std::string_view entries_property{"entries"};
constexpr std::string_view forgotten_property{"forgotten-identifiers"};

constexpr std::string_view integer_type{"cca.integer"};
constexpr std::string_view string_type{"cca.string"};
constexpr std::string_view entry_collection_type{
    "cca.memory.long-term-memory.entries"};
constexpr std::string_view identifier_collection_type{
    "cca.memory.long-term-memory.identifiers"};

[[noreturn]] void invalid_projection(const std::string_view reason) {
    throw std::invalid_argument{
        "Invalid Long-Term Memory Workspace Asset projection: " +
        std::string{reason}};
}

const RepresentationProperty& required_property(
    const RepresentationEntity& manifest,
    const std::string_view name,
    const std::string_view type) {
    const auto* const property = manifest.property(name);
    if (property == nullptr || property->type().name() != type) {
        invalid_projection("missing or incorrectly typed property " +
                           std::string{name});
    }
    return *property;
}

const RepresentationEntity& find_manifest(
    const RepresentationDocument& workspace) {
    const RepresentationEntity* found = nullptr;
    for (const auto& reference : workspace.entities()) {
        const auto& entity = reference.get();
        if (entity.type().name() != manifest_type) {
            continue;
        }
        if (found != nullptr) {
            invalid_projection("multiple Long-Term Memory manifests");
        }
        found = &entity;
    }
    if (found == nullptr) {
        invalid_projection("Long-Term Memory manifest is absent");
    }
    return *found;
}

std::vector<RepresentationValue> encode_entries(
    const LongTermMemory& memory) {
    std::vector<RepresentationValue> encoded;
    encoded.reserve(memory.entries().size());
    for (const auto& entry : memory.entries()) {
        std::vector<RepresentationValue> record;
        record.reserve(3U);
        record.emplace_back(entry.identifier());
        record.emplace_back(entry.value());
        record.emplace_back(entry.archived());
        encoded.emplace_back(std::move(record));
    }
    return encoded;
}

struct DecodedEntry {
    std::string identifier;
    std::string value;
    bool archived;
};

std::vector<DecodedEntry> decode_entries(
    const RepresentationProperty& property,
    std::unordered_set<std::string>& identifiers) {
    if (property.value().kind() != ValueKind::Collection) {
        invalid_projection("entries is not a collection");
    }

    std::vector<DecodedEntry> decoded;
    const auto& records = property.value().asCollection();
    decoded.reserve(records.size());
    for (const auto& record_value : records) {
        if (record_value.kind() != ValueKind::Collection) {
            invalid_projection("entry record is not a collection");
        }
        const auto& record = record_value.asCollection();
        if (record.size() != 3U || record[0].kind() != ValueKind::String ||
            record[1].kind() != ValueKind::String ||
            record[2].kind() != ValueKind::Boolean) {
            invalid_projection("entry record has an invalid shape");
        }

        DecodedEntry entry{
            .identifier = std::string{record[0].asString()},
            .value = std::string{record[1].asString()},
            .archived = record[2].asBoolean(),
        };
        if (entry.identifier.empty()) {
            invalid_projection("entry identifier is empty");
        }
        if (!identifiers.insert(entry.identifier).second) {
            invalid_projection("entry identifier is duplicated");
        }
        decoded.push_back(std::move(entry));
    }
    return decoded;
}

std::vector<std::string> decode_forgotten_identifiers(
    const RepresentationProperty& property,
    std::unordered_set<std::string>& identifiers) {
    if (property.value().kind() != ValueKind::Collection) {
        invalid_projection("forgotten identifiers is not a collection");
    }

    std::vector<std::string> decoded;
    const auto& values = property.value().asCollection();
    decoded.reserve(values.size());
    for (const auto& value : values) {
        if (value.kind() != ValueKind::String) {
            invalid_projection("forgotten identifier is not a string");
        }
        auto identifier = std::string{value.asString()};
        if (identifier.empty()) {
            invalid_projection("forgotten identifier is empty");
        }
        if (!identifiers.insert(identifier).second) {
            invalid_projection("identifier appears more than once");
        }
        decoded.push_back(std::move(identifier));
    }
    return decoded;
}

void require_success(const LongTermMemoryResult& result,
                     const std::string_view operation) {
    if (!result.succeeded()) {
        throw std::logic_error{
            "Validated Long-Term Memory persistence reconstruction failed "
            "during " +
            std::string{operation} + ": " + result.code()};
    }
}

} // namespace

std::unique_ptr<RepresentationDocument>
LongTermMemoryPersistence::project(const LongTermMemory& memory) {
    std::vector<RepresentationValue> forgotten_identifiers;
    forgotten_identifiers.reserve(memory.forgotten_identifiers_.size());
    for (const auto& identifier : memory.forgotten_identifiers_) {
        forgotten_identifiers.emplace_back(identifier);
    }

    auto workspace = std::make_unique<RepresentationDocument>(
        RepresentationMetadata{"CCA", "CCA-LTMEM-1.0",
                               "private Workspace Asset projection"});
    auto& manifest = workspace->createEntity(
        RepresentationType{std::string{manifest_type}});
    manifest.addProperty(
        std::string{schema_property},
        RepresentationType{std::string{integer_type}},
        RepresentationValue{std::int64_t{1}});
    manifest.addProperty(
        std::string{workspace_property},
        RepresentationType{std::string{string_type}},
        RepresentationValue{memory.workspaceIdentifier()});
    manifest.addProperty(
        std::string{entries_property},
        RepresentationType{std::string{entry_collection_type}},
        RepresentationValue{encode_entries(memory)});
    manifest.addProperty(
        std::string{forgotten_property},
        RepresentationType{std::string{identifier_collection_type}},
        RepresentationValue{std::move(forgotten_identifiers)});

    const auto frozen = FreezeService{}.freeze(*workspace);
    if (!frozen.valid) {
        throw std::logic_error{
            "Long-Term Memory Workspace Asset projection is invalid"};
    }
    return workspace;
}

LongTermMemory LongTermMemoryPersistence::reconstruct(
    const RepresentationDocument& workspace) {
    if (!ValidationService{}.validate(workspace).valid) {
        invalid_projection("Workspace Representation is invalid");
    }

    const auto& manifest = find_manifest(workspace);
    if (manifest.properties().size() != 4U) {
        invalid_projection("manifest property set is not canonical");
    }

    const auto& schema =
        required_property(manifest, schema_property, integer_type);
    if (schema.value().kind() != ValueKind::Integer ||
        schema.value().asInteger() != std::int64_t{1}) {
        invalid_projection("schema version is unsupported");
    }

    const auto& workspace_identifier =
        required_property(manifest, workspace_property, string_type);
    if (workspace_identifier.value().kind() != ValueKind::String) {
        invalid_projection("Workspace identifier is not a string");
    }
    auto workspace_identifier_value =
        std::string{workspace_identifier.value().asString()};
    if (workspace_identifier_value.empty()) {
        invalid_projection("Workspace identifier is empty");
    }

    std::unordered_set<std::string> identifiers;
    const auto decoded_entries = decode_entries(
        required_property(manifest, entries_property, entry_collection_type),
        identifiers);
    const auto forgotten_identifiers = decode_forgotten_identifiers(
        required_property(manifest,
                          forgotten_property,
                          identifier_collection_type),
        identifiers);

    LongTermMemory reconstructed{std::move(workspace_identifier_value)};
    LongTermMemoryEngine engine;
    for (const auto& entry : decoded_entries) {
        auto retained = engine.retain(
            reconstructed,
            LongTermMemoryEntry{entry.identifier, entry.value});
        require_success(retained, "retain");
        if (entry.archived) {
            auto archived = engine.archive(reconstructed, entry.identifier);
            require_success(archived, "archive");
        }
    }
    for (const auto& identifier : forgotten_identifiers) {
        auto retained = engine.retain(
            reconstructed, LongTermMemoryEntry{identifier, std::string{}});
        require_success(retained, "forgotten-lineage retain");
        auto forgotten = engine.forget(reconstructed, identifier);
        require_success(forgotten, "forgotten-lineage forget");
    }
    return reconstructed;
}

LongTermMemory
LongTermMemoryPersistence::roundTrip(const LongTermMemory& memory) {
    auto workspace = project(memory);
    cca::persistence::PersistenceEngine engine;
    auto saved = engine.save(
        *workspace,
        cca::persistence::PersistenceMetadata{
            memory.workspaceIdentifier(), "CCA-LTMEM-1.0"});
    if (!saved.succeeded() || saved.package() == nullptr) {
        throw std::logic_error{
            "CCA-PERSIST rejected the Long-Term Memory projection"};
    }

    auto loaded = engine.load(*saved.package());
    if (!loaded.succeeded() || loaded.package() == nullptr) {
        throw std::logic_error{
            "CCA-PERSIST failed to load the Long-Term Memory projection"};
    }
    return reconstruct(loaded.package()->workspace());
}

} // namespace cca::memory::detail

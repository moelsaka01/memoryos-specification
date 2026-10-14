#include "episodic_memory_persistence.hpp"

#include <cca/persistence/persistence.hpp>

#include <algorithm>
#include <cstdint>
#include <stdexcept>
#include <string>
#include <string_view>
#include <unordered_map>
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
    "cca.memory.episodic-memory.persistence.v1"};
constexpr std::string_view schema_property{"schema-version"};
constexpr std::string_view workspace_property{"workspace-identifier"};
constexpr std::string_view episodes_property{"episodes"};
constexpr std::string_view forgotten_property{"forgotten-identifiers"};

constexpr std::string_view integer_type{"cca.integer"};
constexpr std::string_view string_type{"cca.string"};
constexpr std::string_view episode_collection_type{
    "cca.memory.episodic-memory.episodes"};
constexpr std::string_view identifier_collection_type{
    "cca.memory.episodic-memory.identifiers"};

[[noreturn]] void invalid_projection(const std::string_view reason) {
    throw std::invalid_argument{
        "Invalid Episodic Memory Workspace Asset projection: " +
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
            invalid_projection("multiple Episodic Memory manifests");
        }
        found = &entity;
    }
    if (found == nullptr) {
        invalid_projection("Episodic Memory manifest is absent");
    }
    return *found;
}

std::vector<RepresentationValue> encode_strings(
    const std::vector<std::string>& values) {
    std::vector<RepresentationValue> encoded;
    encoded.reserve(values.size());
    for (const auto& value : values) {
        encoded.emplace_back(value);
    }
    return encoded;
}

std::vector<RepresentationValue> encode_provenance(
    const std::vector<LongTermMemoryEntry>& source_entries) {
    std::vector<RepresentationValue> encoded;
    encoded.reserve(source_entries.size());
    for (const auto& entry : source_entries) {
        std::vector<RepresentationValue> record;
        record.reserve(3U);
        record.emplace_back(entry.identifier());
        record.emplace_back(entry.value());
        record.emplace_back(entry.archived());
        encoded.emplace_back(std::move(record));
    }
    return encoded;
}

std::vector<RepresentationValue> encode_episodes(
    const EpisodicMemory& memory) {
    std::vector<RepresentationValue> encoded;
    encoded.reserve(memory.episodes().size());
    for (const auto& episode : memory.episodes()) {
        std::vector<RepresentationValue> record;
        record.reserve(6U);
        record.emplace_back(episode.identifier());
        record.emplace_back(episode.occurrence());
        record.emplace_back(episode.context());
        record.emplace_back(episode.chronology());
        record.emplace_back(encode_provenance(episode.sourceEntries()));
        record.emplace_back(
            encode_strings(episode.linkedEpisodeIdentifiers()));
        encoded.emplace_back(std::move(record));
    }
    return encoded;
}

struct DecodedSourceEntry {
    std::string identifier;
    std::string value;
};

struct DecodedEpisode {
    std::string identifier;
    std::string occurrence;
    std::string context;
    std::int64_t chronology{};
    std::vector<DecodedSourceEntry> source_entries;
    std::vector<std::string> linked_episode_identifiers;
};

std::vector<std::string> decode_string_collection(
    const RepresentationValue& value,
    const std::string_view collection_name) {
    if (value.kind() != ValueKind::Collection) {
        invalid_projection(std::string{collection_name} +
                           " is not a collection");
    }

    std::vector<std::string> decoded;
    std::unordered_set<std::string> unique_values;
    const auto& values = value.asCollection();
    decoded.reserve(values.size());
    unique_values.reserve(values.size());
    for (const auto& item : values) {
        if (item.kind() != ValueKind::String) {
            invalid_projection(std::string{collection_name} +
                               " contains a non-string value");
        }
        auto decoded_value = std::string{item.asString()};
        if (decoded_value.empty()) {
            invalid_projection(std::string{collection_name} +
                               " contains an empty value");
        }
        if (!unique_values.insert(decoded_value).second) {
            invalid_projection(std::string{collection_name} +
                               " contains a duplicate value");
        }
        decoded.push_back(std::move(decoded_value));
    }
    return decoded;
}

std::vector<DecodedSourceEntry> decode_provenance(
    const RepresentationValue& value,
    const std::string_view episode_identifier) {
    if (value.kind() != ValueKind::Collection) {
        invalid_projection("episode provenance is not a collection");
    }

    std::vector<DecodedSourceEntry> decoded;
    std::unordered_set<std::string> source_identifiers;
    const auto& records = value.asCollection();
    if (records.empty()) {
        invalid_projection("episode provenance is empty");
    }
    decoded.reserve(records.size());
    source_identifiers.reserve(records.size());
    for (const auto& record_value : records) {
        if (record_value.kind() != ValueKind::Collection) {
            invalid_projection("provenance record is not a collection");
        }
        const auto& record = record_value.asCollection();
        if (record.size() != 3U ||
            record[0].kind() != ValueKind::String ||
            record[1].kind() != ValueKind::String ||
            record[2].kind() != ValueKind::Boolean) {
            invalid_projection("provenance record has an invalid shape");
        }

        auto identifier = std::string{record[0].asString()};
        if (identifier.empty()) {
            invalid_projection("provenance identifier is empty");
        }
        if (identifier == episode_identifier) {
            invalid_projection(
                "episode and provenance identifiers are equal");
        }
        if (!source_identifiers.insert(identifier).second) {
            invalid_projection("provenance identifier is duplicated");
        }
        if (record[2].asBoolean()) {
            invalid_projection(
                "provenance snapshot was not Long-Term at derivation");
        }
        decoded.push_back(DecodedSourceEntry{
            .identifier = std::move(identifier),
            .value = std::string{record[1].asString()},
        });
    }
    return decoded;
}

std::vector<DecodedEpisode> decode_episodes(
    const RepresentationProperty& property,
    std::unordered_map<std::string, std::size_t>& episode_positions) {
    if (property.value().kind() != ValueKind::Collection) {
        invalid_projection("episodes is not a collection");
    }

    std::vector<DecodedEpisode> decoded;
    const auto& records = property.value().asCollection();
    decoded.reserve(records.size());
    episode_positions.reserve(records.size());
    bool has_previous_chronology = false;
    std::int64_t previous_chronology{};
    for (const auto& record_value : records) {
        if (record_value.kind() != ValueKind::Collection) {
            invalid_projection("episode record is not a collection");
        }
        const auto& record = record_value.asCollection();
        if (record.size() != 6U ||
            record[0].kind() != ValueKind::String ||
            record[1].kind() != ValueKind::String ||
            record[2].kind() != ValueKind::String ||
            record[3].kind() != ValueKind::Integer) {
            invalid_projection("episode record has an invalid shape");
        }

        DecodedEpisode episode;
        episode.identifier = std::string{record[0].asString()};
        episode.occurrence = std::string{record[1].asString()};
        episode.context = std::string{record[2].asString()};
        episode.chronology = record[3].asInteger();
        if (episode.identifier.empty()) {
            invalid_projection("episode identifier is empty");
        }
        if (episode.occurrence.empty()) {
            invalid_projection("episode occurrence is empty");
        }
        if (episode.context.empty()) {
            invalid_projection("episode context is empty");
        }
        if (episode.chronology < std::int64_t{0}) {
            invalid_projection("episode chronology is negative");
        }
        if (has_previous_chronology &&
            episode.chronology < previous_chronology) {
            invalid_projection("episode chronology is not canonical");
        }
        has_previous_chronology = true;
        previous_chronology = episode.chronology;

        const auto position = decoded.size();
        if (!episode_positions.emplace(episode.identifier, position).second) {
            invalid_projection("episode identifier is duplicated");
        }
        episode.source_entries =
            decode_provenance(record[4], episode.identifier);
        episode.linked_episode_identifiers =
            decode_string_collection(record[5], "episode links");
        if (std::find(episode.linked_episode_identifiers.begin(),
                      episode.linked_episode_identifiers.end(),
                      episode.identifier) !=
            episode.linked_episode_identifiers.end()) {
            invalid_projection("episode contains a self-link");
        }
        decoded.push_back(std::move(episode));
    }
    return decoded;
}

std::vector<std::string> decode_forgotten_identifiers(
    const RepresentationProperty& property,
    const std::unordered_map<std::string, std::size_t>& episode_positions) {
    auto decoded =
        decode_string_collection(property.value(), "forgotten identifiers");
    for (const auto& identifier : decoded) {
        if (episode_positions.contains(identifier)) {
            invalid_projection(
                "identifier is both accessible and Forgotten");
        }
    }
    return decoded;
}

void validate_link_integrity(
    const std::vector<DecodedEpisode>& episodes,
    const std::unordered_map<std::string, std::size_t>& episode_positions) {
    for (const auto& episode : episodes) {
        for (const auto& linked_identifier :
             episode.linked_episode_identifiers) {
            const auto endpoint = episode_positions.find(linked_identifier);
            if (endpoint == episode_positions.end()) {
                invalid_projection("link endpoint is absent");
            }
            const auto& reverse_links =
                episodes[endpoint->second].linked_episode_identifiers;
            if (std::find(reverse_links.begin(),
                          reverse_links.end(),
                          episode.identifier) == reverse_links.end()) {
                invalid_projection("link is not symmetric");
            }
        }
    }
}

} // namespace

std::unique_ptr<RepresentationDocument>
EpisodicMemoryPersistence::project(const EpisodicMemory& memory) {
    std::vector<RepresentationValue> forgotten_identifiers;
    forgotten_identifiers.reserve(memory.forgotten_identifiers_.size());
    for (const auto& identifier : memory.forgotten_identifiers_) {
        forgotten_identifiers.emplace_back(identifier);
    }

    auto workspace = std::make_unique<RepresentationDocument>(
        RepresentationMetadata{"CCA", "CCA-EPMEM-1.0",
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
        std::string{episodes_property},
        RepresentationType{std::string{episode_collection_type}},
        RepresentationValue{encode_episodes(memory)});
    manifest.addProperty(
        std::string{forgotten_property},
        RepresentationType{std::string{identifier_collection_type}},
        RepresentationValue{std::move(forgotten_identifiers)});

    const auto frozen = FreezeService{}.freeze(*workspace);
    if (!frozen.valid) {
        throw std::logic_error{
            "Episodic Memory Workspace Asset projection is invalid"};
    }
    return workspace;
}

EpisodicMemory EpisodicMemoryPersistence::reconstruct(
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

    std::unordered_map<std::string, std::size_t> episode_positions;
    auto decoded_episodes = decode_episodes(
        required_property(
            manifest, episodes_property, episode_collection_type),
        episode_positions);
    auto forgotten_identifiers = decode_forgotten_identifiers(
        required_property(manifest,
                          forgotten_property,
                          identifier_collection_type),
        episode_positions);
    validate_link_integrity(decoded_episodes, episode_positions);

    EpisodicMemory reconstructed{std::move(workspace_identifier_value)};
    reconstructed.episodes_.reserve(decoded_episodes.size());
    for (auto& decoded : decoded_episodes) {
        std::vector<LongTermMemoryEntry> source_entries;
        source_entries.reserve(decoded.source_entries.size());
        for (auto& source : decoded.source_entries) {
            source_entries.emplace_back(std::move(source.identifier),
                                        std::move(source.value));
        }

        Episode episode{std::move(decoded.identifier),
                        std::move(decoded.occurrence),
                        std::move(decoded.context),
                        decoded.chronology,
                        std::move(source_entries)};
        episode.linked_episode_identifiers_ =
            std::move(decoded.linked_episode_identifiers);
        reconstructed.episodes_.push_back(std::move(episode));
    }
    reconstructed.forgotten_identifiers_ =
        std::move(forgotten_identifiers);
    return reconstructed;
}

EpisodicMemory
EpisodicMemoryPersistence::roundTrip(const EpisodicMemory& memory) {
    auto workspace = project(memory);
    cca::persistence::PersistenceEngine engine;
    auto saved = engine.save(
        *workspace,
        cca::persistence::PersistenceMetadata{
            memory.workspaceIdentifier(), "CCA-EPMEM-1.0"});
    if (!saved.succeeded() || saved.package() == nullptr) {
        throw std::logic_error{
            "CCA-PERSIST rejected the Episodic Memory projection"};
    }

    auto loaded = engine.load(*saved.package());
    if (!loaded.succeeded() || loaded.package() == nullptr) {
        throw std::logic_error{
            "CCA-PERSIST failed to load the Episodic Memory projection"};
    }
    return reconstruct(loaded.package()->workspace());
}

} // namespace cca::memory::detail

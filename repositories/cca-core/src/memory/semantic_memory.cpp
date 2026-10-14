#include <cca/memory/semantic_memory.hpp>

#include <algorithm>
#include <stdexcept>
#include <utility>

namespace cca::memory {
namespace {

constexpr auto ok_code = "OK";
constexpr auto workspace_mismatch_code = "WORKSPACE_MISMATCH";
constexpr auto invalid_identifier_code = "INVALID_IDENTIFIER";
constexpr auto invalid_meaning_code = "INVALID_MEANING";
constexpr auto invalid_provenance_code = "INVALID_PROVENANCE";
constexpr auto source_not_long_term_code = "SOURCE_NOT_LONG_TERM";
constexpr auto invalid_concept_state_code = "INVALID_CONCEPT_STATE";
constexpr auto forgotten_identifier_code = "FORGOTTEN_IDENTIFIER";
constexpr auto identifier_conflict_code = "IDENTIFIER_CONFLICT";
constexpr auto source_not_found_code = "SOURCE_NOT_FOUND";
constexpr auto source_mismatch_code = "SOURCE_MISMATCH";
constexpr auto invalid_category_code = "INVALID_CATEGORY";
constexpr auto invalid_relationship_code = "INVALID_RELATIONSHIP";
constexpr auto not_found_code = "NOT_FOUND";

constexpr auto workspace_mismatch_message =
    "Semantic Memory and Long-Term Memory Workspace identifiers do not match";
constexpr auto invalid_identifier_message =
    "Semantic Concept identifier must not be empty";
constexpr auto invalid_meaning_message =
    "Semantic Concept meaning must not be empty";
constexpr auto invalid_provenance_message =
    "Semantic Concept provenance is invalid";
constexpr auto source_not_long_term_message =
    "Semantic Concept source must be in Long-Term state";
constexpr auto invalid_concept_state_message =
    "Semantic Concept proposal must not contain categories or links";
constexpr auto forgotten_identifier_message =
    "Forgotten Semantic Concept identifier cannot be reused";
constexpr auto identifier_conflict_message =
    "Semantic Concept identifier conflicts with an existing concept";
constexpr auto source_not_found_message =
    "Semantic Concept source was not found";
constexpr auto source_mismatch_message =
    "Semantic Concept source value does not match Long-Term Memory";
constexpr auto invalid_category_message =
    "Semantic category must not be empty";
constexpr auto invalid_relationship_message =
    "Semantic Concept relationship endpoints must be distinct";
constexpr auto not_found_message = "Semantic Concept was not found";

const std::string& empty_string() noexcept {
    static const std::string value;
    return value;
}

const std::vector<SemanticConcept>& empty_matches() noexcept {
    static const std::vector<SemanticConcept> value;
    return value;
}

std::vector<SemanticConcept>::iterator find_concept(
    std::vector<SemanticConcept>& concepts,
    const std::string_view identifier) noexcept {
    return std::find_if(
        concepts.begin(), concepts.end(),
        [identifier](const SemanticConcept& candidate) {
            return candidate.identifier() == identifier;
        });
}

std::vector<SemanticConcept>::const_iterator find_concept(
    const std::vector<SemanticConcept>& concepts,
    const std::string_view identifier) noexcept {
    return std::find_if(
        concepts.begin(), concepts.end(),
        [identifier](const SemanticConcept& candidate) {
            return candidate.identifier() == identifier;
        });
}

bool contains_identifier(const std::vector<std::string>& identifiers,
                         const std::string_view identifier) noexcept {
    return std::any_of(
        identifiers.begin(), identifiers.end(),
        [identifier](const std::string& candidate) {
            return candidate == identifier;
        });
}

bool same_provenance(
    const std::vector<LongTermMemoryEntry>& first,
    const std::vector<LongTermMemoryEntry>& second) noexcept {
    if (first.size() != second.size()) {
        return false;
    }
    for (std::size_t index = 0; index < first.size(); ++index) {
        if (first[index].identifier() != second[index].identifier() ||
            first[index].value() != second[index].value() ||
            first[index].archived() != second[index].archived()) {
            return false;
        }
    }
    return true;
}

bool contains_text(const SemanticConcept& semanticConcept,
                   const std::string& text) {
    if (semanticConcept.identifier().find(text) != std::string::npos ||
        semanticConcept.meaning().find(text) != std::string::npos) {
        return true;
    }
    return std::any_of(
        semanticConcept.categories().begin(),
        semanticConcept.categories().end(),
        [&text](const std::string& category) {
            return category.find(text) != std::string::npos;
        });
}

} // namespace

SemanticConcept::SemanticConcept(
    std::string identifier,
    std::string meaning,
    std::vector<LongTermMemoryEntry> sourceEntries)
    : identifier_(std::move(identifier)), meaning_(std::move(meaning)),
      source_entries_(std::move(sourceEntries)) {}

SemanticConcept::~SemanticConcept() = default;
SemanticConcept::SemanticConcept(const SemanticConcept&) = default;

SemanticConcept&
SemanticConcept::operator=(const SemanticConcept& other) {
    if (this != &other) {
        SemanticConcept copy{other};
        identifier_.swap(copy.identifier_);
        meaning_.swap(copy.meaning_);
        source_entries_.swap(copy.source_entries_);
        categories_.swap(copy.categories_);
        linked_concept_identifiers_.swap(
            copy.linked_concept_identifiers_);
    }
    return *this;
}

SemanticConcept::SemanticConcept(SemanticConcept&& other) noexcept
    : identifier_(std::move(other.identifier_)),
      meaning_(std::move(other.meaning_)),
      source_entries_(std::move(other.source_entries_)),
      categories_(std::move(other.categories_)),
      linked_concept_identifiers_(
          std::move(other.linked_concept_identifiers_)) {
    other.identifier_.clear();
    other.meaning_.clear();
    other.source_entries_.clear();
    other.categories_.clear();
    other.linked_concept_identifiers_.clear();
}

SemanticConcept&
SemanticConcept::operator=(SemanticConcept&& other) noexcept {
    if (this != &other) {
        identifier_ = std::move(other.identifier_);
        meaning_ = std::move(other.meaning_);
        source_entries_ = std::move(other.source_entries_);
        categories_ = std::move(other.categories_);
        linked_concept_identifiers_ =
            std::move(other.linked_concept_identifiers_);

        other.identifier_.clear();
        other.meaning_.clear();
        other.source_entries_.clear();
        other.categories_.clear();
        other.linked_concept_identifiers_.clear();
    }
    return *this;
}

const std::string& SemanticConcept::identifier() const noexcept {
    return identifier_;
}

const std::string& SemanticConcept::meaning() const noexcept {
    return meaning_;
}

const std::vector<LongTermMemoryEntry>&
SemanticConcept::sourceEntries() const noexcept {
    return source_entries_;
}

const std::vector<std::string>&
SemanticConcept::categories() const noexcept {
    return categories_;
}

const std::vector<std::string>&
SemanticConcept::linkedConceptIdentifiers() const noexcept {
    return linked_concept_identifiers_;
}

SemanticQuery::SemanticQuery(std::string text) : text_(std::move(text)) {}

const std::string& SemanticQuery::text() const noexcept { return text_; }

SemanticMemory::SemanticMemory(std::string workspaceIdentifier) {
    if (workspaceIdentifier.empty()) {
        throw std::invalid_argument{"Workspace identifier must not be empty"};
    }
    workspace_identifier_ =
        std::make_shared<const std::string>(std::move(workspaceIdentifier));
}

SemanticMemory::~SemanticMemory() = default;
SemanticMemory::SemanticMemory(const SemanticMemory&) = default;

SemanticMemory::SemanticMemory(SemanticMemory&& other) noexcept
    : workspace_identifier_(other.workspace_identifier_),
      concepts_(std::move(other.concepts_)),
      forgotten_identifiers_(std::move(other.forgotten_identifiers_)) {
    other.concepts_.clear();
    other.forgotten_identifiers_.clear();
}

const std::string& SemanticMemory::workspaceIdentifier() const noexcept {
    return workspace_identifier_ != nullptr ? *workspace_identifier_
                                            : empty_string();
}

std::size_t SemanticMemory::size() const noexcept { return concepts_.size(); }

const SemanticConcept*
SemanticMemory::find(const std::string_view identifier) const noexcept {
    const auto found = find_concept(concepts_, identifier);
    return found != concepts_.end() ? std::addressof(*found) : nullptr;
}

const std::vector<SemanticConcept>&
SemanticMemory::concepts() const noexcept {
    return concepts_;
}

class SemanticResult::Impl {
  public:
    Impl(const bool operationSucceeded,
         std::string resultCode,
         std::string resultMessage,
         std::unique_ptr<SemanticConcept> resultConcept,
         std::vector<SemanticConcept> resultMatches)
        : succeeded(operationSucceeded), code(std::move(resultCode)),
          message(std::move(resultMessage)),
          semantic_concept(std::move(resultConcept)),
          matches(std::move(resultMatches)) {}

    bool succeeded{};
    std::string code;
    std::string message;
    std::unique_ptr<SemanticConcept> semantic_concept;
    std::vector<SemanticConcept> matches;
};

SemanticResult::SemanticResult(
    const bool succeeded,
    std::string code,
    std::string message,
    std::unique_ptr<SemanticConcept> semanticConcept,
    std::vector<SemanticConcept> matches)
    : impl_(std::make_unique<Impl>(succeeded, std::move(code),
                                   std::move(message),
                                   std::move(semanticConcept),
                                   std::move(matches))) {}

SemanticResult::SemanticResult(SemanticResult&&) noexcept = default;
SemanticResult&
SemanticResult::operator=(SemanticResult&&) noexcept = default;
SemanticResult::~SemanticResult() = default;

bool SemanticResult::succeeded() const noexcept {
    return impl_ != nullptr && impl_->succeeded;
}

const std::string& SemanticResult::code() const noexcept {
    return impl_ != nullptr ? impl_->code : empty_string();
}

const std::string& SemanticResult::message() const noexcept {
    return impl_ != nullptr ? impl_->message : empty_string();
}

const SemanticConcept* SemanticResult::semanticConcept() const noexcept {
    return impl_ != nullptr ? impl_->semantic_concept.get() : nullptr;
}

const std::vector<SemanticConcept>& SemanticResult::matches() const noexcept {
    return impl_ != nullptr ? impl_->matches : empty_matches();
}

SemanticResult SemanticMemoryEngine::classify(
    SemanticMemory& memory,
    const LongTermMemory& evidence,
    SemanticConcept semanticConcept) const {
    if (memory.workspaceIdentifier() != evidence.workspaceIdentifier()) {
        return SemanticResult{false, workspace_mismatch_code,
                              workspace_mismatch_message, nullptr, {}};
    }
    if (semanticConcept.identifier().empty()) {
        return SemanticResult{false, invalid_identifier_code,
                              invalid_identifier_message, nullptr, {}};
    }
    if (semanticConcept.meaning().empty()) {
        return SemanticResult{false, invalid_meaning_code,
                              invalid_meaning_message, nullptr, {}};
    }
    if (semanticConcept.sourceEntries().empty()) {
        return SemanticResult{false, invalid_provenance_code,
                              invalid_provenance_message, nullptr, {}};
    }

    const auto& sourceEntries = semanticConcept.sourceEntries();
    for (std::size_t index = 0; index < sourceEntries.size(); ++index) {
        const auto& snapshot = sourceEntries[index];
        if (snapshot.identifier().empty()) {
            return SemanticResult{false, invalid_provenance_code,
                                  invalid_provenance_message, nullptr, {}};
        }
        const auto duplicate = std::find_if(
            sourceEntries.begin(), sourceEntries.begin() +
                                       static_cast<std::ptrdiff_t>(index),
            [&snapshot](const LongTermMemoryEntry& candidate) {
                return candidate.identifier() == snapshot.identifier();
            });
        if (duplicate != sourceEntries.begin() +
                             static_cast<std::ptrdiff_t>(index) ||
            snapshot.identifier() == semanticConcept.identifier()) {
            return SemanticResult{false, invalid_provenance_code,
                                  invalid_provenance_message, nullptr, {}};
        }
        if (snapshot.archived()) {
            return SemanticResult{false, source_not_long_term_code,
                                  source_not_long_term_message, nullptr, {}};
        }
    }

    if (!semanticConcept.categories().empty() ||
        !semanticConcept.linkedConceptIdentifiers().empty()) {
        return SemanticResult{false, invalid_concept_state_code,
                              invalid_concept_state_message, nullptr, {}};
    }
    if (contains_identifier(memory.forgotten_identifiers_,
                            semanticConcept.identifier())) {
        return SemanticResult{false, forgotten_identifier_code,
                              forgotten_identifier_message, nullptr, {}};
    }

    const auto existing =
        find_concept(memory.concepts_, semanticConcept.identifier());
    if (existing != memory.concepts_.end()) {
        if (existing->meaning() == semanticConcept.meaning() &&
            same_provenance(existing->sourceEntries(),
                            semanticConcept.sourceEntries())) {
            return SemanticResult{
                true, ok_code, {},
                std::make_unique<SemanticConcept>(*existing), {}};
        }
        return SemanticResult{false, identifier_conflict_code,
                              identifier_conflict_message, nullptr, {}};
    }

    for (const auto& snapshot : sourceEntries) {
        const auto* const source = evidence.find(snapshot.identifier());
        if (source == nullptr) {
            return SemanticResult{false, source_not_found_code,
                                  source_not_found_message, nullptr, {}};
        }
        if (source->archived()) {
            return SemanticResult{false, source_not_long_term_code,
                                  source_not_long_term_message, nullptr, {}};
        }
        if (source->value() != snapshot.value()) {
            return SemanticResult{false, source_mismatch_code,
                                  source_mismatch_message, nullptr, {}};
        }
    }

    auto stagedConcepts = memory.concepts_;
    stagedConcepts.push_back(std::move(semanticConcept));
    auto success = SemanticResult{
        true, ok_code, {},
        std::make_unique<SemanticConcept>(stagedConcepts.back()), {}};
    memory.concepts_.swap(stagedConcepts);
    return success;
}

SemanticResult SemanticMemoryEngine::categorize(
    SemanticMemory& memory,
    const std::string_view conceptIdentifier,
    std::string category) const {
    if (conceptIdentifier.empty()) {
        return SemanticResult{false, invalid_identifier_code,
                              invalid_identifier_message, nullptr, {}};
    }
    if (category.empty()) {
        return SemanticResult{false, invalid_category_code,
                              invalid_category_message, nullptr, {}};
    }

    const auto found = find_concept(memory.concepts_, conceptIdentifier);
    if (found == memory.concepts_.end()) {
        return SemanticResult{false, not_found_code, not_found_message,
                              nullptr, {}};
    }
    if (contains_identifier(found->categories(), category)) {
        return SemanticResult{
            true, ok_code, {}, std::make_unique<SemanticConcept>(*found), {}};
    }

    const auto index = static_cast<std::size_t>(
        std::distance(memory.concepts_.begin(), found));
    auto stagedConcepts = memory.concepts_;
    stagedConcepts[index].categories_.push_back(std::move(category));
    auto success = SemanticResult{
        true, ok_code, {},
        std::make_unique<SemanticConcept>(stagedConcepts[index]), {}};
    memory.concepts_.swap(stagedConcepts);
    return success;
}

SemanticResult SemanticMemoryEngine::link(
    SemanticMemory& memory,
    const std::string_view firstConceptIdentifier,
    const std::string_view secondConceptIdentifier) const {
    if (firstConceptIdentifier.empty()) {
        return SemanticResult{false, invalid_identifier_code,
                              invalid_identifier_message, nullptr, {}};
    }
    if (secondConceptIdentifier.empty()) {
        return SemanticResult{false, invalid_identifier_code,
                              invalid_identifier_message, nullptr, {}};
    }
    if (firstConceptIdentifier == secondConceptIdentifier) {
        return SemanticResult{false, invalid_relationship_code,
                              invalid_relationship_message, nullptr, {}};
    }

    const auto first =
        find_concept(memory.concepts_, firstConceptIdentifier);
    if (first == memory.concepts_.end()) {
        return SemanticResult{false, not_found_code, not_found_message,
                              nullptr, {}};
    }
    const auto second =
        find_concept(memory.concepts_, secondConceptIdentifier);
    if (second == memory.concepts_.end()) {
        return SemanticResult{false, not_found_code, not_found_message,
                              nullptr, {}};
    }

    const bool firstHasLink = contains_identifier(
        first->linkedConceptIdentifiers(), secondConceptIdentifier);
    const bool secondHasLink = contains_identifier(
        second->linkedConceptIdentifiers(), firstConceptIdentifier);
    if (firstHasLink != secondHasLink) {
        throw std::logic_error{"Semantic Memory link invariant violated"};
    }
    if (firstHasLink) {
        std::vector<SemanticConcept> matches;
        matches.reserve(2U);
        matches.push_back(*first);
        matches.push_back(*second);
        return SemanticResult{true, ok_code, {}, nullptr,
                              std::move(matches)};
    }

    const auto firstIndex = static_cast<std::size_t>(
        std::distance(memory.concepts_.begin(), first));
    const auto secondIndex = static_cast<std::size_t>(
        std::distance(memory.concepts_.begin(), second));
    auto stagedConcepts = memory.concepts_;
    stagedConcepts[firstIndex].linked_concept_identifiers_.emplace_back(
        secondConceptIdentifier);
    stagedConcepts[secondIndex].linked_concept_identifiers_.emplace_back(
        firstConceptIdentifier);

    std::vector<SemanticConcept> matches;
    matches.reserve(2U);
    matches.push_back(stagedConcepts[firstIndex]);
    matches.push_back(stagedConcepts[secondIndex]);
    auto success = SemanticResult{true, ok_code, {}, nullptr,
                                  std::move(matches)};
    memory.concepts_.swap(stagedConcepts);
    return success;
}

SemanticResult SemanticMemoryEngine::retrieve(
    const SemanticMemory& memory,
    const std::string_view identifier) const {
    if (identifier.empty()) {
        return SemanticResult{false, invalid_identifier_code,
                              invalid_identifier_message, nullptr, {}};
    }
    const auto* const found = memory.find(identifier);
    if (found == nullptr) {
        return SemanticResult{false, not_found_code, not_found_message,
                              nullptr, {}};
    }
    return SemanticResult{
        true, ok_code, {}, std::make_unique<SemanticConcept>(*found), {}};
}

SemanticResult SemanticMemoryEngine::search(
    const SemanticMemory& memory,
    const SemanticQuery& query) const {
    std::vector<SemanticConcept> matches;
    matches.reserve(memory.concepts_.size());
    for (const auto& semanticConcept : memory.concepts_) {
        if (contains_text(semanticConcept, query.text())) {
            matches.push_back(semanticConcept);
        }
    }
    return SemanticResult{true, ok_code, {}, nullptr, std::move(matches)};
}

SemanticResult SemanticMemoryEngine::update(
    SemanticMemory& memory,
    const std::string_view identifier,
    std::string meaning) const {
    if (identifier.empty()) {
        return SemanticResult{false, invalid_identifier_code,
                              invalid_identifier_message, nullptr, {}};
    }
    if (meaning.empty()) {
        return SemanticResult{false, invalid_meaning_code,
                              invalid_meaning_message, nullptr, {}};
    }

    const auto found = find_concept(memory.concepts_, identifier);
    if (found == memory.concepts_.end()) {
        return SemanticResult{false, not_found_code, not_found_message,
                              nullptr, {}};
    }
    if (found->meaning() == meaning) {
        return SemanticResult{
            true, ok_code, {}, std::make_unique<SemanticConcept>(*found), {}};
    }

    const auto index = static_cast<std::size_t>(
        std::distance(memory.concepts_.begin(), found));
    auto stagedConcepts = memory.concepts_;
    stagedConcepts[index].meaning_ = std::move(meaning);
    auto success = SemanticResult{
        true, ok_code, {},
        std::make_unique<SemanticConcept>(stagedConcepts[index]), {}};
    memory.concepts_.swap(stagedConcepts);
    return success;
}

SemanticResult SemanticMemoryEngine::forget(
    SemanticMemory& memory,
    const std::string_view identifier) const {
    if (identifier.empty()) {
        return SemanticResult{false, invalid_identifier_code,
                              invalid_identifier_message, nullptr, {}};
    }

    const auto found = find_concept(memory.concepts_, identifier);
    if (found == memory.concepts_.end()) {
        return SemanticResult{true, ok_code, {}, nullptr, {}};
    }

    auto stagedConcepts = memory.concepts_;
    auto stagedForgottenIdentifiers = memory.forgotten_identifiers_;
    stagedForgottenIdentifiers.push_back(found->identifier());

    const auto stagedFound = find_concept(stagedConcepts, identifier);
    stagedConcepts.erase(stagedFound);
    for (auto& survivor : stagedConcepts) {
        std::erase(survivor.linked_concept_identifiers_, identifier);
    }

    auto success = SemanticResult{true, ok_code, {}, nullptr, {}};
    memory.concepts_.swap(stagedConcepts);
    memory.forgotten_identifiers_.swap(stagedForgottenIdentifiers);
    return success;
}

} // namespace cca::memory

#include <cca/memory/procedural_memory.hpp>

#include <algorithm>
#include <stdexcept>
#include <utility>

namespace cca::memory {
namespace {

constexpr auto ok_code = "OK";
constexpr auto workspace_mismatch_code = "WORKSPACE_MISMATCH";
constexpr auto invalid_identifier_code = "INVALID_IDENTIFIER";
constexpr auto invalid_activity_code = "INVALID_ACTIVITY";
constexpr auto invalid_steps_code = "INVALID_STEPS";
constexpr auto invalid_source_cardinality_code =
    "INVALID_SOURCE_CARDINALITY";
constexpr auto invalid_provenance_code = "INVALID_PROVENANCE";
constexpr auto source_not_long_term_code = "SOURCE_NOT_LONG_TERM";
constexpr auto invalid_procedure_state_code = "INVALID_PROCEDURE_STATE";
constexpr auto forgotten_identifier_code = "FORGOTTEN_IDENTIFIER";
constexpr auto identifier_conflict_code = "IDENTIFIER_CONFLICT";
constexpr auto source_not_found_code = "SOURCE_NOT_FOUND";
constexpr auto source_mismatch_code = "SOURCE_MISMATCH";
constexpr auto invalid_relationship_code = "INVALID_RELATIONSHIP";
constexpr auto not_found_code = "NOT_FOUND";

constexpr auto workspace_mismatch_message =
    "Procedural Memory and Long-Term Memory Workspace identifiers do not match";
constexpr auto invalid_identifier_message =
    "Procedure identifier must not be empty";
constexpr auto invalid_activity_message =
    "Procedure activity must not be empty";
constexpr auto invalid_steps_message =
    "Procedure steps must not be empty or contain an empty step";
constexpr auto invalid_source_cardinality_message =
    "Procedure source cardinality is invalid for this operation";
constexpr auto invalid_provenance_message =
    "Procedure provenance is invalid";
constexpr auto source_not_long_term_message =
    "Procedure source must be in Long-Term state";
constexpr auto invalid_procedure_state_message =
    "Procedure proposal must not contain links";
constexpr auto forgotten_identifier_message =
    "Forgotten Procedure identifier cannot be reused";
constexpr auto identifier_conflict_message =
    "Procedure identifier conflicts with an existing Procedure";
constexpr auto source_not_found_message = "Procedure source was not found";
constexpr auto source_mismatch_message =
    "Procedure source value does not match Long-Term Memory";
constexpr auto invalid_relationship_message =
    "Procedure relationship endpoints must be distinct";
constexpr auto not_found_message = "Procedure was not found";

const std::string& empty_string() noexcept {
    static const std::string value;
    return value;
}

const std::vector<Procedure>& empty_matches() noexcept {
    static const std::vector<Procedure> value;
    return value;
}

std::vector<Procedure>::iterator find_procedure(
    std::vector<Procedure>& procedures,
    const std::string_view identifier) noexcept {
    return std::find_if(
        procedures.begin(), procedures.end(),
        [identifier](const Procedure& candidate) {
            return candidate.identifier() == identifier;
        });
}

std::vector<Procedure>::const_iterator find_procedure(
    const std::vector<Procedure>& procedures,
    const std::string_view identifier) noexcept {
    return std::find_if(
        procedures.begin(), procedures.end(),
        [identifier](const Procedure& candidate) {
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

bool same_strings(const std::vector<std::string>& first,
                  const std::vector<std::string>& second) noexcept {
    if (first.size() != second.size()) {
        return false;
    }
    for (std::size_t index = 0; index < first.size(); ++index) {
        if (first[index] != second[index]) {
            return false;
        }
    }
    return true;
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

bool same_procedure(const Procedure& first, const Procedure& second) noexcept {
    return first.identifier() == second.identifier() &&
           first.activity() == second.activity() &&
           same_strings(first.steps(), second.steps()) &&
           same_provenance(first.sourceEntries(), second.sourceEntries());
}

bool has_invalid_steps(const std::vector<std::string>& steps) noexcept {
    return steps.empty() ||
           std::any_of(steps.begin(), steps.end(),
                       [](const std::string& step) { return step.empty(); });
}

bool contains_text(const Procedure& procedure, const std::string& text) {
    if (procedure.identifier().find(text) != std::string::npos ||
        procedure.activity().find(text) != std::string::npos) {
        return true;
    }
    return std::any_of(
        procedure.steps().begin(), procedure.steps().end(),
        [&text](const std::string& step) {
            return step.find(text) != std::string::npos;
        });
}

} // namespace

Procedure::Procedure(
    std::string identifier,
    std::string activity,
    std::vector<std::string> steps,
    std::vector<LongTermMemoryEntry> sourceEntries)
    : identifier_(std::move(identifier)), activity_(std::move(activity)),
      steps_(std::move(steps)), source_entries_(std::move(sourceEntries)) {}

Procedure::~Procedure() = default;
Procedure::Procedure(const Procedure&) = default;

Procedure& Procedure::operator=(const Procedure& other) {
    if (this != &other) {
        Procedure copy{other};
        identifier_.swap(copy.identifier_);
        activity_.swap(copy.activity_);
        steps_.swap(copy.steps_);
        source_entries_.swap(copy.source_entries_);
        linked_procedure_identifiers_.swap(
            copy.linked_procedure_identifiers_);
    }
    return *this;
}

Procedure::Procedure(Procedure&& other) noexcept
    : identifier_(std::move(other.identifier_)),
      activity_(std::move(other.activity_)), steps_(std::move(other.steps_)),
      source_entries_(std::move(other.source_entries_)),
      linked_procedure_identifiers_(
          std::move(other.linked_procedure_identifiers_)) {
    other.identifier_.clear();
    other.activity_.clear();
    other.steps_.clear();
    other.source_entries_.clear();
    other.linked_procedure_identifiers_.clear();
}

Procedure& Procedure::operator=(Procedure&& other) noexcept {
    if (this != &other) {
        identifier_ = std::move(other.identifier_);
        activity_ = std::move(other.activity_);
        steps_ = std::move(other.steps_);
        source_entries_ = std::move(other.source_entries_);
        linked_procedure_identifiers_ =
            std::move(other.linked_procedure_identifiers_);

        other.identifier_.clear();
        other.activity_.clear();
        other.steps_.clear();
        other.source_entries_.clear();
        other.linked_procedure_identifiers_.clear();
    }
    return *this;
}

const std::string& Procedure::identifier() const noexcept {
    return identifier_;
}

const std::string& Procedure::activity() const noexcept { return activity_; }

const std::vector<std::string>& Procedure::steps() const noexcept {
    return steps_;
}

const std::vector<LongTermMemoryEntry>&
Procedure::sourceEntries() const noexcept {
    return source_entries_;
}

const std::vector<std::string>&
Procedure::linkedProcedureIdentifiers() const noexcept {
    return linked_procedure_identifiers_;
}

ProcedureQuery::ProcedureQuery(std::string text) : text_(std::move(text)) {}

const std::string& ProcedureQuery::text() const noexcept { return text_; }

ProceduralMemory::ProceduralMemory(std::string workspaceIdentifier) {
    if (workspaceIdentifier.empty()) {
        throw std::invalid_argument{"Workspace identifier must not be empty"};
    }
    workspace_identifier_ =
        std::make_shared<const std::string>(std::move(workspaceIdentifier));
}

ProceduralMemory::~ProceduralMemory() = default;
ProceduralMemory::ProceduralMemory(const ProceduralMemory&) = default;

ProceduralMemory::ProceduralMemory(ProceduralMemory&& other) noexcept
    : workspace_identifier_(other.workspace_identifier_),
      procedures_(std::move(other.procedures_)),
      forgotten_identifiers_(std::move(other.forgotten_identifiers_)) {
    other.procedures_.clear();
    other.forgotten_identifiers_.clear();
}

const std::string& ProceduralMemory::workspaceIdentifier() const noexcept {
    return workspace_identifier_ != nullptr ? *workspace_identifier_
                                            : empty_string();
}

std::size_t ProceduralMemory::size() const noexcept {
    return procedures_.size();
}

const Procedure*
ProceduralMemory::find(const std::string_view identifier) const noexcept {
    const auto found = find_procedure(procedures_, identifier);
    return found != procedures_.end() ? std::addressof(*found) : nullptr;
}

const std::vector<Procedure>& ProceduralMemory::procedures() const noexcept {
    return procedures_;
}

class ProcedureResult::Impl {
  public:
    Impl(const bool operationSucceeded,
         std::string resultCode,
         std::string resultMessage,
         std::unique_ptr<Procedure> resultProcedure,
         std::vector<Procedure> resultMatches)
        : succeeded(operationSucceeded), code(std::move(resultCode)),
          message(std::move(resultMessage)),
          procedure(std::move(resultProcedure)),
          matches(std::move(resultMatches)) {}

    bool succeeded{};
    std::string code;
    std::string message;
    std::unique_ptr<Procedure> procedure;
    std::vector<Procedure> matches;
};

ProcedureResult::ProcedureResult(
    const bool succeeded,
    std::string code,
    std::string message,
    std::unique_ptr<Procedure> procedure,
    std::vector<Procedure> matches)
    : impl_(std::make_unique<Impl>(succeeded, std::move(code),
                                   std::move(message), std::move(procedure),
                                   std::move(matches))) {}

ProcedureResult::ProcedureResult(ProcedureResult&&) noexcept = default;
ProcedureResult& ProcedureResult::operator=(ProcedureResult&&) noexcept =
    default;
ProcedureResult::~ProcedureResult() = default;

bool ProcedureResult::succeeded() const noexcept {
    return impl_ != nullptr && impl_->succeeded;
}

const std::string& ProcedureResult::code() const noexcept {
    return impl_ != nullptr ? impl_->code : empty_string();
}

const std::string& ProcedureResult::message() const noexcept {
    return impl_ != nullptr ? impl_->message : empty_string();
}

const Procedure* ProcedureResult::procedure() const noexcept {
    return impl_ != nullptr ? impl_->procedure.get() : nullptr;
}

const std::vector<Procedure>& ProcedureResult::matches() const noexcept {
    return impl_ != nullptr ? impl_->matches : empty_matches();
}

ProcedureResult ProceduralMemoryEngine::derive(
    ProceduralMemory& memory,
    const LongTermMemory& evidence,
    Procedure procedure) const {
    if (memory.workspaceIdentifier() != evidence.workspaceIdentifier()) {
        return ProcedureResult{false, workspace_mismatch_code,
                               workspace_mismatch_message, nullptr, {}};
    }
    if (procedure.identifier().empty()) {
        return ProcedureResult{false, invalid_identifier_code,
                               invalid_identifier_message, nullptr, {}};
    }
    if (procedure.activity().empty()) {
        return ProcedureResult{false, invalid_activity_code,
                               invalid_activity_message, nullptr, {}};
    }
    if (has_invalid_steps(procedure.steps())) {
        return ProcedureResult{false, invalid_steps_code,
                               invalid_steps_message, nullptr, {}};
    }

    const auto& sourceEntries = procedure.sourceEntries();
    if (sourceEntries.size() != 1U) {
        return ProcedureResult{false, invalid_source_cardinality_code,
                               invalid_source_cardinality_message, nullptr,
                               {}};
    }
    for (std::size_t index = 0; index < sourceEntries.size(); ++index) {
        const auto& snapshot = sourceEntries[index];
        if (snapshot.identifier().empty()) {
            return ProcedureResult{false, invalid_provenance_code,
                                   invalid_provenance_message, nullptr, {}};
        }
        const auto duplicate = std::find_if(
            sourceEntries.begin(),
            sourceEntries.begin() + static_cast<std::ptrdiff_t>(index),
            [&snapshot](const LongTermMemoryEntry& candidate) {
                return candidate.identifier() == snapshot.identifier();
            });
        if (duplicate != sourceEntries.begin() +
                             static_cast<std::ptrdiff_t>(index) ||
            snapshot.identifier() == procedure.identifier()) {
            return ProcedureResult{false, invalid_provenance_code,
                                   invalid_provenance_message, nullptr, {}};
        }
        if (snapshot.archived()) {
            return ProcedureResult{false, source_not_long_term_code,
                                   source_not_long_term_message, nullptr, {}};
        }
    }

    if (!procedure.linkedProcedureIdentifiers().empty()) {
        return ProcedureResult{false, invalid_procedure_state_code,
                               invalid_procedure_state_message, nullptr, {}};
    }
    if (contains_identifier(memory.forgotten_identifiers_,
                            procedure.identifier())) {
        return ProcedureResult{false, forgotten_identifier_code,
                               forgotten_identifier_message, nullptr, {}};
    }

    const auto existing =
        find_procedure(memory.procedures_, procedure.identifier());
    if (existing != memory.procedures_.end()) {
        if (same_procedure(*existing, procedure)) {
            return ProcedureResult{
                true, ok_code, {}, std::make_unique<Procedure>(*existing), {}};
        }
        return ProcedureResult{false, identifier_conflict_code,
                               identifier_conflict_message, nullptr, {}};
    }

    for (const auto& snapshot : sourceEntries) {
        const auto* const source = evidence.find(snapshot.identifier());
        if (source == nullptr) {
            return ProcedureResult{false, source_not_found_code,
                                   source_not_found_message, nullptr, {}};
        }
        if (source->archived()) {
            return ProcedureResult{false, source_not_long_term_code,
                                   source_not_long_term_message, nullptr, {}};
        }
        if (source->value() != snapshot.value()) {
            return ProcedureResult{false, source_mismatch_code,
                                   source_mismatch_message, nullptr, {}};
        }
    }

    auto stagedProcedures = memory.procedures_;
    stagedProcedures.push_back(std::move(procedure));
    auto success = ProcedureResult{
        true, ok_code, {},
        std::make_unique<Procedure>(stagedProcedures.back()), {}};
    memory.procedures_.swap(stagedProcedures);
    return success;
}

ProcedureResult ProceduralMemoryEngine::compose(
    ProceduralMemory& memory,
    const LongTermMemory& evidence,
    Procedure procedure) const {
    if (memory.workspaceIdentifier() != evidence.workspaceIdentifier()) {
        return ProcedureResult{false, workspace_mismatch_code,
                               workspace_mismatch_message, nullptr, {}};
    }
    if (procedure.identifier().empty()) {
        return ProcedureResult{false, invalid_identifier_code,
                               invalid_identifier_message, nullptr, {}};
    }
    if (procedure.activity().empty()) {
        return ProcedureResult{false, invalid_activity_code,
                               invalid_activity_message, nullptr, {}};
    }
    if (has_invalid_steps(procedure.steps())) {
        return ProcedureResult{false, invalid_steps_code,
                               invalid_steps_message, nullptr, {}};
    }

    const auto& sourceEntries = procedure.sourceEntries();
    if (sourceEntries.size() < 2U) {
        return ProcedureResult{false, invalid_source_cardinality_code,
                               invalid_source_cardinality_message, nullptr,
                               {}};
    }
    for (std::size_t index = 0; index < sourceEntries.size(); ++index) {
        const auto& snapshot = sourceEntries[index];
        if (snapshot.identifier().empty()) {
            return ProcedureResult{false, invalid_provenance_code,
                                   invalid_provenance_message, nullptr, {}};
        }
        const auto duplicate = std::find_if(
            sourceEntries.begin(),
            sourceEntries.begin() + static_cast<std::ptrdiff_t>(index),
            [&snapshot](const LongTermMemoryEntry& candidate) {
                return candidate.identifier() == snapshot.identifier();
            });
        if (duplicate != sourceEntries.begin() +
                             static_cast<std::ptrdiff_t>(index) ||
            snapshot.identifier() == procedure.identifier()) {
            return ProcedureResult{false, invalid_provenance_code,
                                   invalid_provenance_message, nullptr, {}};
        }
        if (snapshot.archived()) {
            return ProcedureResult{false, source_not_long_term_code,
                                   source_not_long_term_message, nullptr, {}};
        }
    }

    if (!procedure.linkedProcedureIdentifiers().empty()) {
        return ProcedureResult{false, invalid_procedure_state_code,
                               invalid_procedure_state_message, nullptr, {}};
    }
    if (contains_identifier(memory.forgotten_identifiers_,
                            procedure.identifier())) {
        return ProcedureResult{false, forgotten_identifier_code,
                               forgotten_identifier_message, nullptr, {}};
    }

    const auto existing =
        find_procedure(memory.procedures_, procedure.identifier());
    if (existing != memory.procedures_.end()) {
        if (same_procedure(*existing, procedure)) {
            return ProcedureResult{
                true, ok_code, {}, std::make_unique<Procedure>(*existing), {}};
        }
        return ProcedureResult{false, identifier_conflict_code,
                               identifier_conflict_message, nullptr, {}};
    }

    for (const auto& snapshot : sourceEntries) {
        const auto* const source = evidence.find(snapshot.identifier());
        if (source == nullptr) {
            return ProcedureResult{false, source_not_found_code,
                                   source_not_found_message, nullptr, {}};
        }
        if (source->archived()) {
            return ProcedureResult{false, source_not_long_term_code,
                                   source_not_long_term_message, nullptr, {}};
        }
        if (source->value() != snapshot.value()) {
            return ProcedureResult{false, source_mismatch_code,
                                   source_mismatch_message, nullptr, {}};
        }
    }

    auto stagedProcedures = memory.procedures_;
    stagedProcedures.push_back(std::move(procedure));
    auto success = ProcedureResult{
        true, ok_code, {},
        std::make_unique<Procedure>(stagedProcedures.back()), {}};
    memory.procedures_.swap(stagedProcedures);
    return success;
}

ProcedureResult ProceduralMemoryEngine::retrieve(
    const ProceduralMemory& memory,
    const std::string_view identifier) const {
    if (identifier.empty()) {
        return ProcedureResult{false, invalid_identifier_code,
                               invalid_identifier_message, nullptr, {}};
    }
    const auto* const found = memory.find(identifier);
    if (found == nullptr) {
        return ProcedureResult{false, not_found_code, not_found_message,
                               nullptr, {}};
    }
    return ProcedureResult{
        true, ok_code, {}, std::make_unique<Procedure>(*found), {}};
}

ProcedureResult ProceduralMemoryEngine::search(
    const ProceduralMemory& memory,
    const ProcedureQuery& query) const {
    std::vector<Procedure> matches;
    matches.reserve(memory.procedures_.size());
    for (const auto& procedure : memory.procedures_) {
        if (contains_text(procedure, query.text())) {
            matches.push_back(procedure);
        }
    }
    return ProcedureResult{true, ok_code, {}, nullptr, std::move(matches)};
}

ProcedureResult ProceduralMemoryEngine::link(
    ProceduralMemory& memory,
    const std::string_view firstProcedureIdentifier,
    const std::string_view secondProcedureIdentifier) const {
    if (firstProcedureIdentifier.empty()) {
        return ProcedureResult{false, invalid_identifier_code,
                               invalid_identifier_message, nullptr, {}};
    }
    if (secondProcedureIdentifier.empty()) {
        return ProcedureResult{false, invalid_identifier_code,
                               invalid_identifier_message, nullptr, {}};
    }
    if (firstProcedureIdentifier == secondProcedureIdentifier) {
        return ProcedureResult{false, invalid_relationship_code,
                               invalid_relationship_message, nullptr, {}};
    }

    const auto first =
        find_procedure(memory.procedures_, firstProcedureIdentifier);
    if (first == memory.procedures_.end()) {
        return ProcedureResult{false, not_found_code, not_found_message,
                               nullptr, {}};
    }
    const auto second =
        find_procedure(memory.procedures_, secondProcedureIdentifier);
    if (second == memory.procedures_.end()) {
        return ProcedureResult{false, not_found_code, not_found_message,
                               nullptr, {}};
    }

    const bool firstHasLink = contains_identifier(
        first->linkedProcedureIdentifiers(), secondProcedureIdentifier);
    const bool secondHasLink = contains_identifier(
        second->linkedProcedureIdentifiers(), firstProcedureIdentifier);
    if (firstHasLink != secondHasLink) {
        throw std::logic_error{"Procedural Memory link invariant violated"};
    }
    if (firstHasLink) {
        std::vector<Procedure> matches;
        matches.reserve(2U);
        matches.push_back(*first);
        matches.push_back(*second);
        return ProcedureResult{true, ok_code, {}, nullptr,
                               std::move(matches)};
    }

    const auto firstIndex = static_cast<std::size_t>(
        std::distance(memory.procedures_.begin(), first));
    const auto secondIndex = static_cast<std::size_t>(
        std::distance(memory.procedures_.begin(), second));
    auto stagedProcedures = memory.procedures_;
    stagedProcedures[firstIndex].linked_procedure_identifiers_.emplace_back(
        secondProcedureIdentifier);
    stagedProcedures[secondIndex].linked_procedure_identifiers_.emplace_back(
        firstProcedureIdentifier);

    std::vector<Procedure> matches;
    matches.reserve(2U);
    matches.push_back(stagedProcedures[firstIndex]);
    matches.push_back(stagedProcedures[secondIndex]);
    auto success =
        ProcedureResult{true, ok_code, {}, nullptr, std::move(matches)};
    memory.procedures_.swap(stagedProcedures);
    return success;
}

ProcedureResult ProceduralMemoryEngine::update(
    ProceduralMemory& memory,
    const std::string_view identifier,
    std::string activity,
    std::vector<std::string> steps) const {
    if (identifier.empty()) {
        return ProcedureResult{false, invalid_identifier_code,
                               invalid_identifier_message, nullptr, {}};
    }
    if (activity.empty()) {
        return ProcedureResult{false, invalid_activity_code,
                               invalid_activity_message, nullptr, {}};
    }
    if (has_invalid_steps(steps)) {
        return ProcedureResult{false, invalid_steps_code,
                               invalid_steps_message, nullptr, {}};
    }

    const auto found = find_procedure(memory.procedures_, identifier);
    if (found == memory.procedures_.end()) {
        return ProcedureResult{false, not_found_code, not_found_message,
                               nullptr, {}};
    }
    if (found->activity() == activity &&
        same_strings(found->steps(), steps)) {
        return ProcedureResult{
            true, ok_code, {}, std::make_unique<Procedure>(*found), {}};
    }

    const auto index = static_cast<std::size_t>(
        std::distance(memory.procedures_.begin(), found));
    auto stagedProcedures = memory.procedures_;
    stagedProcedures[index].activity_ = std::move(activity);
    stagedProcedures[index].steps_ = std::move(steps);
    auto success = ProcedureResult{
        true, ok_code, {},
        std::make_unique<Procedure>(stagedProcedures[index]), {}};
    memory.procedures_.swap(stagedProcedures);
    return success;
}

ProcedureResult ProceduralMemoryEngine::forget(
    ProceduralMemory& memory,
    const std::string_view identifier) const {
    if (identifier.empty()) {
        return ProcedureResult{false, invalid_identifier_code,
                               invalid_identifier_message, nullptr, {}};
    }

    const auto found = find_procedure(memory.procedures_, identifier);
    if (found == memory.procedures_.end()) {
        return ProcedureResult{true, ok_code, {}, nullptr, {}};
    }

    auto stagedProcedures = memory.procedures_;
    auto stagedForgottenIdentifiers = memory.forgotten_identifiers_;
    stagedForgottenIdentifiers.push_back(found->identifier());

    const auto stagedFound = find_procedure(stagedProcedures, identifier);
    stagedProcedures.erase(stagedFound);
    for (auto& survivor : stagedProcedures) {
        std::erase(survivor.linked_procedure_identifiers_, identifier);
    }

    auto success = ProcedureResult{true, ok_code, {}, nullptr, {}};
    memory.procedures_.swap(stagedProcedures);
    memory.forgotten_identifiers_.swap(stagedForgottenIdentifiers);
    return success;
}

} // namespace cca::memory

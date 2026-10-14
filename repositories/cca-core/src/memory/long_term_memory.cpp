#include <cca/memory/long_term_memory.hpp>

#include <algorithm>
#include <stdexcept>
#include <type_traits>
#include <utility>

namespace cca::memory {
namespace {

constexpr auto ok_code = "OK";
constexpr auto invalid_identifier_code = "INVALID_IDENTIFIER";
constexpr auto not_found_code = "NOT_FOUND";
constexpr auto identifier_conflict_code = "IDENTIFIER_CONFLICT";
constexpr auto archived_code = "ARCHIVED";
constexpr auto forgotten_identifier_code = "FORGOTTEN_IDENTIFIER";
constexpr auto workspace_mismatch_code = "WORKSPACE_MISMATCH";
constexpr auto restore_target_not_pristine_code =
    "RESTORE_TARGET_NOT_PRISTINE";

constexpr auto invalid_identifier_message =
    "Long-Term Memory entry identifier must not be empty";
constexpr auto not_found_message = "Long-Term Memory entry was not found";
constexpr auto identifier_conflict_message =
    "Long-Term Memory identifier conflicts with a retained value";
constexpr auto archived_message =
    "Archived Long-Term Memory entries cannot be accepted or changed";
constexpr auto forgotten_identifier_message =
    "Forgotten Long-Term Memory identifier cannot be reused";
constexpr auto workspace_mismatch_message =
    "Long-Term Memory Workspace identifiers do not match";
constexpr auto restore_target_not_pristine_message =
    "Long-Term Memory restore target must be pristine";

const std::string& empty_string() noexcept {
    static const std::string value;
    return value;
}

const std::vector<LongTermMemoryEntry>& empty_matches() noexcept {
    static const std::vector<LongTermMemoryEntry> value;
    return value;
}

std::vector<LongTermMemoryEntry>::iterator find_entry(
    std::vector<LongTermMemoryEntry>& entries,
    const std::string_view identifier) {
    return std::find_if(
        entries.begin(),
        entries.end(),
        [identifier](const LongTermMemoryEntry& entry) {
            return entry.identifier() == identifier;
        });
}

std::vector<LongTermMemoryEntry>::const_iterator find_entry(
    const std::vector<LongTermMemoryEntry>& entries,
    const std::string_view identifier) {
    return std::find_if(
        entries.begin(),
        entries.end(),
        [identifier](const LongTermMemoryEntry& entry) {
            return entry.identifier() == identifier;
        });
}

bool contains_identifier(const std::vector<std::string>& identifiers,
                         const std::string_view identifier) {
    return std::any_of(
        identifiers.begin(),
        identifiers.end(),
        [identifier](const std::string& candidate) {
            return candidate == identifier;
        });
}

} // namespace

LongTermMemoryEntry::LongTermMemoryEntry(std::string identifier,
                                         std::string value)
    : identifier_(std::move(identifier)), value_(std::move(value)) {}

const std::string& LongTermMemoryEntry::identifier() const noexcept {
    return identifier_;
}

const std::string& LongTermMemoryEntry::value() const noexcept {
    return value_;
}

bool LongTermMemoryEntry::archived() const noexcept { return archived_; }

LongTermMemoryQuery::LongTermMemoryQuery(std::string text)
    : text_(std::move(text)) {}

const std::string& LongTermMemoryQuery::text() const noexcept { return text_; }

LongTermMemory::LongTermMemory(std::string workspaceIdentifier) {
    if (workspaceIdentifier.empty()) {
        throw std::invalid_argument{"Workspace identifier must not be empty"};
    }
    workspace_identifier_ =
        std::make_shared<const std::string>(std::move(workspaceIdentifier));
}

LongTermMemory::~LongTermMemory() = default;
LongTermMemory::LongTermMemory(const LongTermMemory&) = default;

LongTermMemory::LongTermMemory(LongTermMemory&& other) noexcept
    : workspace_identifier_(other.workspace_identifier_),
      entries_(std::move(other.entries_)),
      forgotten_identifiers_(std::move(other.forgotten_identifiers_)) {
    other.entries_.clear();
    other.forgotten_identifiers_.clear();
}

const std::string& LongTermMemory::workspaceIdentifier() const noexcept {
    return workspace_identifier_ != nullptr ? *workspace_identifier_
                                            : empty_string();
}

std::size_t LongTermMemory::size() const noexcept { return entries_.size(); }

const LongTermMemoryEntry*
LongTermMemory::find(const std::string_view identifier) const noexcept {
    const auto found = find_entry(entries_, identifier);
    return found != entries_.end() ? std::addressof(*found) : nullptr;
}

const std::vector<LongTermMemoryEntry>& LongTermMemory::entries() const noexcept {
    return entries_;
}

class LongTermMemoryResult::Impl {
  public:
    Impl(const bool operationSucceeded,
         std::string resultCode,
         std::string resultMessage,
         std::unique_ptr<LongTermMemoryEntry> resultEntry,
         std::vector<LongTermMemoryEntry> resultMatches)
        : succeeded(operationSucceeded), code(std::move(resultCode)),
          message(std::move(resultMessage)), entry(std::move(resultEntry)),
          matches(std::move(resultMatches)) {}

    bool succeeded{};
    std::string code;
    std::string message;
    std::unique_ptr<LongTermMemoryEntry> entry;
    std::vector<LongTermMemoryEntry> matches;
};

LongTermMemoryResult::LongTermMemoryResult(
    const bool succeeded,
    std::string code,
    std::string message,
    std::unique_ptr<LongTermMemoryEntry> entry,
    std::vector<LongTermMemoryEntry> matches)
    : impl_(std::make_unique<Impl>(succeeded, std::move(code),
                                   std::move(message), std::move(entry),
                                   std::move(matches))) {}

LongTermMemoryResult::LongTermMemoryResult(LongTermMemoryResult&&) noexcept =
    default;
LongTermMemoryResult&
LongTermMemoryResult::operator=(LongTermMemoryResult&&) noexcept = default;
LongTermMemoryResult::~LongTermMemoryResult() = default;

bool LongTermMemoryResult::succeeded() const noexcept {
    return impl_ != nullptr && impl_->succeeded;
}

const std::string& LongTermMemoryResult::code() const noexcept {
    return impl_ != nullptr ? impl_->code : empty_string();
}

const std::string& LongTermMemoryResult::message() const noexcept {
    return impl_ != nullptr ? impl_->message : empty_string();
}

const LongTermMemoryEntry* LongTermMemoryResult::entry() const noexcept {
    return impl_ != nullptr ? impl_->entry.get() : nullptr;
}

const std::vector<LongTermMemoryEntry>&
LongTermMemoryResult::matches() const noexcept {
    return impl_ != nullptr ? impl_->matches : empty_matches();
}

LongTermMemoryResult
LongTermMemoryEngine::retain(LongTermMemory& memory,
                             LongTermMemoryEntry entry) const {
    if (entry.identifier().empty()) {
        return LongTermMemoryResult{false, invalid_identifier_code,
                                    invalid_identifier_message, nullptr, {}};
    }
    if (entry.archived()) {
        return LongTermMemoryResult{false, archived_code, archived_message,
                                    nullptr, {}};
    }
    if (contains_identifier(memory.forgotten_identifiers_,
                            entry.identifier())) {
        return LongTermMemoryResult{false, forgotten_identifier_code,
                                    forgotten_identifier_message, nullptr,
                                    {}};
    }

    const auto found = find_entry(memory.entries_, entry.identifier());
    if (found != memory.entries_.end()) {
        if (found->value() != entry.value()) {
            return LongTermMemoryResult{false, identifier_conflict_code,
                                        identifier_conflict_message, nullptr,
                                        {}};
        }
        return LongTermMemoryResult{
            true, ok_code, {}, std::make_unique<LongTermMemoryEntry>(*found),
            {}};
    }

    auto success = LongTermMemoryResult{
        true, ok_code, {}, std::make_unique<LongTermMemoryEntry>(entry), {}};
    static_assert(std::is_nothrow_move_constructible_v<LongTermMemoryEntry>);
    memory.entries_.push_back(std::move(entry));
    return success;
}

LongTermMemoryResult
LongTermMemoryEngine::store(LongTermMemory& memory,
                            LongTermMemoryEntry entry) const {
    if (entry.identifier().empty()) {
        return LongTermMemoryResult{false, invalid_identifier_code,
                                    invalid_identifier_message, nullptr, {}};
    }
    if (entry.archived()) {
        return LongTermMemoryResult{false, archived_code, archived_message,
                                    nullptr, {}};
    }
    if (contains_identifier(memory.forgotten_identifiers_,
                            entry.identifier())) {
        return LongTermMemoryResult{false, forgotten_identifier_code,
                                    forgotten_identifier_message, nullptr,
                                    {}};
    }

    const auto found = find_entry(memory.entries_, entry.identifier());
    if (found == memory.entries_.end()) {
        auto success = LongTermMemoryResult{
            true, ok_code, {}, std::make_unique<LongTermMemoryEntry>(entry),
            {}};
        static_assert(
            std::is_nothrow_move_constructible_v<LongTermMemoryEntry>);
        memory.entries_.push_back(std::move(entry));
        return success;
    }
    if (found->archived()) {
        return LongTermMemoryResult{false, archived_code, archived_message,
                                    nullptr, {}};
    }

    auto success = LongTermMemoryResult{
        true, ok_code, {}, std::make_unique<LongTermMemoryEntry>(entry), {}};
    static_assert(std::is_nothrow_move_assignable_v<LongTermMemoryEntry>);
    *found = std::move(entry);
    return success;
}

LongTermMemoryResult LongTermMemoryEngine::retrieve(
    const LongTermMemory& memory, const std::string_view identifier) const {
    if (identifier.empty()) {
        return LongTermMemoryResult{false, invalid_identifier_code,
                                    invalid_identifier_message, nullptr, {}};
    }

    const auto* const found = memory.find(identifier);
    if (found == nullptr) {
        return LongTermMemoryResult{false, not_found_code, not_found_message,
                                    nullptr, {}};
    }
    return LongTermMemoryResult{
        true, ok_code, {}, std::make_unique<LongTermMemoryEntry>(*found), {}};
}

LongTermMemoryResult LongTermMemoryEngine::search(
    const LongTermMemory& memory, const LongTermMemoryQuery& query) const {
    std::vector<LongTermMemoryEntry> matches;
    matches.reserve(memory.entries_.size());
    for (const auto& entry : memory.entries_) {
        if (entry.archived()) {
            continue;
        }
        if (entry.identifier().find(query.text()) != std::string::npos ||
            entry.value().find(query.text()) != std::string::npos) {
            matches.push_back(entry);
        }
    }
    return LongTermMemoryResult{true, ok_code, {}, nullptr,
                                std::move(matches)};
}

LongTermMemoryResult
LongTermMemoryEngine::archive(LongTermMemory& memory,
                              const std::string_view identifier) const {
    if (identifier.empty()) {
        return LongTermMemoryResult{false, invalid_identifier_code,
                                    invalid_identifier_message, nullptr, {}};
    }

    const auto found = find_entry(memory.entries_, identifier);
    if (found == memory.entries_.end()) {
        return LongTermMemoryResult{false, not_found_code, not_found_message,
                                    nullptr, {}};
    }
    if (found->archived()) {
        return LongTermMemoryResult{
            true, ok_code, {}, std::make_unique<LongTermMemoryEntry>(*found),
            {}};
    }

    auto archived_entry = *found;
    archived_entry.archived_ = true;
    auto success = LongTermMemoryResult{
        true, ok_code, {},
        std::make_unique<LongTermMemoryEntry>(archived_entry), {}};
    found->archived_ = true;
    return success;
}

LongTermMemoryResult LongTermMemoryEngine::restore(
    LongTermMemory& memory, const LongTermMemory& preserved) const {
    if (memory.workspaceIdentifier() != preserved.workspaceIdentifier()) {
        return LongTermMemoryResult{false, workspace_mismatch_code,
                                    workspace_mismatch_message, nullptr, {}};
    }
    if (!memory.entries_.empty() || !memory.forgotten_identifiers_.empty()) {
        return LongTermMemoryResult{false, restore_target_not_pristine_code,
                                    restore_target_not_pristine_message,
                                    nullptr, {}};
    }

    auto restored_entries = preserved.entries_;
    auto restored_forgotten_identifiers = preserved.forgotten_identifiers_;
    auto success = LongTermMemoryResult{true, ok_code, {}, nullptr, {}};

    static_assert(
        std::is_nothrow_swappable_v<std::vector<LongTermMemoryEntry>>);
    static_assert(std::is_nothrow_swappable_v<std::vector<std::string>>);
    memory.entries_.swap(restored_entries);
    memory.forgotten_identifiers_.swap(restored_forgotten_identifiers);
    return success;
}

LongTermMemoryResult
LongTermMemoryEngine::forget(LongTermMemory& memory,
                             const std::string_view identifier) const {
    if (identifier.empty()) {
        return LongTermMemoryResult{false, invalid_identifier_code,
                                    invalid_identifier_message, nullptr, {}};
    }

    auto success = LongTermMemoryResult{true, ok_code, {}, nullptr, {}};
    const auto found = find_entry(memory.entries_, identifier);
    if (found == memory.entries_.end()) {
        return success;
    }

    auto forgotten_identifier = found->identifier();
    memory.forgotten_identifiers_.push_back(std::move(forgotten_identifier));
    static_assert(std::is_nothrow_move_assignable_v<LongTermMemoryEntry>);
    memory.entries_.erase(found);
    return success;
}

} // namespace cca::memory

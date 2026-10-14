#include <cca/memory/working_memory.hpp>

#include <algorithm>
#include <stdexcept>
#include <type_traits>
#include <utility>

namespace cca::memory {
namespace {

constexpr auto ok_code = "OK";
constexpr auto invalid_task_identifier_code = "INVALID_TASK_IDENTIFIER";
constexpr auto not_active_code = "NOT_ACTIVE";
constexpr auto invalid_identifier_code = "INVALID_IDENTIFIER";
constexpr auto not_found_code = "NOT_FOUND";

constexpr auto invalid_task_identifier_message =
    "Task identifier must not be empty";
constexpr auto not_active_message = "Working Memory is not active";
constexpr auto invalid_identifier_message =
    "Working Memory entry identifier must not be empty";
constexpr auto not_found_message = "Working Memory entry was not found";

const std::string& empty_string() noexcept {
    static const std::string value;
    return value;
}

const std::vector<WorkingMemoryEntry>& empty_matches() noexcept {
    static const std::vector<WorkingMemoryEntry> value;
    return value;
}

} // namespace

WorkingMemoryEntry::WorkingMemoryEntry(
    std::string identifier,
    std::string value,
    const std::optional<std::uint64_t> expirationPoint)
    : identifier_(std::move(identifier)), value_(std::move(value)),
      expiration_point_(expirationPoint) {}

const std::string& WorkingMemoryEntry::identifier() const noexcept {
    return identifier_;
}

const std::string& WorkingMemoryEntry::value() const noexcept {
    return value_;
}

const std::optional<std::uint64_t>&
WorkingMemoryEntry::expirationPoint() const noexcept {
    return expiration_point_;
}

WorkingMemoryQuery::WorkingMemoryQuery(std::string text)
    : text_(std::move(text)) {}

const std::string& WorkingMemoryQuery::text() const noexcept { return text_; }

WorkingMemory::WorkingMemory(std::string workspaceIdentifier) {
    if (workspaceIdentifier.empty()) {
        throw std::invalid_argument{"Workspace identifier must not be empty"};
    }
    workspace_identifier_ =
        std::make_shared<const std::string>(std::move(workspaceIdentifier));
}

WorkingMemory::~WorkingMemory() = default;
WorkingMemory::WorkingMemory(const WorkingMemory&) = default;

WorkingMemory::WorkingMemory(WorkingMemory&& other) noexcept
    : workspace_identifier_(other.workspace_identifier_),
      active_task_identifier_(std::move(other.active_task_identifier_)),
      entries_(std::move(other.entries_)) {
    other.active_task_identifier_.reset();
    other.entries_.clear();
}

const std::string& WorkingMemory::workspaceIdentifier() const noexcept {
    return workspace_identifier_ != nullptr ? *workspace_identifier_
                                            : empty_string();
}

bool WorkingMemory::active() const noexcept {
    return active_task_identifier_.has_value();
}

const std::optional<std::string>&
WorkingMemory::activeTaskIdentifier() const noexcept {
    return active_task_identifier_;
}

std::size_t WorkingMemory::size() const noexcept { return entries_.size(); }

const WorkingMemoryEntry*
WorkingMemory::find(const std::string_view identifier) const noexcept {
    const auto found = std::find_if(
        entries_.begin(), entries_.end(),
        [identifier](const WorkingMemoryEntry& entry) {
            return entry.identifier() == identifier;
        });
    return found != entries_.end() ? std::addressof(*found) : nullptr;
}

const std::vector<WorkingMemoryEntry>& WorkingMemory::entries() const noexcept {
    return entries_;
}

class WorkingMemoryResult::Impl {
  public:
    Impl(const bool operationSucceeded,
         std::string resultCode,
         std::string resultMessage,
         std::unique_ptr<WorkingMemoryEntry> resultEntry,
         std::vector<WorkingMemoryEntry> resultMatches)
        : succeeded(operationSucceeded), code(std::move(resultCode)),
          message(std::move(resultMessage)), entry(std::move(resultEntry)),
          matches(std::move(resultMatches)) {}

    bool succeeded{};
    std::string code;
    std::string message;
    std::unique_ptr<WorkingMemoryEntry> entry;
    std::vector<WorkingMemoryEntry> matches;
};

WorkingMemoryResult::WorkingMemoryResult(
    const bool succeeded,
    std::string code,
    std::string message,
    std::unique_ptr<WorkingMemoryEntry> entry,
    std::vector<WorkingMemoryEntry> matches)
    : impl_(std::make_unique<Impl>(succeeded, std::move(code),
                                   std::move(message), std::move(entry),
                                   std::move(matches))) {}

WorkingMemoryResult::WorkingMemoryResult(WorkingMemoryResult&&) noexcept =
    default;
WorkingMemoryResult&
WorkingMemoryResult::operator=(WorkingMemoryResult&&) noexcept = default;
WorkingMemoryResult::~WorkingMemoryResult() = default;

bool WorkingMemoryResult::succeeded() const noexcept {
    return impl_ != nullptr && impl_->succeeded;
}

const std::string& WorkingMemoryResult::code() const noexcept {
    return impl_ != nullptr ? impl_->code : empty_string();
}

const std::string& WorkingMemoryResult::message() const noexcept {
    return impl_ != nullptr ? impl_->message : empty_string();
}

const WorkingMemoryEntry* WorkingMemoryResult::entry() const noexcept {
    return impl_ != nullptr ? impl_->entry.get() : nullptr;
}

const std::vector<WorkingMemoryEntry>&
WorkingMemoryResult::matches() const noexcept {
    return impl_ != nullptr ? impl_->matches : empty_matches();
}

WorkingMemoryResult
WorkingMemoryEngine::activate(WorkingMemory& memory,
                              std::string taskIdentifier) const {
    if (taskIdentifier.empty()) {
        return WorkingMemoryResult{false, invalid_task_identifier_code,
                                   invalid_task_identifier_message, nullptr,
                                   {}};
    }

    auto success = WorkingMemoryResult{true, ok_code, {}, nullptr, {}};
    if (memory.active_task_identifier_ == taskIdentifier) {
        return success;
    }

    static_assert(std::is_nothrow_move_assignable_v<std::string>);
    memory.active_task_identifier_ = std::move(taskIdentifier);
    memory.entries_.clear();
    return success;
}

WorkingMemoryResult
WorkingMemoryEngine::store(WorkingMemory& memory,
                           WorkingMemoryEntry entry) const {
    if (!memory.active()) {
        return WorkingMemoryResult{false, not_active_code, not_active_message,
                                   nullptr, {}};
    }
    if (entry.identifier().empty()) {
        return WorkingMemoryResult{false, invalid_identifier_code,
                                   invalid_identifier_message, nullptr, {}};
    }

    auto success = WorkingMemoryResult{
        true, ok_code, {}, std::make_unique<WorkingMemoryEntry>(entry), {}};
    const auto found = std::find_if(
        memory.entries_.begin(), memory.entries_.end(),
        [&entry](const WorkingMemoryEntry& candidate) {
            return candidate.identifier() == entry.identifier();
        });

    static_assert(std::is_nothrow_move_constructible_v<WorkingMemoryEntry>);
    static_assert(std::is_nothrow_move_assignable_v<WorkingMemoryEntry>);
    if (found == memory.entries_.end()) {
        memory.entries_.push_back(std::move(entry));
    } else {
        *found = std::move(entry);
    }
    return success;
}

WorkingMemoryResult WorkingMemoryEngine::retrieve(
    const WorkingMemory& memory, const std::string_view identifier) const {
    if (!memory.active()) {
        return WorkingMemoryResult{false, not_active_code, not_active_message,
                                   nullptr, {}};
    }
    if (identifier.empty()) {
        return WorkingMemoryResult{false, invalid_identifier_code,
                                   invalid_identifier_message, nullptr, {}};
    }

    const auto* const found = memory.find(identifier);
    if (found == nullptr) {
        return WorkingMemoryResult{false, not_found_code, not_found_message,
                                   nullptr, {}};
    }
    return WorkingMemoryResult{true, ok_code, {},
                               std::make_unique<WorkingMemoryEntry>(*found),
                               {}};
}

WorkingMemoryResult WorkingMemoryEngine::search(
    const WorkingMemory& memory, const WorkingMemoryQuery& query) const {
    if (!memory.active()) {
        return WorkingMemoryResult{false, not_active_code, not_active_message,
                                   nullptr, {}};
    }

    std::vector<WorkingMemoryEntry> matches;
    matches.reserve(memory.entries_.size());
    for (const auto& entry : memory.entries_) {
        if (entry.identifier().find(query.text()) != std::string::npos ||
            entry.value().find(query.text()) != std::string::npos) {
            matches.push_back(entry);
        }
    }
    return WorkingMemoryResult{true, ok_code, {}, nullptr, std::move(matches)};
}

WorkingMemoryResult
WorkingMemoryEngine::expire(WorkingMemory& memory,
                            const std::uint64_t logicalPoint) const {
    if (!memory.active()) {
        return WorkingMemoryResult{false, not_active_code, not_active_message,
                                   nullptr, {}};
    }

    std::vector<WorkingMemoryEntry> removed;
    std::vector<WorkingMemoryEntry> survivors;
    removed.reserve(memory.entries_.size());
    survivors.reserve(memory.entries_.size());
    for (const auto& entry : memory.entries_) {
        if (entry.expirationPoint().has_value() &&
            *entry.expirationPoint() <= logicalPoint) {
            removed.push_back(entry);
        } else {
            survivors.push_back(entry);
        }
    }

    auto success = WorkingMemoryResult{true, ok_code, {}, nullptr,
                                       std::move(removed)};
    memory.entries_.swap(survivors);
    return success;
}

WorkingMemoryResult
WorkingMemoryEngine::forget(WorkingMemory& memory,
                            const std::string_view identifier) const {
    if (!memory.active()) {
        return WorkingMemoryResult{false, not_active_code, not_active_message,
                                   nullptr, {}};
    }
    if (identifier.empty()) {
        return WorkingMemoryResult{false, invalid_identifier_code,
                                   invalid_identifier_message, nullptr, {}};
    }

    auto success = WorkingMemoryResult{true, ok_code, {}, nullptr, {}};
    const auto found = std::find_if(
        memory.entries_.begin(), memory.entries_.end(),
        [identifier](const WorkingMemoryEntry& entry) {
            return entry.identifier() == identifier;
        });
    if (found != memory.entries_.end()) {
        static_assert(
            std::is_nothrow_move_assignable_v<WorkingMemoryEntry>);
        memory.entries_.erase(found);
    }
    return success;
}

} // namespace cca::memory

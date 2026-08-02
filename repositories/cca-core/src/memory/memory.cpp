#include <cca/memory/memory.hpp>

#include <algorithm>
#include <stdexcept>
#include <utility>

namespace cca::memory {
namespace {

constexpr auto ok_code = "OK";
constexpr auto invalid_identifier_code = "INVALID_IDENTIFIER";
constexpr auto not_found_code = "NOT_FOUND";
constexpr auto invalid_identifier_message =
    "Memory identifier must not be empty";
constexpr auto not_found_message = "Memory entry was not found";

const std::string& empty_string() noexcept {
    static const std::string value;
    return value;
}

const std::vector<MemoryEntry>& empty_matches() noexcept {
    static const std::vector<MemoryEntry> value;
    return value;
}

} // namespace

MemoryEntry::MemoryEntry(std::string identifier, std::string value)
    : identifier_(std::move(identifier)), value_(std::move(value)) {}

const std::string& MemoryEntry::identifier() const noexcept {
    return identifier_;
}

const std::string& MemoryEntry::value() const noexcept {
    return value_;
}

MemoryQuery::MemoryQuery(std::string text) : text_(std::move(text)) {}

const std::string& MemoryQuery::text() const noexcept {
    return text_;
}

Memory::Memory(std::string workspaceIdentifier) {
    if (workspaceIdentifier.empty()) {
        throw std::invalid_argument{"Workspace identifier must not be empty"};
    }
    workspace_identifier_ =
        std::make_shared<const std::string>(std::move(workspaceIdentifier));
}

Memory::~Memory() = default;
Memory::Memory(const Memory&) = default;

Memory::Memory(Memory&& other) noexcept
    : workspace_identifier_(other.workspace_identifier_),
      entries_(std::move(other.entries_)) {}

const std::string& Memory::workspaceIdentifier() const noexcept {
    return workspace_identifier_ != nullptr ? *workspace_identifier_
                                            : empty_string();
}

std::size_t Memory::size() const noexcept { return entries_.size(); }

const MemoryEntry*
Memory::find(const std::string_view identifier) const noexcept {
    const auto found = std::find_if(
        entries_.begin(), entries_.end(),
        [identifier](const MemoryEntry& entry) {
            return entry.identifier() == identifier;
        });
    return found != entries_.end() ? std::addressof(*found) : nullptr;
}

const std::vector<MemoryEntry>& Memory::entries() const noexcept {
    return entries_;
}

class MemoryResult::Impl {
  public:
    Impl(const bool operation_succeeded,
         std::string result_code,
         std::string result_message,
         std::unique_ptr<MemoryEntry> result_entry,
         std::vector<MemoryEntry> result_matches)
        : succeeded(operation_succeeded), code(std::move(result_code)),
          message(std::move(result_message)), entry(std::move(result_entry)),
          matches(std::move(result_matches)) {}

    bool succeeded{};
    std::string code;
    std::string message;
    std::unique_ptr<MemoryEntry> entry;
    std::vector<MemoryEntry> matches;
};

MemoryResult::MemoryResult(const bool succeeded,
                           std::string code,
                           std::string message,
                           std::unique_ptr<MemoryEntry> entry,
                           std::vector<MemoryEntry> matches)
    : impl_(std::make_unique<Impl>(succeeded, std::move(code),
                                   std::move(message), std::move(entry),
                                   std::move(matches))) {}

MemoryResult::MemoryResult(MemoryResult&&) noexcept = default;
MemoryResult& MemoryResult::operator=(MemoryResult&&) noexcept = default;
MemoryResult::~MemoryResult() = default;

bool MemoryResult::succeeded() const noexcept {
    return impl_ != nullptr && impl_->succeeded;
}

const std::string& MemoryResult::code() const noexcept {
    return impl_ != nullptr ? impl_->code : empty_string();
}

const std::string& MemoryResult::message() const noexcept {
    return impl_ != nullptr ? impl_->message : empty_string();
}

const MemoryEntry* MemoryResult::entry() const noexcept {
    return impl_ != nullptr ? impl_->entry.get() : nullptr;
}

const std::vector<MemoryEntry>& MemoryResult::matches() const noexcept {
    return impl_ != nullptr ? impl_->matches : empty_matches();
}

MemoryResult MemoryEngine::store(Memory& memory, MemoryEntry entry) const {
    if (entry.identifier().empty()) {
        return MemoryResult{false, invalid_identifier_code,
                            invalid_identifier_message, nullptr, {}};
    }
    auto success = MemoryResult{true, ok_code, "stored",
                                std::make_unique<MemoryEntry>(entry), {}};
    const auto found = std::find_if(
        memory.entries_.begin(), memory.entries_.end(),
        [&entry](const MemoryEntry& candidate) {
            return candidate.identifier() == entry.identifier();
        });
    if (found == memory.entries_.end()) {
        memory.entries_.push_back(std::move(entry));
    } else {
        *found = std::move(entry);
    }
    return success;
}

MemoryResult MemoryEngine::retrieve(
    const Memory& memory, const std::string_view identifier) const {
    if (identifier.empty()) {
        return MemoryResult{false, invalid_identifier_code,
                            invalid_identifier_message, nullptr, {}};
    }
    const auto* const found = memory.find(identifier);
    if (found == nullptr) {
        return MemoryResult{false, not_found_code, not_found_message,
                            nullptr, {}};
    }
    return MemoryResult{true, ok_code, "retrieved",
                        std::make_unique<MemoryEntry>(*found), {}};
}

MemoryResult MemoryEngine::search(
    const Memory& memory, const MemoryQuery& query) const {
    std::vector<MemoryEntry> matches;
    for (const auto& entry : memory.entries_) {
        if (entry.identifier().find(query.text()) != std::string::npos ||
            entry.value().find(query.text()) != std::string::npos) {
            matches.push_back(entry);
        }
    }
    return MemoryResult{true, ok_code, "searched", nullptr, std::move(matches)};
}

MemoryResult MemoryEngine::forget(
    Memory& memory, const std::string_view identifier) const {
    if (identifier.empty()) {
        return MemoryResult{false, invalid_identifier_code,
                            invalid_identifier_message, nullptr, {}};
    }
    auto success = MemoryResult{true, ok_code, "forgotten", nullptr, {}};
    const auto found = std::find_if(
        memory.entries_.begin(), memory.entries_.end(),
        [identifier](const MemoryEntry& entry) {
            return entry.identifier() == identifier;
        });
    if (found != memory.entries_.end()) {
        memory.entries_.erase(found);
    }
    return success;
}

} // namespace cca::memory

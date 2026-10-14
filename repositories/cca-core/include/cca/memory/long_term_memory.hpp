#pragma once

#include <cstddef>
#include <memory>
#include <string>
#include <string_view>
#include <vector>

namespace cca::memory {

namespace detail {
class LongTermMemoryPersistence;
}

class LongTermMemoryEntry {
  public:
    LongTermMemoryEntry(std::string identifier, std::string value);

    const std::string& identifier() const noexcept;
    const std::string& value() const noexcept;
    bool archived() const noexcept;

  private:
    std::string identifier_;
    std::string value_;
    bool archived_{false};

    friend class LongTermMemoryEngine;
    friend class detail::LongTermMemoryPersistence;
};

class LongTermMemoryQuery {
  public:
    explicit LongTermMemoryQuery(std::string text);

    const std::string& text() const noexcept;

  private:
    std::string text_;
};

class LongTermMemory {
  public:
    explicit LongTermMemory(std::string workspaceIdentifier);
    ~LongTermMemory();
    LongTermMemory(const LongTermMemory&);
    LongTermMemory& operator=(const LongTermMemory&) = delete;
    LongTermMemory(LongTermMemory&&) noexcept;
    LongTermMemory& operator=(LongTermMemory&&) noexcept = delete;

    const std::string& workspaceIdentifier() const noexcept;
    std::size_t size() const noexcept;
    const LongTermMemoryEntry* find(
        std::string_view identifier) const noexcept;
    const std::vector<LongTermMemoryEntry>& entries() const noexcept;

  private:
    std::shared_ptr<const std::string> workspace_identifier_;
    std::vector<LongTermMemoryEntry> entries_;
    std::vector<std::string> forgotten_identifiers_;

    friend class LongTermMemoryEngine;
    friend class detail::LongTermMemoryPersistence;
};

class LongTermMemoryResult {
  public:
    LongTermMemoryResult(LongTermMemoryResult&&) noexcept;
    LongTermMemoryResult& operator=(LongTermMemoryResult&&) noexcept;
    LongTermMemoryResult(const LongTermMemoryResult&) = delete;
    LongTermMemoryResult& operator=(const LongTermMemoryResult&) = delete;
    ~LongTermMemoryResult();

    bool succeeded() const noexcept;
    const std::string& code() const noexcept;
    const std::string& message() const noexcept;
    const LongTermMemoryEntry* entry() const noexcept;
    const std::vector<LongTermMemoryEntry>& matches() const noexcept;

  private:
    LongTermMemoryResult(bool succeeded,
                         std::string code,
                         std::string message,
                         std::unique_ptr<LongTermMemoryEntry> entry,
                         std::vector<LongTermMemoryEntry> matches);

    class Impl;
    std::unique_ptr<Impl> impl_;

    friend class LongTermMemoryEngine;
};

class LongTermMemoryEngine {
  public:
    LongTermMemoryResult retain(LongTermMemory& memory,
                                LongTermMemoryEntry entry) const;
    LongTermMemoryResult store(LongTermMemory& memory,
                               LongTermMemoryEntry entry) const;
    LongTermMemoryResult retrieve(const LongTermMemory& memory,
                                  std::string_view identifier) const;
    LongTermMemoryResult search(
        const LongTermMemory& memory,
        const LongTermMemoryQuery& query) const;
    LongTermMemoryResult archive(LongTermMemory& memory,
                                 std::string_view identifier) const;
    LongTermMemoryResult restore(
        LongTermMemory& memory,
        const LongTermMemory& preserved) const;
    LongTermMemoryResult forget(LongTermMemory& memory,
                                std::string_view identifier) const;
};

} // namespace cca::memory

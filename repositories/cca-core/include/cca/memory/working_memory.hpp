#pragma once

#include <cstddef>
#include <cstdint>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace cca::memory {

class WorkingMemoryEntry {
  public:
    WorkingMemoryEntry(
        std::string identifier,
        std::string value,
        std::optional<std::uint64_t> expirationPoint = std::nullopt);

    const std::string& identifier() const noexcept;
    const std::string& value() const noexcept;
    const std::optional<std::uint64_t>& expirationPoint() const noexcept;

  private:
    std::string identifier_;
    std::string value_;
    std::optional<std::uint64_t> expiration_point_;
};

class WorkingMemoryQuery {
  public:
    explicit WorkingMemoryQuery(std::string text);
    const std::string& text() const noexcept;

  private:
    std::string text_;
};

class WorkingMemory {
  public:
    explicit WorkingMemory(std::string workspaceIdentifier);
    ~WorkingMemory();
    WorkingMemory(const WorkingMemory&);
    WorkingMemory& operator=(const WorkingMemory&) = delete;
    WorkingMemory(WorkingMemory&&) noexcept;
    WorkingMemory& operator=(WorkingMemory&&) noexcept = delete;

    const std::string& workspaceIdentifier() const noexcept;
    bool active() const noexcept;
    const std::optional<std::string>& activeTaskIdentifier() const noexcept;
    std::size_t size() const noexcept;
    const WorkingMemoryEntry* find(std::string_view identifier) const noexcept;
    const std::vector<WorkingMemoryEntry>& entries() const noexcept;

  private:
    std::shared_ptr<const std::string> workspace_identifier_;
    std::optional<std::string> active_task_identifier_;
    std::vector<WorkingMemoryEntry> entries_;

    friend class WorkingMemoryEngine;
};

class WorkingMemoryResult {
  public:
    WorkingMemoryResult(WorkingMemoryResult&&) noexcept;
    WorkingMemoryResult& operator=(WorkingMemoryResult&&) noexcept;
    WorkingMemoryResult(const WorkingMemoryResult&) = delete;
    WorkingMemoryResult& operator=(const WorkingMemoryResult&) = delete;
    ~WorkingMemoryResult();

    bool succeeded() const noexcept;
    const std::string& code() const noexcept;
    const std::string& message() const noexcept;
    const WorkingMemoryEntry* entry() const noexcept;
    const std::vector<WorkingMemoryEntry>& matches() const noexcept;

  private:
    WorkingMemoryResult(bool succeeded,
                        std::string code,
                        std::string message,
                        std::unique_ptr<WorkingMemoryEntry> entry,
                        std::vector<WorkingMemoryEntry> matches);

    class Impl;
    std::unique_ptr<Impl> impl_;

    friend class WorkingMemoryEngine;
};

class WorkingMemoryEngine {
  public:
    WorkingMemoryResult activate(WorkingMemory& memory,
                                 std::string taskIdentifier) const;
    WorkingMemoryResult store(WorkingMemory& memory,
                              WorkingMemoryEntry entry) const;
    WorkingMemoryResult retrieve(const WorkingMemory& memory,
                                 std::string_view identifier) const;
    WorkingMemoryResult search(const WorkingMemory& memory,
                               const WorkingMemoryQuery& query) const;
    WorkingMemoryResult expire(WorkingMemory& memory,
                               std::uint64_t logicalPoint) const;
    WorkingMemoryResult forget(WorkingMemory& memory,
                               std::string_view identifier) const;
};

} // namespace cca::memory

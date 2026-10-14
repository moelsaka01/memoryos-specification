#pragma once

#include <cstddef>
#include <memory>
#include <string>
#include <string_view>
#include <vector>

namespace cca::memory {

class MemoryEntry {
  public:
    MemoryEntry(std::string identifier, std::string value);

    const std::string& identifier() const noexcept;
    const std::string& value() const noexcept;

  private:
    std::string identifier_;
    std::string value_;
};

class MemoryQuery {
  public:
    explicit MemoryQuery(std::string text);

    const std::string& text() const noexcept;

  private:
    std::string text_;
};

class Memory {
  public:
    explicit Memory(std::string workspaceIdentifier);
    ~Memory();
    Memory(const Memory&);
    Memory& operator=(const Memory&) = delete;
    Memory(Memory&&) noexcept;
    Memory& operator=(Memory&&) noexcept = delete;

    const std::string& workspaceIdentifier() const noexcept;
    std::size_t size() const noexcept;
    const MemoryEntry* find(std::string_view identifier) const noexcept;
    const std::vector<MemoryEntry>& entries() const noexcept;

  private:
    std::shared_ptr<const std::string> workspace_identifier_;
    std::vector<MemoryEntry> entries_;

    friend class MemoryEngine;
};

class MemoryResult {
  public:
    MemoryResult(MemoryResult&&) noexcept;
    MemoryResult& operator=(MemoryResult&&) noexcept;
    MemoryResult(const MemoryResult&) = delete;
    MemoryResult& operator=(const MemoryResult&) = delete;
    ~MemoryResult();

    bool succeeded() const noexcept;
    const std::string& code() const noexcept;
    const std::string& message() const noexcept;
    const MemoryEntry* entry() const noexcept;
    const std::vector<MemoryEntry>& matches() const noexcept;

  private:
    MemoryResult(bool succeeded,
                 std::string code,
                 std::string message,
                 std::unique_ptr<MemoryEntry> entry,
                 std::vector<MemoryEntry> matches);

    class Impl;
    std::unique_ptr<Impl> impl_;

    friend class MemoryEngine;
};

class MemoryEngine {
  public:
    MemoryResult store(Memory& memory, MemoryEntry entry) const;
    MemoryResult retrieve(const Memory& memory,
                          std::string_view identifier) const;
    MemoryResult search(const Memory& memory,
                        const MemoryQuery& query) const;
    MemoryResult forget(Memory& memory, std::string_view identifier) const;
};

} // namespace cca::memory

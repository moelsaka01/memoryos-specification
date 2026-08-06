#pragma once

#include <cca/memory/long_term_memory.hpp>
#include <cca/memory/working_memory.hpp>

#include <cstddef>
#include <memory>
#include <optional>
#include <string>

namespace cca::memory {

class ConsolidationRequest {
  public:
    ConsolidationRequest(std::string workspaceIdentifier,
                         std::string taskIdentifier,
                         std::string entryIdentifier);

    const std::string& workspaceIdentifier() const noexcept;
    const std::string& taskIdentifier() const noexcept;
    const std::string& entryIdentifier() const noexcept;

  private:
    std::string workspace_identifier_;
    std::string task_identifier_;
    std::string entry_identifier_;
};

class ConsolidationCandidate {
  public:
    ~ConsolidationCandidate();
    ConsolidationCandidate(const ConsolidationCandidate&);
    ConsolidationCandidate& operator=(const ConsolidationCandidate&);
    ConsolidationCandidate(ConsolidationCandidate&&) noexcept;
    ConsolidationCandidate& operator=(ConsolidationCandidate&&) noexcept;

    const std::string& workspaceIdentifier() const noexcept;
    const std::string& taskIdentifier() const noexcept;
    std::size_t sourcePosition() const noexcept;
    const WorkingMemoryEntry* workingMemoryEntry() const noexcept;
    const LongTermMemoryEntry* longTermMemoryEntry() const noexcept;
    const std::optional<std::size_t>& retainedPosition() const noexcept;

  private:
    ConsolidationCandidate(
        std::string workspaceIdentifier,
        std::string taskIdentifier,
        std::size_t sourcePosition,
        WorkingMemoryEntry workingMemoryEntry,
        std::unique_ptr<LongTermMemoryEntry> longTermMemoryEntry,
        std::optional<std::size_t> retainedPosition);

    class Impl;
    std::unique_ptr<Impl> impl_;

    friend class MemoryConsolidationEngine;
};

class ConsolidationSession {
  public:
    enum class State { Pristine, Analyzed, Promoted, Retained, Forgotten };

    explicit ConsolidationSession(std::string workspaceIdentifier);
    ~ConsolidationSession();
    ConsolidationSession(const ConsolidationSession&);
    ConsolidationSession& operator=(const ConsolidationSession&) = delete;
    ConsolidationSession(ConsolidationSession&&) noexcept;
    ConsolidationSession& operator=(ConsolidationSession&&) noexcept = delete;

    const std::string& workspaceIdentifier() const noexcept;
    State state() const noexcept;
    const ConsolidationRequest* request() const noexcept;
    const ConsolidationCandidate* candidate() const noexcept;
    const WorkingMemory* workingMemory() const noexcept;
    const LongTermMemory* longTermMemory() const noexcept;

  private:
    class Impl;

    std::shared_ptr<const std::string> workspace_identifier_;
    std::unique_ptr<Impl> impl_;

    friend class MemoryConsolidationEngine;
};

class ConsolidationResult {
  public:
    ConsolidationResult(ConsolidationResult&&) noexcept;
    ConsolidationResult& operator=(ConsolidationResult&&) noexcept;
    ConsolidationResult(const ConsolidationResult&) = delete;
    ConsolidationResult& operator=(const ConsolidationResult&) = delete;
    ~ConsolidationResult();

    bool succeeded() const noexcept;
    const std::string& code() const noexcept;
    const std::string& message() const noexcept;
    const ConsolidationCandidate* candidate() const noexcept;
    const ConsolidationSession* session() const noexcept;
    const WorkingMemory* workingMemory() const noexcept;
    const LongTermMemory* longTermMemory() const noexcept;

  private:
    ConsolidationResult(
        bool succeeded,
        std::string code,
        std::string message,
        std::unique_ptr<ConsolidationCandidate> candidate,
        std::unique_ptr<ConsolidationSession> session,
        std::unique_ptr<WorkingMemory> workingMemory,
        std::unique_ptr<LongTermMemory> longTermMemory);

    static ConsolidationResult success(
        std::unique_ptr<ConsolidationCandidate> candidate = nullptr,
        std::unique_ptr<ConsolidationSession> session = nullptr,
        std::unique_ptr<WorkingMemory> workingMemory = nullptr,
        std::unique_ptr<LongTermMemory> longTermMemory = nullptr);
    static ConsolidationResult failure(std::string code,
                                       std::string message);

    class Impl;
    std::unique_ptr<Impl> impl_;

    friend class MemoryConsolidationEngine;
};

class MemoryConsolidationEngine {
  public:
    ConsolidationResult analyze(ConsolidationSession& session,
                                const ConsolidationRequest& request,
                                const WorkingMemory& workingMemory,
                                const LongTermMemory& longTermMemory) const;
    ConsolidationResult promote(ConsolidationSession& session) const;
    ConsolidationResult retain(ConsolidationSession& session,
                               const WorkingMemory& workingMemory,
                               const LongTermMemory& longTermMemory) const;
    ConsolidationResult validate(const ConsolidationSession& session,
                                 const WorkingMemory& workingMemory,
                                 const LongTermMemory& longTermMemory) const;
    ConsolidationResult
    retrieveSession(const ConsolidationSession& session) const;
    ConsolidationResult forgetSession(ConsolidationSession& session) const;
};

} // namespace cca::memory

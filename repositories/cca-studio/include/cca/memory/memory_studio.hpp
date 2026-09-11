#pragma once

#include <cca/memory/episodic_memory.hpp>
#include <cca/memory/knowledge_retrieval.hpp>
#include <cca/memory/long_term_memory.hpp>
#include <cca/memory/memory.hpp>
#include <cca/memory/memory_consolidation.hpp>
#include <cca/memory/memory_provider.hpp>
#include <cca/memory/memory_reflection.hpp>
#include <cca/memory/procedural_memory.hpp>
#include <cca/memory/semantic_memory.hpp>
#include <cca/memory/working_memory.hpp>

#include <memory>
#include <string>
#include <vector>

namespace cca::memory {

class StudioView {
  public:
    StudioView(
        std::string workspaceIdentifier,
        const Memory& memory,
        const WorkingMemory& workingMemory,
        const LongTermMemory& longTermMemory,
        const SemanticMemory& semanticMemory,
        const EpisodicMemory& episodicMemory,
        const ProceduralMemory& proceduralMemory,
        std::vector<RetrievalSession> retrievalSessions = {},
        std::vector<ConsolidationSession> consolidationSessions = {},
        std::vector<Reflection> reflections = {},
        std::vector<ReflectionSession> reflectionSessions = {},
        std::vector<ProviderSession> providerSessions = {});
    ~StudioView();
    StudioView(const StudioView&);
    StudioView& operator=(const StudioView&);
    StudioView(StudioView&&) noexcept;
    StudioView& operator=(StudioView&&) noexcept;

    const std::string& workspaceIdentifier() const noexcept;
    const Memory* memory() const noexcept;
    const WorkingMemory* workingMemory() const noexcept;
    const LongTermMemory* longTermMemory() const noexcept;
    const SemanticMemory* semanticMemory() const noexcept;
    const EpisodicMemory* episodicMemory() const noexcept;
    const ProceduralMemory* proceduralMemory() const noexcept;
    const std::vector<RetrievalSession>& retrievalSessions() const noexcept;
    const std::vector<ConsolidationSession>&
    consolidationSessions() const noexcept;
    const std::vector<Reflection>& reflections() const noexcept;
    const std::vector<ReflectionSession>& reflectionSessions() const noexcept;
    const std::vector<ProviderSession>& providerSessions() const noexcept;

  private:
    class Impl;

    std::shared_ptr<const std::string> workspace_identifier_;
    std::unique_ptr<Impl> impl_;
};

class StudioQuery {
  public:
    enum class Scope {
        Complete,
        Memory,
        WorkingMemory,
        LongTermMemory,
        SemanticMemory,
        EpisodicMemory,
        ProceduralMemory,
        Retrieval,
        Consolidation,
        Reflection,
        Providers
    };

    StudioQuery(std::string workspaceIdentifier,
                Scope scope = Scope::Complete,
                std::string identifier = {});
    ~StudioQuery();
    StudioQuery(const StudioQuery&);
    StudioQuery& operator=(const StudioQuery&);
    StudioQuery(StudioQuery&&) noexcept;
    StudioQuery& operator=(StudioQuery&&) noexcept;

    const std::string& workspaceIdentifier() const noexcept;
    Scope scope() const noexcept;
    const std::string& identifier() const noexcept;

  private:
    std::shared_ptr<const std::string> workspace_identifier_;
    Scope scope_{Scope::Complete};
    std::string identifier_;
};

class StudioSession {
  public:
    enum class State { Open, Observed, Forgotten };

    explicit StudioSession(std::string workspaceIdentifier);
    ~StudioSession();
    StudioSession(const StudioSession&);
    StudioSession& operator=(const StudioSession&) = delete;
    StudioSession(StudioSession&&) noexcept;
    StudioSession& operator=(StudioSession&&) noexcept = delete;

    const std::string& workspaceIdentifier() const noexcept;
    State state() const noexcept;
    const StudioView* view() const noexcept;

  private:
    std::shared_ptr<const std::string> workspace_identifier_;
    State state_{State::Open};
    std::unique_ptr<StudioView> view_;

    friend class MemoryStudioEngine;
};

class StudioResult {
  public:
    StudioResult(StudioResult&&) noexcept;
    StudioResult& operator=(StudioResult&&) noexcept;
    StudioResult(const StudioResult&) = delete;
    StudioResult& operator=(const StudioResult&) = delete;
    ~StudioResult();

    const std::string& workspaceIdentifier() const noexcept;
    bool succeeded() const noexcept;
    const std::string& code() const noexcept;
    const std::string& message() const noexcept;
    const StudioView* view() const noexcept;
    const std::vector<std::string>& observations() const noexcept;
    const std::vector<std::vector<std::string>>&
    explanationChains() const noexcept;

  private:
    class Impl;

    StudioResult(std::string workspaceIdentifier,
                 std::string code,
                 std::string message,
                 std::unique_ptr<StudioView> view,
                 std::vector<std::string> observations,
                 std::vector<std::vector<std::string>> explanationChains);

    std::unique_ptr<Impl> impl_;

    friend class MemoryStudioEngine;
};

class MemoryStudioEngine {
  public:
    StudioResult observe(StudioSession& session,
                         const StudioView& view) const;
    StudioResult inspect(const StudioSession& session,
                         const StudioQuery& query) const;
    StudioResult trace(const StudioSession& session,
                       const StudioQuery& query) const;
    StudioResult summarize(const StudioSession& session,
                           const StudioQuery& query) const;
    StudioResult exportView(const StudioSession& session) const;
    StudioResult forgetSession(StudioSession& session) const;
};

} // namespace cca::memory

#pragma once

#include <cca/memory/episodic_memory.hpp>
#include <cca/memory/long_term_memory.hpp>
#include <cca/memory/memory.hpp>
#include <cca/memory/memory_reflection.hpp>
#include <cca/memory/procedural_memory.hpp>
#include <cca/memory/semantic_memory.hpp>
#include <cca/memory/working_memory.hpp>

#include <cstddef>
#include <memory>
#include <string>
#include <vector>

namespace cca::memory {

/// Provider-neutral identity metadata scoped to one Workspace.
class ProviderDescriptor {
  public:
    ProviderDescriptor(std::string workspaceIdentifier,
                       std::string identifier);
    ~ProviderDescriptor();
    ProviderDescriptor(const ProviderDescriptor&);
    ProviderDescriptor& operator=(const ProviderDescriptor&);
    ProviderDescriptor(ProviderDescriptor&&) noexcept;
    ProviderDescriptor& operator=(ProviderDescriptor&&) noexcept;

    const std::string& workspaceIdentifier() const noexcept;
    const std::string& identifier() const noexcept;

  private:
    std::string workspace_identifier_;
    std::string identifier_;
};

/// Detached, typed snapshot of the complete Memory Providers transport scope.
class ProviderRequest {
  public:
    ProviderRequest(std::string workspaceIdentifier,
                    std::string providerIdentifier,
                    const Memory& memory,
                    const WorkingMemory& workingMemory,
                    const LongTermMemory& longTermMemory,
                    const SemanticMemory& semanticMemory,
                    const EpisodicMemory& episodicMemory,
                    const ProceduralMemory& proceduralMemory,
                    std::vector<Reflection> reflections = {});
    ~ProviderRequest();
    ProviderRequest(const ProviderRequest&);
    ProviderRequest& operator=(const ProviderRequest&);
    ProviderRequest(ProviderRequest&&) noexcept;
    ProviderRequest& operator=(ProviderRequest&&) noexcept;

    const std::string& workspaceIdentifier() const noexcept;
    const std::string& providerIdentifier() const noexcept;
    const Memory* memory() const noexcept;
    const WorkingMemory* workingMemory() const noexcept;
    const LongTermMemory* longTermMemory() const noexcept;
    const SemanticMemory* semanticMemory() const noexcept;
    const EpisodicMemory* episodicMemory() const noexcept;
    const ProceduralMemory* proceduralMemory() const noexcept;
    const std::vector<Reflection>& reflections() const noexcept;

  private:
    class Impl;
    std::unique_ptr<Impl> impl_;
};

/// Caller-owned registration and transport-stage Asset for one Workspace.
class ProviderSession {
  public:
    enum class State { Open, Exported, Imported, Forgotten };

    explicit ProviderSession(std::string workspaceIdentifier);
    ~ProviderSession();
    ProviderSession(const ProviderSession&);
    ProviderSession& operator=(const ProviderSession&) = delete;
    ProviderSession(ProviderSession&&) noexcept;
    ProviderSession& operator=(ProviderSession&&) noexcept = delete;

    const std::string& workspaceIdentifier() const noexcept;
    State state() const noexcept;
    std::size_t size() const noexcept;
    const std::vector<ProviderDescriptor>& descriptors() const noexcept;

  private:
    std::shared_ptr<const std::string> workspace_identifier_;
    State state_{State::Open};
    std::vector<ProviderDescriptor> descriptors_;

    friend class MemoryProviderEngine;
};

/// Move-only outcome of one MemoryProviderEngine operation.
class ProviderResult {
  public:
    ProviderResult(ProviderResult&&) noexcept;
    ProviderResult& operator=(ProviderResult&&) noexcept;
    ProviderResult(const ProviderResult&) = delete;
    ProviderResult& operator=(const ProviderResult&) = delete;
    ~ProviderResult();

    const std::string& workspaceIdentifier() const noexcept;
    bool succeeded() const noexcept;
    const std::string& code() const noexcept;
    const std::string& message() const noexcept;
    const ProviderRequest* request() const noexcept;
    const std::vector<ProviderDescriptor>& descriptors() const noexcept;

  private:
    ProviderResult(std::string workspaceIdentifier,
                   std::string code,
                   std::string message,
                   std::unique_ptr<ProviderRequest> request,
                   std::vector<ProviderDescriptor> descriptors);

    static ProviderResult
    success(std::string workspaceIdentifier,
            std::unique_ptr<ProviderRequest> request = nullptr,
            std::vector<ProviderDescriptor> descriptors = {});
    static ProviderResult failure(std::string workspaceIdentifier,
                                  std::string code,
                                  std::string message);

    std::string workspace_identifier_;
    std::string code_;
    std::string message_;
    std::unique_ptr<ProviderRequest> request_;
    std::vector<ProviderDescriptor> descriptors_;

    friend class MemoryProviderEngine;
};

/// Stateless Service for deterministic provider-neutral MemoryOS handoff.
class MemoryProviderEngine {
  public:
    ProviderResult
    registerProvider(ProviderSession& session,
                     const ProviderDescriptor& descriptor) const;
    ProviderResult exportState(ProviderSession& session,
                               const ProviderRequest& request) const;
    ProviderResult importState(ProviderSession& session,
                               const ProviderRequest& request) const;
    ProviderResult validate(const ProviderSession& session,
                            const ProviderRequest& request) const;
    ProviderResult enumerate(const ProviderSession& session) const;
    ProviderResult forgetSession(ProviderSession& session) const;
};

} // namespace cca::memory

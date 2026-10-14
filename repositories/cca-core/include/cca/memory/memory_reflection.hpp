#pragma once

#include <cca/memory/knowledge_retrieval.hpp>

#include <cstddef>
#include <memory>
#include <string>
#include <string_view>
#include <vector>

namespace cca::memory {

class ReflectionQuery {
  public:
    ReflectionQuery(std::string workspaceIdentifier,
                    std::string identifier,
                    std::string knowledge);

    const std::string& workspaceIdentifier() const noexcept;
    const std::string& identifier() const noexcept;
    const std::string& knowledge() const noexcept;

  private:
    std::string workspace_identifier_;
    std::string identifier_;
    std::string knowledge_;
};

class Reflection {
  public:
    ~Reflection();
    Reflection(const Reflection&);
    Reflection& operator=(const Reflection&);
    Reflection(Reflection&&) noexcept;
    Reflection& operator=(Reflection&&) noexcept;

    const std::string& workspaceIdentifier() const noexcept;
    const std::string& identifier() const noexcept;
    const std::string& knowledge() const noexcept;
    const std::vector<KnowledgeCandidate>& sourceCandidates() const noexcept;
    const std::vector<std::vector<std::string>>&
    sourceExplanationChains() const noexcept;

  private:
    Reflection(
        std::string workspaceIdentifier,
        std::string identifier,
        std::string knowledge,
        std::vector<KnowledgeCandidate> sourceCandidates,
        std::vector<std::vector<std::string>> sourceExplanationChains);

    class Impl;
    std::unique_ptr<Impl> impl_;

    friend class MemoryReflectionEngine;
};

class ReflectionSession {
  public:
    enum class State { Pristine, Prepared, Derived, Forgotten };

    explicit ReflectionSession(std::string workspaceIdentifier);
    ~ReflectionSession();
    ReflectionSession(const ReflectionSession&);
    ReflectionSession& operator=(const ReflectionSession&) = delete;
    ReflectionSession(ReflectionSession&&) noexcept;
    ReflectionSession& operator=(ReflectionSession&&) noexcept = delete;

    const std::string& workspaceIdentifier() const noexcept;
    State state() const noexcept;
    const ReflectionQuery* query() const noexcept;
    std::size_t size() const noexcept;
    const std::vector<KnowledgeCandidate>& sourceCandidates() const noexcept;
    const std::vector<std::vector<std::string>>&
    sourceExplanationChains() const noexcept;
    const Reflection* reflection() const noexcept;

  private:
    class Impl;

    std::shared_ptr<const std::string> workspace_identifier_;
    std::unique_ptr<Impl> impl_;

    friend class MemoryReflectionEngine;
};

class ReflectionResult {
  public:
    ReflectionResult(ReflectionResult&&) noexcept;
    ReflectionResult& operator=(ReflectionResult&&) noexcept;
    ReflectionResult(const ReflectionResult&) = delete;
    ReflectionResult& operator=(const ReflectionResult&) = delete;
    ~ReflectionResult();

    bool succeeded() const noexcept;
    const std::string& code() const noexcept;
    const std::string& message() const noexcept;
    const Reflection* reflection() const noexcept;
    const ReflectionSession* session() const noexcept;
    const KnowledgeCandidate* candidate() const noexcept;
    const std::vector<std::string>& explanationChain() const noexcept;

  private:
    ReflectionResult(
        bool succeeded,
        std::string code,
        std::string message,
        std::unique_ptr<Reflection> reflection,
        std::unique_ptr<ReflectionSession> session,
        std::unique_ptr<KnowledgeCandidate> candidate,
        std::vector<std::string> explanationChain);

    static ReflectionResult success(
        std::unique_ptr<Reflection> reflection = nullptr,
        std::unique_ptr<ReflectionSession> session = nullptr,
        std::unique_ptr<KnowledgeCandidate> candidate = nullptr,
        std::vector<std::string> explanationChain = {});
    static ReflectionResult failure(std::string code, std::string message);

    class Impl;
    std::unique_ptr<Impl> impl_;

    friend class MemoryReflectionEngine;
};

class MemoryReflectionEngine {
  public:
    ReflectionResult reflect(
        ReflectionSession& session,
        const ReflectionQuery& query,
        const RetrievalSession& retrievalSession) const;
    ReflectionResult derive(
        ReflectionSession& session,
        const SemanticMemory& semanticMemory,
        const EpisodicMemory& episodicMemory,
        const ProceduralMemory& proceduralMemory) const;
    ReflectionResult explain(
        const ReflectionSession& session,
        KnowledgeCandidate::Kind kind,
        std::string_view identifier) const;
    ReflectionResult validate(const ReflectionSession& session) const;
    ReflectionResult
    retrieveSession(const ReflectionSession& session) const;
    ReflectionResult forgetSession(ReflectionSession& session) const;
};

} // namespace cca::memory

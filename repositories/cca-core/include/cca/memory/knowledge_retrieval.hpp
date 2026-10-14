#pragma once

#include <cca/memory/episodic_memory.hpp>
#include <cca/memory/procedural_memory.hpp>
#include <cca/memory/semantic_memory.hpp>

#include <cstddef>
#include <cstdint>
#include <memory>
#include <string>
#include <string_view>
#include <variant>
#include <vector>

namespace cca::memory {

class KnowledgeQuery {
  public:
    explicit KnowledgeQuery(std::string text);

    const std::string& text() const noexcept;

  private:
    std::string text_;
};

class KnowledgeCandidate {
  public:
    enum class Kind {
        Semantic,
        Episodic,
        Procedural
    };

    ~KnowledgeCandidate();
    KnowledgeCandidate(const KnowledgeCandidate&);
    KnowledgeCandidate& operator=(const KnowledgeCandidate&);
    KnowledgeCandidate(KnowledgeCandidate&&) noexcept;
    KnowledgeCandidate& operator=(KnowledgeCandidate&&) noexcept;

    Kind kind() const noexcept;
    const std::string& workspaceIdentifier() const noexcept;
    const std::string& sourceIdentifier() const noexcept;
    std::uint32_t rankScore() const noexcept;
    const SemanticConcept* semanticConcept() const noexcept;
    const Episode* episode() const noexcept;
    const Procedure* procedure() const noexcept;

  private:
    using SourceValue =
        std::variant<std::monostate, SemanticConcept, Episode, Procedure>;

    KnowledgeCandidate(
        std::string workspaceIdentifier,
        SemanticConcept semanticConcept,
        std::uint32_t rankScore,
        std::vector<std::string> explanationChain);
    KnowledgeCandidate(
        std::string workspaceIdentifier,
        Episode episode,
        std::uint32_t rankScore,
        std::vector<std::string> explanationChain);
    KnowledgeCandidate(
        std::string workspaceIdentifier,
        Procedure procedure,
        std::uint32_t rankScore,
        std::vector<std::string> explanationChain);

    Kind kind_{Kind::Semantic};
    std::string workspace_identifier_;
    std::string source_identifier_;
    std::uint32_t rank_score_{};
    SourceValue source_value_;
    std::vector<std::string> explanation_chain_;

    friend class MemoryRetrievalEngine;
};

class RetrievalSession {
  public:
    explicit RetrievalSession(std::string workspaceIdentifier);
    ~RetrievalSession();
    RetrievalSession(const RetrievalSession&);
    RetrievalSession& operator=(const RetrievalSession&) = delete;
    RetrievalSession(RetrievalSession&&) noexcept;
    RetrievalSession& operator=(RetrievalSession&&) noexcept = delete;

    const std::string& workspaceIdentifier() const noexcept;
    bool started() const noexcept;
    bool forgotten() const noexcept;
    std::size_t size() const noexcept;
    const std::vector<KnowledgeCandidate>& candidates() const noexcept;

  private:
    std::shared_ptr<const std::string> workspace_identifier_;
    bool started_{};
    bool forgotten_{};
    std::vector<KnowledgeCandidate> candidates_;

    friend class MemoryRetrievalEngine;
};

class KnowledgeResult {
  public:
    KnowledgeResult(KnowledgeResult&&) noexcept;
    KnowledgeResult& operator=(KnowledgeResult&&) noexcept;
    KnowledgeResult(const KnowledgeResult&) = delete;
    KnowledgeResult& operator=(const KnowledgeResult&) = delete;
    ~KnowledgeResult();

    bool succeeded() const noexcept;
    const std::string& code() const noexcept;
    const std::string& message() const noexcept;
    const KnowledgeCandidate* candidate() const noexcept;
    const std::vector<KnowledgeCandidate>& candidates() const noexcept;
    const std::vector<std::string>& explanationChain() const noexcept;

  private:
    static constexpr std::uint8_t moved_from_status = 0U;
    static constexpr std::uint8_t ok_status = 1U;
    static constexpr std::uint8_t session_forgotten_status = 2U;
    static constexpr std::uint8_t session_already_started_status = 3U;
    static constexpr std::uint8_t session_not_started_status = 4U;
    static constexpr std::uint8_t workspace_mismatch_status = 5U;
    static constexpr std::uint8_t invalid_source_kind_status = 6U;
    static constexpr std::uint8_t invalid_identifier_status = 7U;
    static constexpr std::uint8_t not_found_status = 8U;

    KnowledgeResult(
        std::uint8_t status,
        std::unique_ptr<KnowledgeCandidate> candidate,
        std::vector<KnowledgeCandidate> candidates,
        std::vector<std::string> explanationChain);

    std::uint8_t status_{moved_from_status};
    std::unique_ptr<KnowledgeCandidate> candidate_;
    std::vector<KnowledgeCandidate> candidates_;
    std::vector<std::string> explanation_chain_;

    friend class MemoryRetrievalEngine;
};

class MemoryRetrievalEngine {
  public:
    KnowledgeResult retrieve(
        RetrievalSession& session,
        const SemanticMemory& semanticMemory,
        const EpisodicMemory& episodicMemory,
        const ProceduralMemory& proceduralMemory,
        KnowledgeCandidate::Kind kind,
        std::string_view identifier) const;
    KnowledgeResult search(
        RetrievalSession& session,
        const SemanticMemory& semanticMemory,
        const EpisodicMemory& episodicMemory,
        const ProceduralMemory& proceduralMemory,
        const KnowledgeQuery& query) const;
    KnowledgeResult filter(
        RetrievalSession& session,
        const KnowledgeQuery& query) const;
    KnowledgeResult rank(RetrievalSession& session) const;
    KnowledgeResult explain(
        const RetrievalSession& session,
        KnowledgeCandidate::Kind kind,
        std::string_view identifier) const;
    KnowledgeResult forgetSession(RetrievalSession& session) const;

  private:
    static KnowledgeResult failure(std::uint8_t status);
    static KnowledgeResult candidateSuccess(
        const KnowledgeCandidate& candidate,
        std::vector<std::string> explanationChain);
    static KnowledgeResult candidatesSuccess(
        const std::vector<KnowledgeCandidate>& candidates);
    static KnowledgeResult emptySuccess();
};

} // namespace cca::memory

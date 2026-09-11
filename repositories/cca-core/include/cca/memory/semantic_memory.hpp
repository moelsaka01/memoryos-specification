#pragma once

#include <cca/memory/long_term_memory.hpp>

#include <cstddef>
#include <memory>
#include <string>
#include <string_view>
#include <vector>

namespace cca::memory {

namespace detail {
class SemanticMemoryPersistence;
}

class SemanticConcept {
  public:
    SemanticConcept(
        std::string identifier,
        std::string meaning,
        std::vector<LongTermMemoryEntry> sourceEntries);
    ~SemanticConcept();
    SemanticConcept(const SemanticConcept&);
    SemanticConcept& operator=(const SemanticConcept&);
    SemanticConcept(SemanticConcept&&) noexcept;
    SemanticConcept& operator=(SemanticConcept&&) noexcept;

    const std::string& identifier() const noexcept;
    const std::string& meaning() const noexcept;
    const std::vector<LongTermMemoryEntry>& sourceEntries() const noexcept;
    const std::vector<std::string>& categories() const noexcept;
    const std::vector<std::string>& linkedConceptIdentifiers() const noexcept;

  private:
    std::string identifier_;
    std::string meaning_;
    std::vector<LongTermMemoryEntry> source_entries_;
    std::vector<std::string> categories_;
    std::vector<std::string> linked_concept_identifiers_;

    friend class SemanticMemoryEngine;
    friend class detail::SemanticMemoryPersistence;
};

class SemanticQuery {
  public:
    explicit SemanticQuery(std::string text);

    const std::string& text() const noexcept;

  private:
    std::string text_;
};

class SemanticMemory {
  public:
    explicit SemanticMemory(std::string workspaceIdentifier);
    ~SemanticMemory();
    SemanticMemory(const SemanticMemory&);
    SemanticMemory& operator=(const SemanticMemory&) = delete;
    SemanticMemory(SemanticMemory&&) noexcept;
    SemanticMemory& operator=(SemanticMemory&&) noexcept = delete;

    const std::string& workspaceIdentifier() const noexcept;
    std::size_t size() const noexcept;
    const SemanticConcept* find(
        std::string_view identifier) const noexcept;
    const std::vector<SemanticConcept>& concepts() const noexcept;

  private:
    std::shared_ptr<const std::string> workspace_identifier_;
    std::vector<SemanticConcept> concepts_;
    std::vector<std::string> forgotten_identifiers_;

    friend class SemanticMemoryEngine;
    friend class detail::SemanticMemoryPersistence;
};

class SemanticResult {
  public:
    SemanticResult(SemanticResult&&) noexcept;
    SemanticResult& operator=(SemanticResult&&) noexcept;
    SemanticResult(const SemanticResult&) = delete;
    SemanticResult& operator=(const SemanticResult&) = delete;
    ~SemanticResult();

    bool succeeded() const noexcept;
    const std::string& code() const noexcept;
    const std::string& message() const noexcept;
    const SemanticConcept* semanticConcept() const noexcept;
    const std::vector<SemanticConcept>& matches() const noexcept;

  private:
    SemanticResult(bool succeeded,
                   std::string code,
                   std::string message,
                   std::unique_ptr<SemanticConcept> semanticConcept,
                   std::vector<SemanticConcept> matches);

    class Impl;
    std::unique_ptr<Impl> impl_;

    friend class SemanticMemoryEngine;
};

class SemanticMemoryEngine {
  public:
    SemanticResult classify(
        SemanticMemory& memory,
        const LongTermMemory& evidence,
        SemanticConcept semanticConcept) const;
    SemanticResult categorize(
        SemanticMemory& memory,
        std::string_view conceptIdentifier,
        std::string category) const;
    SemanticResult link(
        SemanticMemory& memory,
        std::string_view firstConceptIdentifier,
        std::string_view secondConceptIdentifier) const;
    SemanticResult retrieve(
        const SemanticMemory& memory,
        std::string_view identifier) const;
    SemanticResult search(
        const SemanticMemory& memory,
        const SemanticQuery& query) const;
    SemanticResult update(
        SemanticMemory& memory,
        std::string_view identifier,
        std::string meaning) const;
    SemanticResult forget(
        SemanticMemory& memory,
        std::string_view identifier) const;
};

} // namespace cca::memory

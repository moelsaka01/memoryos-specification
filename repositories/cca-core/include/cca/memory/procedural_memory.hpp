#pragma once

#include <cca/memory/long_term_memory.hpp>

#include <cstddef>
#include <memory>
#include <string>
#include <string_view>
#include <vector>

namespace cca::memory {

namespace detail {
class ProceduralMemoryPersistence;
}

class Procedure {
  public:
    Procedure(
        std::string identifier,
        std::string activity,
        std::vector<std::string> steps,
        std::vector<LongTermMemoryEntry> sourceEntries);
    ~Procedure();
    Procedure(const Procedure&);
    Procedure& operator=(const Procedure&);
    Procedure(Procedure&&) noexcept;
    Procedure& operator=(Procedure&&) noexcept;

    const std::string& identifier() const noexcept;
    const std::string& activity() const noexcept;
    const std::vector<std::string>& steps() const noexcept;
    const std::vector<LongTermMemoryEntry>& sourceEntries() const noexcept;
    const std::vector<std::string>&
    linkedProcedureIdentifiers() const noexcept;

  private:
    std::string identifier_;
    std::string activity_;
    std::vector<std::string> steps_;
    std::vector<LongTermMemoryEntry> source_entries_;
    std::vector<std::string> linked_procedure_identifiers_;

    friend class ProceduralMemoryEngine;
    friend class detail::ProceduralMemoryPersistence;
};

class ProcedureQuery {
  public:
    explicit ProcedureQuery(std::string text);

    const std::string& text() const noexcept;

  private:
    std::string text_;
};

class ProceduralMemory {
  public:
    explicit ProceduralMemory(std::string workspaceIdentifier);
    ~ProceduralMemory();
    ProceduralMemory(const ProceduralMemory&);
    ProceduralMemory& operator=(const ProceduralMemory&) = delete;
    ProceduralMemory(ProceduralMemory&&) noexcept;
    ProceduralMemory& operator=(ProceduralMemory&&) noexcept = delete;

    const std::string& workspaceIdentifier() const noexcept;
    std::size_t size() const noexcept;
    const Procedure* find(std::string_view identifier) const noexcept;
    const std::vector<Procedure>& procedures() const noexcept;

  private:
    std::shared_ptr<const std::string> workspace_identifier_;
    std::vector<Procedure> procedures_;
    std::vector<std::string> forgotten_identifiers_;

    friend class ProceduralMemoryEngine;
    friend class detail::ProceduralMemoryPersistence;
};

class ProcedureResult {
  public:
    ProcedureResult(ProcedureResult&&) noexcept;
    ProcedureResult& operator=(ProcedureResult&&) noexcept;
    ProcedureResult(const ProcedureResult&) = delete;
    ProcedureResult& operator=(const ProcedureResult&) = delete;
    ~ProcedureResult();

    bool succeeded() const noexcept;
    const std::string& code() const noexcept;
    const std::string& message() const noexcept;
    const Procedure* procedure() const noexcept;
    const std::vector<Procedure>& matches() const noexcept;

  private:
    ProcedureResult(bool succeeded,
                    std::string code,
                    std::string message,
                    std::unique_ptr<Procedure> procedure,
                    std::vector<Procedure> matches);

    class Impl;
    std::unique_ptr<Impl> impl_;

    friend class ProceduralMemoryEngine;
};

class ProceduralMemoryEngine {
  public:
    ProcedureResult derive(
        ProceduralMemory& memory,
        const LongTermMemory& evidence,
        Procedure procedure) const;
    ProcedureResult compose(
        ProceduralMemory& memory,
        const LongTermMemory& evidence,
        Procedure procedure) const;
    ProcedureResult retrieve(
        const ProceduralMemory& memory,
        std::string_view identifier) const;
    ProcedureResult search(
        const ProceduralMemory& memory,
        const ProcedureQuery& query) const;
    ProcedureResult link(
        ProceduralMemory& memory,
        std::string_view firstProcedureIdentifier,
        std::string_view secondProcedureIdentifier) const;
    ProcedureResult update(
        ProceduralMemory& memory,
        std::string_view identifier,
        std::string activity,
        std::vector<std::string> steps) const;
    ProcedureResult forget(
        ProceduralMemory& memory,
        std::string_view identifier) const;
};

} // namespace cca::memory

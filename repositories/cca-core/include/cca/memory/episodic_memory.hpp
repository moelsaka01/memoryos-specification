#pragma once

#include <cca/memory/long_term_memory.hpp>

#include <cstddef>
#include <cstdint>
#include <memory>
#include <string>
#include <string_view>
#include <vector>

namespace cca::memory {

namespace detail {
class EpisodicMemoryPersistence;
}

class Episode {
  public:
    Episode(
        std::string identifier,
        std::string occurrence,
        std::string context,
        std::int64_t chronology,
        std::vector<LongTermMemoryEntry> sourceEntries);
    ~Episode();
    Episode(const Episode&);
    Episode& operator=(const Episode&);
    Episode(Episode&&) noexcept;
    Episode& operator=(Episode&&) noexcept;

    const std::string& identifier() const noexcept;
    const std::string& occurrence() const noexcept;
    const std::string& context() const noexcept;
    std::int64_t chronology() const noexcept;
    const std::vector<LongTermMemoryEntry>& sourceEntries() const noexcept;
    const std::vector<std::string>&
    linkedEpisodeIdentifiers() const noexcept;

  private:
    std::string identifier_;
    std::string occurrence_;
    std::string context_;
    std::int64_t chronology_{};
    std::vector<LongTermMemoryEntry> source_entries_;
    std::vector<std::string> linked_episode_identifiers_;

    friend class EpisodicMemoryEngine;
    friend class detail::EpisodicMemoryPersistence;
};

class EpisodeQuery {
  public:
    explicit EpisodeQuery(std::string text);

    const std::string& text() const noexcept;

  private:
    std::string text_;
};

class EpisodicMemory {
  public:
    explicit EpisodicMemory(std::string workspaceIdentifier);
    ~EpisodicMemory();
    EpisodicMemory(const EpisodicMemory&);
    EpisodicMemory& operator=(const EpisodicMemory&) = delete;
    EpisodicMemory(EpisodicMemory&&) noexcept;
    EpisodicMemory& operator=(EpisodicMemory&&) noexcept = delete;

    const std::string& workspaceIdentifier() const noexcept;
    std::size_t size() const noexcept;
    const Episode* find(std::string_view identifier) const noexcept;
    const std::vector<Episode>& episodes() const noexcept;

  private:
    std::shared_ptr<const std::string> workspace_identifier_;
    std::vector<Episode> episodes_;
    std::vector<std::string> forgotten_identifiers_;

    friend class EpisodicMemoryEngine;
    friend class detail::EpisodicMemoryPersistence;
};

class EpisodeResult {
  public:
    EpisodeResult(EpisodeResult&&) noexcept;
    EpisodeResult& operator=(EpisodeResult&&) noexcept;
    EpisodeResult(const EpisodeResult&) = delete;
    EpisodeResult& operator=(const EpisodeResult&) = delete;
    ~EpisodeResult();

    bool succeeded() const noexcept;
    const std::string& code() const noexcept;
    const std::string& message() const noexcept;
    const Episode* episode() const noexcept;
    const std::vector<Episode>& matches() const noexcept;

  private:
    EpisodeResult(bool succeeded,
                  std::string code,
                  std::string message,
                  std::unique_ptr<Episode> episode,
                  std::vector<Episode> matches);

    class Impl;
    std::unique_ptr<Impl> impl_;

    friend class EpisodicMemoryEngine;
};

class EpisodicMemoryEngine {
  public:
    EpisodeResult record(
        EpisodicMemory& memory,
        const LongTermMemory& evidence,
        Episode episode) const;
    EpisodeResult derive(
        EpisodicMemory& memory,
        const LongTermMemory& evidence,
        Episode episode) const;
    EpisodeResult retrieve(
        const EpisodicMemory& memory,
        std::string_view identifier) const;
    EpisodeResult search(
        const EpisodicMemory& memory,
        const EpisodeQuery& query) const;
    EpisodeResult link(
        EpisodicMemory& memory,
        std::string_view firstEpisodeIdentifier,
        std::string_view secondEpisodeIdentifier) const;
    EpisodeResult update(
        EpisodicMemory& memory,
        std::string_view identifier,
        std::string occurrence,
        std::string context) const;
    EpisodeResult forget(
        EpisodicMemory& memory,
        std::string_view identifier) const;
};

} // namespace cca::memory

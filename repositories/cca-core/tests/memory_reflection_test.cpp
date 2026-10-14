#include <cca/memory/memory_reflection.hpp>

#include <gtest/gtest.h>

#include <cstddef>
#include <cstdint>
#include <future>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <type_traits>
#include <utility>
#include <vector>

/*
CCA-REFLECT-1.0 requirement coverage
------------------------------------
CCA-REFLECT-001: MemoryReflectionBoundaryTest.WorkspacesSourcesAndServicesRemainIsolated
CCA-REFLECT-002: MemoryReflectionLifecycleTest.SuccessfulLifecycleIsExact
CCA-REFLECT-003: MemoryReflectionApiTest.PublicDeclarationsMatchContract
CCA-REFLECT-004: MemoryReflectionApiTest.PublicDeclarationsMatchContract
CCA-REFLECT-005: MemoryReflectionBoundaryTest.WorkspacesSourcesAndServicesRemainIsolated
CCA-REFLECT-006: MemoryReflectionOwnershipTest.ConstructionWorkspaceAndPristineStateAreExact
CCA-REFLECT-007: MemoryReflectionOwnershipTest.ConstructionWorkspaceAndPristineStateAreExact
CCA-REFLECT-008: MemoryReflectionOwnershipTest.ConstructionWorkspaceAndPristineStateAreExact
CCA-REFLECT-009: MemoryReflectionLifecycleTest.SuccessfulLifecycleIsExact
CCA-REFLECT-010: MemoryReflectionLifecycleTest.SuccessfulLifecycleIsExact
CCA-REFLECT-011: MemoryReflectionSessionTest.RetrieveDeepCopiesEveryState
CCA-REFLECT-012: MemoryReflectionApiTest.PublicDeclarationsMatchContract
CCA-REFLECT-013: MemoryReflectionPreparationTest.CapturesEveryRankedCandidateAndExactChain
CCA-REFLECT-014: MemoryReflectionProvenanceTest.CompleteTypedEvidenceIsPreserved
                 and ValidEmptyLongTermValuesRemainCompleteAcrossAllKinds
CCA-REFLECT-015: MemoryReflectionPreparationTest.CapturesEveryRankedCandidateAndExactChain
CCA-REFLECT-016: MemoryReflectionPrecedenceTest.ReflectAndDerivePrecedenceIsExact
CCA-REFLECT-017: MemoryReflectionIdentityTest.TargetFieldsAndSourceDistinctnessAreExact
CCA-REFLECT-018: MemoryReflectionIdentityTest.TargetFieldsAndSourceDistinctnessAreExact
CCA-REFLECT-019: MemoryReflectionAccessibilityTest.DetachedPreparationRequiresLaterLiveRevalidation
CCA-REFLECT-020: MemoryReflectionDriftTest.AllKindsDetectCompleteSourceChangesAndAbsence
CCA-REFLECT-021: MemoryReflectionAccessibilityTest.DerivationLeavesEverySourceBaseStateUnchanged
CCA-REFLECT-022: MemoryReflectionIsolationTest.SourceAndReflectionLifecyclesNeverCascade
CCA-REFLECT-023: MemoryReflectionPreparationTest.CapturesEveryRankedCandidateAndExactChain
CCA-REFLECT-024: MemoryReflectionDerivationTest.PublishesCompleteIndependentReflections
CCA-REFLECT-025: MemoryReflectionDerivationTest.PublishesCompleteIndependentReflections
CCA-REFLECT-026: MemoryReflectionExplainTest.CompositeLookupIsExactAndObservational
CCA-REFLECT-027: MemoryReflectionValidationTest.PreparedAndDerivedValidationIsObservational
CCA-REFLECT-028: MemoryReflectionSessionTest.RetrieveDeepCopiesEveryState
CCA-REFLECT-029: MemoryReflectionLifecycleTest.ForgettingEveryStateIsTerminalAndIsolated
CCA-REFLECT-030: MemoryReflectionLifecycleTest.WrongStageAndRepeatedOperationsAreExact
CCA-REFLECT-031: MemoryReflectionResultTest.AllCodesMessagesAndPayloadsAreClosed
CCA-REFLECT-032: MemoryReflectionResultTest.SuccessPayloadShapesAreExact
CCA-REFLECT-033: MemoryReflectionPrecedenceTest.ReflectAndDerivePrecedenceIsExact
CCA-REFLECT-034: MemoryReflectionValueTest.CopyMoveAndLifetimeContractsAreExact
CCA-REFLECT-035: MemoryReflectionBoundaryTest.WorkspacesSourcesAndServicesRemainIsolated
CCA-REFLECT-036: MemoryReflectionFailureTest.SemanticFailuresPreserveCompleteState
                 and MemoryReflectionAllocationFailureTest (dedicated executable)
CCA-REFLECT-037: MemoryReflectionDeterminismTest.EquivalentHistoriesAreCompletelyEqual
CCA-REFLECT-038: MemoryReflectionConcurrencyTest.IndependentValuesSupportConcurrentUse
CCA-REFLECT-039: MemoryReflectionIsolationTest.SourceAndReflectionLifecyclesNeverCascade
CCA-REFLECT-040: MemoryReflectionBoundaryTest.WorkspacesSourcesAndServicesRemainIsolated
CCA-REFLECT-041: architecture review
CCA-REFLECT-042: architecture review
CCA-REFLECT-043: MemoryReflectionBoundaryTest.NoExcludedBehaviorIsObservable
CCA-REFLECT-044: documentation and executable-example review
CCA-REFLECT-045: this mapping, architecture review, and C++23 warnings-as-errors gate
*/

namespace {

using cca::memory::Episode;
using cca::memory::EpisodicMemory;
using cca::memory::EpisodicMemoryEngine;
using cca::memory::KnowledgeCandidate;
using cca::memory::KnowledgeQuery;
using cca::memory::LongTermMemory;
using cca::memory::LongTermMemoryEngine;
using cca::memory::LongTermMemoryEntry;
using cca::memory::MemoryReflectionEngine;
using cca::memory::MemoryRetrievalEngine;
using cca::memory::Procedure;
using cca::memory::ProceduralMemory;
using cca::memory::ProceduralMemoryEngine;
using cca::memory::Reflection;
using cca::memory::ReflectionQuery;
using cca::memory::ReflectionResult;
using cca::memory::ReflectionSession;
using cca::memory::RetrievalSession;
using cca::memory::SemanticConcept;
using cca::memory::SemanticMemory;
using cca::memory::SemanticMemoryEngine;

using Kind = KnowledgeCandidate::Kind;
using State = ReflectionSession::State;

constexpr std::string_view workspace{"reflection-workspace"};
constexpr std::string_view target_identifier{"reflection-target"};
constexpr std::string_view target_knowledge{"Explicit Knowledge: Case Preserved"};

struct EntrySnapshot final {
    std::string identifier;
    std::string value;
    bool archived;
    bool operator==(const EntrySnapshot&) const = default;
};

struct SemanticSnapshot final {
    std::string identifier;
    std::string meaning;
    std::vector<EntrySnapshot> sources;
    std::vector<std::string> categories;
    std::vector<std::string> links;
    bool operator==(const SemanticSnapshot&) const = default;
};

struct EpisodeSnapshot final {
    std::string identifier;
    std::string occurrence;
    std::string context;
    std::int64_t chronology;
    std::vector<EntrySnapshot> sources;
    std::vector<std::string> links;
    bool operator==(const EpisodeSnapshot&) const = default;
};

struct ProcedureSnapshot final {
    std::string identifier;
    std::string activity;
    std::vector<std::string> steps;
    std::vector<EntrySnapshot> sources;
    std::vector<std::string> links;
    bool operator==(const ProcedureSnapshot&) const = default;
};

struct CandidateSnapshot final {
    Kind kind;
    std::string workspace_identifier;
    std::string source_identifier;
    std::uint32_t rank_score;
    std::optional<SemanticSnapshot> semantic;
    std::optional<EpisodeSnapshot> episode;
    std::optional<ProcedureSnapshot> procedure;
    bool operator==(const CandidateSnapshot&) const = default;
};

struct ReflectionSnapshot final {
    std::string workspace_identifier;
    std::string identifier;
    std::string knowledge;
    std::vector<CandidateSnapshot> candidates;
    std::vector<std::vector<std::string>> chains;
    bool operator==(const ReflectionSnapshot&) const = default;
};

struct ReflectionSessionSnapshot final {
    std::string workspace_identifier;
    State state;
    std::optional<std::vector<std::string>> query;
    std::vector<CandidateSnapshot> candidates;
    std::vector<std::vector<std::string>> chains;
    std::optional<ReflectionSnapshot> reflection;
    bool operator==(const ReflectionSessionSnapshot&) const = default;
};

struct SourceSnapshot final {
    std::string workspace_identifier;
    std::vector<SemanticSnapshot> semantic;
    std::vector<EpisodeSnapshot> episodic;
    std::vector<ProcedureSnapshot> procedural;
    bool operator==(const SourceSnapshot&) const = default;
};

[[nodiscard]] EntrySnapshot snapshot_of(const LongTermMemoryEntry& value) {
    return {value.identifier(), value.value(), value.archived()};
}

[[nodiscard]] std::vector<EntrySnapshot> snapshot_entries(
    const std::vector<LongTermMemoryEntry>& values) {
    std::vector<EntrySnapshot> result;
    result.reserve(values.size());
    for (const auto& value : values) {
        result.push_back(snapshot_of(value));
    }
    return result;
}

[[nodiscard]] SemanticSnapshot snapshot_of(const SemanticConcept& value) {
    return {value.identifier(), value.meaning(), snapshot_entries(value.sourceEntries()),
            value.categories(), value.linkedConceptIdentifiers()};
}

[[nodiscard]] EpisodeSnapshot snapshot_of(const Episode& value) {
    return {value.identifier(), value.occurrence(), value.context(),
            value.chronology(), snapshot_entries(value.sourceEntries()),
            value.linkedEpisodeIdentifiers()};
}

[[nodiscard]] ProcedureSnapshot snapshot_of(const Procedure& value) {
    return {value.identifier(), value.activity(), value.steps(),
            snapshot_entries(value.sourceEntries()),
            value.linkedProcedureIdentifiers()};
}

[[nodiscard]] CandidateSnapshot snapshot_of(const KnowledgeCandidate& value) {
    std::optional<SemanticSnapshot> semantic;
    std::optional<EpisodeSnapshot> episode;
    std::optional<ProcedureSnapshot> procedure;
    if (value.semanticConcept() != nullptr) {
        semantic = snapshot_of(*value.semanticConcept());
    }
    if (value.episode() != nullptr) {
        episode = snapshot_of(*value.episode());
    }
    if (value.procedure() != nullptr) {
        procedure = snapshot_of(*value.procedure());
    }
    return {value.kind(), value.workspaceIdentifier(), value.sourceIdentifier(),
            value.rankScore(), std::move(semantic), std::move(episode),
            std::move(procedure)};
}

template <typename T, typename Snapshot>
[[nodiscard]] std::vector<Snapshot> snapshot_vector(
    const std::vector<T>& values, Snapshot (*function)(const T&)) {
    std::vector<Snapshot> result;
    result.reserve(values.size());
    for (const auto& value : values) {
        result.push_back(function(value));
    }
    return result;
}

[[nodiscard]] ReflectionSnapshot snapshot_of(const Reflection& value) {
    return {value.workspaceIdentifier(), value.identifier(), value.knowledge(),
            snapshot_vector<KnowledgeCandidate, CandidateSnapshot>(
                value.sourceCandidates(), snapshot_of),
            value.sourceExplanationChains()};
}

[[nodiscard]] ReflectionSessionSnapshot snapshot_of(
    const ReflectionSession& value) {
    std::optional<std::vector<std::string>> query;
    if (value.query() != nullptr) {
        query = std::vector<std::string>{value.query()->workspaceIdentifier(),
                                         value.query()->identifier(),
                                         value.query()->knowledge()};
    }
    std::optional<ReflectionSnapshot> reflection;
    if (value.reflection() != nullptr) {
        reflection = snapshot_of(*value.reflection());
    }
    return {value.workspaceIdentifier(), value.state(), std::move(query),
            snapshot_vector<KnowledgeCandidate, CandidateSnapshot>(
                value.sourceCandidates(), snapshot_of),
            value.sourceExplanationChains(), std::move(reflection)};
}

void require_ok(const bool succeeded,
                const std::string_view code,
                const std::string_view message) {
    if (!succeeded) {
        throw std::logic_error{std::string{code} + ": " + std::string{message}};
    }
}

template <typename Result>
void require_ok(const Result& result) {
    require_ok(result.succeeded(), result.code(), result.message());
}

class Sources final {
  public:
    explicit Sources(const std::string_view workspace_identifier)
        : evidence{std::string{workspace_identifier}},
          semantic{std::string{workspace_identifier}},
          episodic{std::string{workspace_identifier}},
          procedural{std::string{workspace_identifier}} {}

    void retain(std::string identifier, std::string value) {
        const auto result = LongTermMemoryEngine{}.retain(
            evidence, LongTermMemoryEntry{std::move(identifier), std::move(value)});
        require_ok(result);
    }

    [[nodiscard]] const LongTermMemoryEntry& entry(
        const std::string_view identifier) const {
        const auto* const result = evidence.find(identifier);
        if (result == nullptr) {
            throw std::logic_error{"missing fixture evidence"};
        }
        return *result;
    }

    void add_semantic(std::string identifier,
                      std::string meaning,
                      const std::vector<std::string_view>& provenance) {
        std::vector<LongTermMemoryEntry> entries;
        for (const auto identifier_value : provenance) {
            entries.push_back(entry(identifier_value));
        }
        const auto result = SemanticMemoryEngine{}.classify(
            semantic, evidence,
            SemanticConcept{std::move(identifier), std::move(meaning),
                            std::move(entries)});
        require_ok(result);
    }

    void add_episode(std::string identifier,
                     std::string occurrence,
                     std::string context,
                     const std::int64_t chronology,
                     const std::vector<std::string_view>& provenance) {
        std::vector<LongTermMemoryEntry> entries;
        for (const auto identifier_value : provenance) {
            entries.push_back(entry(identifier_value));
        }
        const auto result = EpisodicMemoryEngine{}.derive(
            episodic, evidence,
            Episode{std::move(identifier), std::move(occurrence),
                    std::move(context), chronology, std::move(entries)});
        require_ok(result);
    }

    void add_procedure(std::string identifier,
                       std::string activity,
                       std::vector<std::string> steps,
                       const std::vector<std::string_view>& provenance) {
        std::vector<LongTermMemoryEntry> entries;
        for (const auto identifier_value : provenance) {
            entries.push_back(entry(identifier_value));
        }
        const auto result = ProceduralMemoryEngine{}.derive(
            procedural, evidence,
            Procedure{std::move(identifier), std::move(activity),
                      std::move(steps), std::move(entries)});
        require_ok(result);
    }

    LongTermMemory evidence;
    SemanticMemory semantic;
    EpisodicMemory episodic;
    ProceduralMemory procedural;
};

[[nodiscard]] SourceSnapshot snapshot_of(const Sources& value) {
    return {value.semantic.workspaceIdentifier(),
            snapshot_vector<SemanticConcept, SemanticSnapshot>(
                value.semantic.concepts(), snapshot_of),
            snapshot_vector<Episode, EpisodeSnapshot>(value.episodic.episodes(),
                                                       snapshot_of),
            snapshot_vector<Procedure, ProcedureSnapshot>(
                value.procedural.procedures(), snapshot_of)};
}

void populate(Sources& sources) {
    sources.retain("evidence-a", "Evidence A");
    sources.retain("evidence-b", "Evidence B");
    sources.retain("evidence-c", "Evidence C");

    sources.add_semantic("shared", "semantic alpha", {"evidence-a", "evidence-b"});
    sources.add_semantic("semantic-beta", "semantic beta", {"evidence-c"});
    require_ok(SemanticMemoryEngine{}.categorize(
        sources.semantic, "shared", "category-a"));
    require_ok(SemanticMemoryEngine{}.categorize(
        sources.semantic, "shared", "category-b"));
    require_ok(SemanticMemoryEngine{}.link(
        sources.semantic, "shared", "semantic-beta"));

    sources.add_episode("shared", "episode alpha", "context alpha", 10,
                        {"evidence-a"});
    sources.add_episode("episode-beta", "episode beta", "context beta", 20,
                        {"evidence-b", "evidence-c"});
    require_ok(EpisodicMemoryEngine{}.link(
        sources.episodic, "shared", "episode-beta"));

    sources.add_procedure("shared", "procedure alpha", {"step-a", "step-b"},
                          {"evidence-c"});
    sources.add_procedure("procedure-beta", "procedure beta", {"step-c"},
                          {"evidence-b"});
    require_ok(ProceduralMemoryEngine{}.link(
        sources.procedural, "shared", "procedure-beta"));
}

[[nodiscard]] std::vector<std::vector<std::string>> retrieval_chains(
    const RetrievalSession& session) {
    std::vector<std::vector<std::string>> chains;
    for (const auto& candidate : session.candidates()) {
        const auto result = MemoryRetrievalEngine{}.explain(
            session, candidate.kind(), candidate.sourceIdentifier());
        require_ok(result);
        chains.push_back(result.explanationChain());
    }
    return chains;
}

struct Fixture final {
    Sources sources{workspace};
    RetrievalSession retrieval{std::string{workspace}};
    ReflectionSession session{std::string{workspace}};
    ReflectionQuery query{std::string{workspace}, std::string{target_identifier},
                          std::string{target_knowledge}};
    MemoryReflectionEngine engine;

    Fixture() {
        populate(sources);
        require_ok(MemoryRetrievalEngine{}.search(
            retrieval, sources.semantic, sources.episodic, sources.procedural,
            KnowledgeQuery{""}));
        require_ok(MemoryRetrievalEngine{}.rank(retrieval));
    }
};

void expect_failure(const ReflectionResult& result,
                    const std::string_view code) {
    EXPECT_FALSE(result.succeeded());
    EXPECT_EQ(result.code(), code);
    EXPECT_FALSE(result.message().empty());
    EXPECT_EQ(result.reflection(), nullptr);
    EXPECT_EQ(result.session(), nullptr);
    EXPECT_EQ(result.candidate(), nullptr);
    EXPECT_TRUE(result.explanationChain().empty());
}

void expect_ok(const ReflectionResult& result) {
    EXPECT_TRUE(result.succeeded()) << result.code() << ": " << result.message();
    EXPECT_EQ(result.code(), "OK");
    EXPECT_TRUE(result.message().empty());
}

void expect_no_payload(const ReflectionResult& result) {
    EXPECT_EQ(result.reflection(), nullptr);
    EXPECT_EQ(result.session(), nullptr);
    EXPECT_EQ(result.candidate(), nullptr);
    EXPECT_TRUE(result.explanationChain().empty());
}

void prepare(Fixture& fixture) {
    const auto result = fixture.engine.reflect(
        fixture.session, fixture.query, fixture.retrieval);
    require_ok(result);
}

[[nodiscard]] ReflectionResult derive(Fixture& fixture) {
    return fixture.engine.derive(fixture.session, fixture.sources.semantic,
                                 fixture.sources.episodic,
                                 fixture.sources.procedural);
}

TEST(MemoryReflectionApiTest, PublicDeclarationsMatchContract) {
    static_assert(std::is_constructible_v<ReflectionQuery, std::string,
                                          std::string, std::string>);
    static_assert(!std::is_default_constructible_v<Reflection>);
    static_assert(std::is_copy_constructible_v<Reflection>);
    static_assert(std::is_copy_assignable_v<Reflection>);
    static_assert(std::is_nothrow_move_constructible_v<Reflection>);
    static_assert(std::is_nothrow_move_assignable_v<Reflection>);
    static_assert(std::is_constructible_v<ReflectionSession, std::string>);
    static_assert(std::is_copy_constructible_v<ReflectionSession>);
    static_assert(!std::is_copy_assignable_v<ReflectionSession>);
    static_assert(std::is_nothrow_move_constructible_v<ReflectionSession>);
    static_assert(!std::is_move_assignable_v<ReflectionSession>);
    static_assert(!std::is_default_constructible_v<ReflectionResult>);
    static_assert(!std::is_copy_constructible_v<ReflectionResult>);
    static_assert(!std::is_copy_assignable_v<ReflectionResult>);
    static_assert(std::is_nothrow_move_constructible_v<ReflectionResult>);
    static_assert(std::is_nothrow_move_assignable_v<ReflectionResult>);
    static_assert(std::is_empty_v<MemoryReflectionEngine>);
    static_assert(State::Pristine != State::Prepared);
    static_assert(State::Prepared != State::Derived);
    static_assert(State::Derived != State::Forgotten);

    using Reflect = ReflectionResult (MemoryReflectionEngine::*)(
        ReflectionSession&, const ReflectionQuery&, const RetrievalSession&) const;
    using Derive = ReflectionResult (MemoryReflectionEngine::*)(
        ReflectionSession&, const SemanticMemory&, const EpisodicMemory&,
        const ProceduralMemory&) const;
    using Explain = ReflectionResult (MemoryReflectionEngine::*)(
        const ReflectionSession&, Kind, std::string_view) const;
    using Observe = ReflectionResult (MemoryReflectionEngine::*)(
        const ReflectionSession&) const;
    using Forget = ReflectionResult (MemoryReflectionEngine::*)(
        ReflectionSession&) const;
    static_assert(std::is_same_v<decltype(static_cast<Reflect>(
                                     &MemoryReflectionEngine::reflect)), Reflect>);
    static_assert(std::is_same_v<decltype(static_cast<Derive>(
                                     &MemoryReflectionEngine::derive)), Derive>);
    static_assert(std::is_same_v<decltype(static_cast<Explain>(
                                     &MemoryReflectionEngine::explain)), Explain>);
    static_assert(std::is_same_v<decltype(static_cast<Observe>(
                                     &MemoryReflectionEngine::validate)), Observe>);
    static_assert(std::is_same_v<decltype(static_cast<Observe>(
                                     &MemoryReflectionEngine::retrieveSession)), Observe>);
    static_assert(std::is_same_v<decltype(static_cast<Forget>(
                                     &MemoryReflectionEngine::forgetSession)), Forget>);
}

TEST(MemoryReflectionOwnershipTest,
     ConstructionWorkspaceAndPristineStateAreExact) {
    EXPECT_THROW((ReflectionQuery{"", "id", "knowledge"}),
                 std::invalid_argument);
    EXPECT_THROW((ReflectionSession{""}), std::invalid_argument);
    ReflectionQuery query{"workspace", "", ""};
    EXPECT_EQ(query.workspaceIdentifier(), "workspace");
    EXPECT_TRUE(query.identifier().empty());
    EXPECT_TRUE(query.knowledge().empty());
    ReflectionSession session{"workspace"};
    EXPECT_EQ(session.workspaceIdentifier(), "workspace");
    EXPECT_EQ(session.state(), State::Pristine);
    EXPECT_EQ(session.query(), nullptr);
    EXPECT_EQ(session.reflection(), nullptr);
    EXPECT_EQ(session.size(), 0U);
    EXPECT_TRUE(session.sourceCandidates().empty());
    EXPECT_TRUE(session.sourceExplanationChains().empty());
}

TEST(MemoryReflectionLifecycleTest, SuccessfulLifecycleIsExact) {
    Fixture fixture;
    const auto sources_before = snapshot_of(fixture.sources);
    const auto retrieval_before = fixture.retrieval.candidates().size();
    auto reflected = fixture.engine.reflect(
        fixture.session, fixture.query, fixture.retrieval);
    expect_ok(reflected);
    expect_no_payload(reflected);
    EXPECT_EQ(fixture.session.state(), State::Prepared);
    ASSERT_NE(fixture.session.query(), nullptr);
    EXPECT_EQ(fixture.session.reflection(), nullptr);
    EXPECT_EQ(fixture.session.size(), fixture.retrieval.size());
    EXPECT_EQ(snapshot_of(fixture.sources), sources_before);
    EXPECT_EQ(fixture.retrieval.size(), retrieval_before);

    auto derived = derive(fixture);
    expect_ok(derived);
    ASSERT_NE(derived.reflection(), nullptr);
    EXPECT_EQ(fixture.session.state(), State::Derived);
    ASSERT_NE(fixture.session.reflection(), nullptr);
    EXPECT_EQ(snapshot_of(*derived.reflection()),
              snapshot_of(*fixture.session.reflection()));
    EXPECT_NE(derived.reflection(), fixture.session.reflection());
    EXPECT_EQ(snapshot_of(fixture.sources), sources_before);
}

TEST(MemoryReflectionPreparationTest,
     CapturesEveryRankedCandidateAndExactChain) {
    Fixture fixture;
    const auto expected_chains = retrieval_chains(fixture.retrieval);
    const auto retrieval_before = fixture.retrieval.candidates().size();
    const auto result = fixture.engine.reflect(
        fixture.session, fixture.query, fixture.retrieval);
    expect_ok(result);
    EXPECT_EQ(fixture.session.size(), retrieval_before);
    ASSERT_EQ(fixture.session.sourceCandidates().size(),
              fixture.retrieval.candidates().size());
    for (std::size_t index = 0; index < fixture.retrieval.size(); ++index) {
        EXPECT_EQ(snapshot_of(fixture.session.sourceCandidates()[index]),
                  snapshot_of(fixture.retrieval.candidates()[index]));
    }
    EXPECT_EQ(fixture.session.sourceExplanationChains(), expected_chains);

    Fixture filtered_fixture;
    require_ok(MemoryRetrievalEngine{}.filter(
        filtered_fixture.retrieval, KnowledgeQuery{"semantic"}));
    const auto filtered_chains = retrieval_chains(filtered_fixture.retrieval);
    require_ok(filtered_fixture.engine.reflect(
        filtered_fixture.session, filtered_fixture.query,
        filtered_fixture.retrieval));
    ASSERT_EQ(filtered_fixture.session.size(), 2U);
    EXPECT_EQ(filtered_fixture.session.sourceExplanationChains(),
              filtered_chains);
    for (const auto& candidate :
         filtered_fixture.session.sourceCandidates()) {
        EXPECT_EQ(candidate.kind(), Kind::Semantic);
    }

    Sources sources{workspace};
    populate(sources);
    RetrievalSession empty{std::string{workspace}};
    require_ok(MemoryRetrievalEngine{}.search(
        empty, sources.semantic, sources.episodic, sources.procedural,
        KnowledgeQuery{"no-match-at-all"}));
    ReflectionSession session{std::string{workspace}};
    expect_failure(MemoryReflectionEngine{}.reflect(
                       session,
                       ReflectionQuery{std::string{workspace}, "target", "knowledge"},
                       empty),
                   "NO_SOURCES");
    EXPECT_EQ(session.state(), State::Pristine);
}

TEST(MemoryReflectionProvenanceTest, CompleteTypedEvidenceIsPreserved) {
    Fixture fixture;
    prepare(fixture);
    const auto result = derive(fixture);
    require_ok(result);
    ASSERT_NE(result.reflection(), nullptr);
    ASSERT_EQ(result.reflection()->sourceCandidates().size(),
              fixture.retrieval.candidates().size());
    for (std::size_t index = 0; index < fixture.retrieval.size(); ++index) {
        EXPECT_EQ(snapshot_of(result.reflection()->sourceCandidates()[index]),
                  snapshot_of(fixture.retrieval.candidates()[index]));
    }
    EXPECT_EQ(result.reflection()->sourceExplanationChains(),
              retrieval_chains(fixture.retrieval));
    EXPECT_EQ(result.reflection()->workspaceIdentifier(), workspace);
    EXPECT_EQ(result.reflection()->identifier(), target_identifier);
    EXPECT_EQ(result.reflection()->knowledge(), target_knowledge);
}

TEST(MemoryReflectionProvenanceTest,
     ValidEmptyLongTermValuesRemainCompleteAcrossAllKinds) {
    Sources sources{workspace};
    sources.retain("empty-evidence", "");
    sources.add_semantic("empty-semantic", "meaning", {"empty-evidence"});
    sources.add_episode("empty-episode", "occurrence", "context", 1,
                        {"empty-evidence"});
    sources.add_procedure("empty-procedure", "activity", {"step"},
                          {"empty-evidence"});

    RetrievalSession retrieval{std::string{workspace}};
    require_ok(MemoryRetrievalEngine{}.search(
        retrieval, sources.semantic, sources.episodic, sources.procedural,
        KnowledgeQuery{""}));
    ReflectionSession session{std::string{workspace}};
    ReflectionQuery query{std::string{workspace}, "empty-value-reflection",
                          "explicit knowledge"};
    MemoryReflectionEngine engine;
    require_ok(engine.reflect(session, query, retrieval));
    const auto result = engine.derive(
        session, sources.semantic, sources.episodic, sources.procedural);
    require_ok(result);
    ASSERT_NE(result.reflection(), nullptr);
    ASSERT_EQ(result.reflection()->sourceCandidates().size(), 3U);
    for (const auto& candidate : result.reflection()->sourceCandidates()) {
        const std::vector<LongTermMemoryEntry>* entries = nullptr;
        if (candidate.semanticConcept() != nullptr) {
            entries = &candidate.semanticConcept()->sourceEntries();
        } else if (candidate.episode() != nullptr) {
            entries = &candidate.episode()->sourceEntries();
        } else if (candidate.procedure() != nullptr) {
            entries = &candidate.procedure()->sourceEntries();
        }
        ASSERT_NE(entries, nullptr);
        ASSERT_EQ(entries->size(), 1U);
        EXPECT_EQ(entries->front().identifier(), "empty-evidence");
        EXPECT_TRUE(entries->front().value().empty());
    }
}

TEST(MemoryReflectionIdentityTest, TargetFieldsAndSourceDistinctnessAreExact) {
    Fixture fixture;
    ReflectionSession empty_id{std::string{workspace}};
    expect_failure(fixture.engine.reflect(
                       empty_id,
                       ReflectionQuery{std::string{workspace}, "", "knowledge"},
                       fixture.retrieval),
                   "INVALID_IDENTIFIER");
    ReflectionSession empty_knowledge{std::string{workspace}};
    expect_failure(fixture.engine.reflect(
                       empty_knowledge,
                       ReflectionQuery{std::string{workspace}, "target", ""},
                       fixture.retrieval),
                   "INVALID_KNOWLEDGE");
    ReflectionSession conflict{std::string{workspace}};
    expect_failure(fixture.engine.reflect(
                       conflict,
                       ReflectionQuery{std::string{workspace}, "shared", "knowledge"},
                       fixture.retrieval),
                   "IDENTITY_CONFLICT");
    prepare(fixture);
    const auto result = derive(fixture);
    require_ok(result);
    ASSERT_NE(result.reflection(), nullptr);
    EXPECT_EQ(result.reflection()->knowledge(), target_knowledge);
}

TEST(MemoryReflectionDerivationTest,
     PublishesCompleteIndependentReflections) {
    Fixture fixture;
    prepare(fixture);
    auto result = derive(fixture);
    require_ok(result);
    ASSERT_NE(result.reflection(), nullptr);
    ASSERT_NE(fixture.session.reflection(), nullptr);
    Reflection detached{*result.reflection()};
    const auto expected = snapshot_of(detached);
    auto forgotten = fixture.engine.forgetSession(fixture.session);
    require_ok(forgotten);
    EXPECT_EQ(snapshot_of(detached), expected);
    EXPECT_EQ(fixture.session.state(), State::Forgotten);
    EXPECT_EQ(fixture.session.reflection(), nullptr);
}

TEST(MemoryReflectionExplainTest, CompositeLookupIsExactAndObservational) {
    Fixture fixture;
    prepare(fixture);
    require_ok(derive(fixture));
    const auto before = snapshot_of(fixture.session);
    for (const auto kind : {Kind::Semantic, Kind::Episodic, Kind::Procedural}) {
        const auto result = fixture.engine.explain(fixture.session, kind, "shared");
        expect_ok(result);
        ASSERT_NE(result.candidate(), nullptr);
        EXPECT_EQ(result.candidate()->kind(), kind);
        EXPECT_EQ(result.candidate()->sourceIdentifier(), "shared");
        EXPECT_FALSE(result.explanationChain().empty());
    }
    expect_failure(fixture.engine.explain(
                       fixture.session, static_cast<Kind>(999), "shared"),
                   "INVALID_SOURCE_KIND");
    expect_failure(fixture.engine.explain(fixture.session, Kind::Semantic, ""),
                   "INVALID_IDENTIFIER");
    expect_failure(fixture.engine.explain(
                       fixture.session, Kind::Semantic, "absent"),
                   "SOURCE_NOT_FOUND");
    EXPECT_EQ(snapshot_of(fixture.session), before);
}

TEST(MemoryReflectionValidationTest,
     PreparedAndDerivedValidationIsObservational) {
    Fixture fixture;
    expect_failure(fixture.engine.validate(fixture.session),
                   "SESSION_NOT_PREPARED");
    prepare(fixture);
    const auto prepared = snapshot_of(fixture.session);
    expect_ok(fixture.engine.validate(fixture.session));
    EXPECT_EQ(snapshot_of(fixture.session), prepared);
    require_ok(derive(fixture));
    const auto derived_before = snapshot_of(fixture.session);
    expect_ok(fixture.engine.validate(fixture.session));
    require_ok(SemanticMemoryEngine{}.forget(fixture.sources.semantic, "shared"));
    expect_ok(fixture.engine.validate(fixture.session));
    EXPECT_EQ(snapshot_of(fixture.session), derived_before);
}

TEST(MemoryReflectionSessionTest, RetrieveDeepCopiesEveryState) {
    Fixture fixture;
    const auto check = [&fixture] {
        const auto before = snapshot_of(fixture.session);
        const auto result = fixture.engine.retrieveSession(fixture.session);
        expect_ok(result);
        ASSERT_NE(result.session(), nullptr);
        EXPECT_NE(result.session(), &fixture.session);
        EXPECT_EQ(snapshot_of(*result.session()), before);
        EXPECT_EQ(snapshot_of(fixture.session), before);
    };
    check();
    prepare(fixture);
    check();
    require_ok(derive(fixture));
    check();
    require_ok(fixture.engine.forgetSession(fixture.session));
    check();
}

TEST(MemoryReflectionLifecycleTest,
     ForgettingEveryStateIsTerminalAndIsolated) {
    for (int stage = 0; stage < 4; ++stage) {
        Fixture fixture;
        std::optional<Reflection> detached;
        if (stage >= 1) {
            prepare(fixture);
        }
        if (stage >= 2) {
            auto result = derive(fixture);
            require_ok(result);
            detached.emplace(*result.reflection());
        }
        if (stage == 3) {
            require_ok(fixture.engine.forgetSession(fixture.session));
        }
        const auto sources_before = snapshot_of(fixture.sources);
        const auto detached_before = detached.has_value()
                                         ? std::optional{snapshot_of(*detached)}
                                         : std::nullopt;
        auto result = fixture.engine.forgetSession(fixture.session);
        expect_ok(result);
        expect_no_payload(result);
        EXPECT_EQ(fixture.session.state(), State::Forgotten);
        EXPECT_EQ(fixture.session.query(), nullptr);
        EXPECT_EQ(fixture.session.reflection(), nullptr);
        EXPECT_TRUE(fixture.session.sourceCandidates().empty());
        EXPECT_TRUE(fixture.session.sourceExplanationChains().empty());
        EXPECT_EQ(snapshot_of(fixture.sources), sources_before);
        if (detached.has_value()) {
            EXPECT_EQ(snapshot_of(*detached), *detached_before);
        }
        expect_ok(fixture.engine.forgetSession(fixture.session));
    }
}

TEST(MemoryReflectionLifecycleTest, WrongStageAndRepeatedOperationsAreExact) {
    Fixture fixture;
    expect_failure(derive(fixture), "SESSION_NOT_PREPARED");
    expect_failure(fixture.engine.explain(fixture.session, Kind::Semantic, "shared"),
                   "REFLECTION_NOT_DERIVED");
    prepare(fixture);
    expect_failure(fixture.engine.reflect(fixture.session, fixture.query,
                                          fixture.retrieval),
                   "SESSION_ALREADY_STARTED");
    expect_failure(fixture.engine.explain(fixture.session, Kind::Semantic, "shared"),
                   "REFLECTION_NOT_DERIVED");
    require_ok(derive(fixture));
    expect_failure(derive(fixture), "SESSION_ALREADY_DERIVED");
    expect_failure(fixture.engine.reflect(fixture.session, fixture.query,
                                          fixture.retrieval),
                   "SESSION_ALREADY_STARTED");
    require_ok(fixture.engine.forgetSession(fixture.session));
    expect_failure(fixture.engine.reflect(fixture.session, fixture.query,
                                          fixture.retrieval),
                   "SESSION_FORGOTTEN");
    expect_failure(derive(fixture), "SESSION_FORGOTTEN");
    expect_failure(fixture.engine.explain(fixture.session, Kind::Semantic, "shared"),
                   "SESSION_FORGOTTEN");
    expect_failure(fixture.engine.validate(fixture.session), "SESSION_FORGOTTEN");
}

TEST(MemoryReflectionPrecedenceTest, ReflectAndDerivePrecedenceIsExact) {
    Fixture fixture;
    ReflectionSession wrong_query{std::string{workspace}};
    ReflectionQuery query_other{"other-workspace", "", ""};
    RetrievalSession retrieval_other{"other-workspace"};
    expect_failure(fixture.engine.reflect(wrong_query, query_other, retrieval_other),
                   "WORKSPACE_MISMATCH");

    ReflectionSession wrong_retrieval{std::string{workspace}};
    expect_failure(fixture.engine.reflect(wrong_retrieval, fixture.query,
                                          retrieval_other),
                   "WORKSPACE_MISMATCH");

    ReflectionSession ready{std::string{workspace}};
    RetrievalSession ready_retrieval{std::string{workspace}};
    expect_failure(fixture.engine.reflect(
                       ready, ReflectionQuery{std::string{workspace}, "", ""},
                       ready_retrieval),
                   "RETRIEVAL_SESSION_NOT_STARTED");

    Sources other{"other-workspace"};
    populate(other);
    prepare(fixture);
    expect_failure(fixture.engine.derive(fixture.session, other.semantic,
                                         other.episodic, other.procedural),
                   "WORKSPACE_MISMATCH");
    Sources episodic_other{workspace};
    populate(episodic_other);
    EpisodicMemory wrong_episode{"other-workspace"};
    expect_failure(fixture.engine.derive(fixture.session, fixture.sources.semantic,
                                         wrong_episode, other.procedural),
                   "WORKSPACE_MISMATCH");
}

TEST(MemoryReflectionResultTest, SuccessPayloadShapesAreExact) {
    Fixture fixture;
    auto reflected = fixture.engine.reflect(
        fixture.session, fixture.query, fixture.retrieval);
    expect_ok(reflected);
    expect_no_payload(reflected);
    auto validated = fixture.engine.validate(fixture.session);
    expect_ok(validated);
    expect_no_payload(validated);
    auto derived = derive(fixture);
    expect_ok(derived);
    ASSERT_NE(derived.reflection(), nullptr);
    EXPECT_EQ(derived.session(), nullptr);
    EXPECT_EQ(derived.candidate(), nullptr);
    EXPECT_TRUE(derived.explanationChain().empty());
    auto explained = fixture.engine.explain(fixture.session, Kind::Semantic, "shared");
    expect_ok(explained);
    EXPECT_EQ(explained.reflection(), nullptr);
    EXPECT_EQ(explained.session(), nullptr);
    EXPECT_NE(explained.candidate(), nullptr);
    EXPECT_FALSE(explained.explanationChain().empty());
    auto observed = fixture.engine.retrieveSession(fixture.session);
    expect_ok(observed);
    EXPECT_NE(observed.session(), nullptr);
    EXPECT_EQ(observed.reflection(), nullptr);
    EXPECT_EQ(observed.candidate(), nullptr);
    EXPECT_TRUE(observed.explanationChain().empty());
    auto forgotten = fixture.engine.forgetSession(fixture.session);
    expect_ok(forgotten);
    expect_no_payload(forgotten);
}

TEST(MemoryReflectionAccessibilityTest,
     DetachedPreparationRequiresLaterLiveRevalidation) {
    Fixture fixture;
    prepare(fixture);
    require_ok(SemanticMemoryEngine{}.update(
        fixture.sources.semantic, "shared", "changed after preparation"));
    const auto before = snapshot_of(fixture.session);
    expect_failure(derive(fixture), "SOURCE_CHANGED");
    EXPECT_EQ(snapshot_of(fixture.session), before);
}

TEST(MemoryReflectionDriftTest,
     AllKindsDetectCompleteSourceChangesAndAbsence) {
    const auto run = [](const Kind kind, const std::string_view identifier,
                        auto mutate, const std::string_view expected) {
        Fixture fixture;
        RetrievalSession exact{std::string{workspace}};
        require_ok(MemoryRetrievalEngine{}.retrieve(
            exact, fixture.sources.semantic, fixture.sources.episodic,
            fixture.sources.procedural, kind, identifier));
        ReflectionSession session{std::string{workspace}};
        ReflectionQuery query{std::string{workspace}, "different-target", "knowledge"};
        require_ok(fixture.engine.reflect(session, query, exact));
        mutate(fixture.sources);
        const auto before = snapshot_of(session);
        const auto sources_before = snapshot_of(fixture.sources);
        const auto result = fixture.engine.derive(
            session, fixture.sources.semantic, fixture.sources.episodic,
            fixture.sources.procedural);
        expect_failure(result, expected);
        EXPECT_EQ(snapshot_of(session), before);
        EXPECT_EQ(snapshot_of(fixture.sources), sources_before);
    };

    run(Kind::Semantic, "shared",
        [](Sources& sources) {
            require_ok(SemanticMemoryEngine{}.update(
                sources.semantic, "shared", "different meaning"));
        },
        "SOURCE_CHANGED");
    run(Kind::Semantic, "shared",
        [](Sources& sources) {
            sources.add_semantic("semantic-link-drift", "link drift",
                                 {"evidence-c"});
            require_ok(SemanticMemoryEngine{}.link(
                sources.semantic, "shared", "semantic-link-drift"));
        },
        "SOURCE_CHANGED");
    run(Kind::Semantic, "shared",
        [](Sources& sources) {
            require_ok(SemanticMemoryEngine{}.categorize(
                sources.semantic, "shared", "new-category"));
        },
        "SOURCE_CHANGED");
    run(Kind::Episodic, "shared",
        [](Sources& sources) {
            sources.add_episode("episode-link-drift", "link drift", "context",
                                30, {"evidence-c"});
            require_ok(EpisodicMemoryEngine{}.link(
                sources.episodic, "shared", "episode-link-drift"));
        },
        "SOURCE_CHANGED");
    run(Kind::Episodic, "shared",
        [](Sources& sources) {
            require_ok(EpisodicMemoryEngine{}.update(
                sources.episodic, "shared", "different occurrence",
                "different context"));
        },
        "SOURCE_CHANGED");
    run(Kind::Procedural, "shared",
        [](Sources& sources) {
            sources.add_procedure("procedure-link-drift", "link drift",
                                  {"link-step"}, {"evidence-a"});
            require_ok(ProceduralMemoryEngine{}.link(
                sources.procedural, "shared", "procedure-link-drift"));
        },
        "SOURCE_CHANGED");
    run(Kind::Procedural, "shared",
        [](Sources& sources) {
            require_ok(ProceduralMemoryEngine{}.update(
                sources.procedural, "shared", "different activity",
                {"different-step"}));
        },
        "SOURCE_CHANGED");
    run(Kind::Semantic, "shared",
        [](Sources& sources) {
            require_ok(SemanticMemoryEngine{}.forget(sources.semantic, "shared"));
        },
        "SOURCE_NOT_FOUND");
    run(Kind::Episodic, "shared",
        [](Sources& sources) {
            require_ok(EpisodicMemoryEngine{}.forget(sources.episodic, "shared"));
        },
        "SOURCE_NOT_FOUND");
    run(Kind::Procedural, "shared",
        [](Sources& sources) {
            require_ok(ProceduralMemoryEngine{}.forget(sources.procedural, "shared"));
        },
        "SOURCE_NOT_FOUND");
}

TEST(MemoryReflectionDriftTest,
     ChronologyProvenanceValuesAndNestedOrderParticipateInEquality) {
    const auto check = [](Sources& original, Sources& changed, const Kind kind,
                          const std::string_view identifier) {
        RetrievalSession retrieval{std::string{workspace}};
        require_ok(MemoryRetrievalEngine{}.retrieve(
            retrieval, original.semantic, original.episodic,
            original.procedural, kind, identifier));
        ReflectionSession session{std::string{workspace}};
        ReflectionQuery query{std::string{workspace}, "replacement-target",
                              "knowledge"};
        MemoryReflectionEngine engine;
        require_ok(engine.reflect(session, query, retrieval));
        const auto before = snapshot_of(session);
        expect_failure(engine.derive(session, changed.semantic, changed.episodic,
                                     changed.procedural),
                       "SOURCE_CHANGED");
        EXPECT_EQ(snapshot_of(session), before);
    };

    {
        Sources original{workspace};
        original.retain("p-a", "value-a");
        original.retain("p-b", "value-b");
        original.add_semantic("provenance-semantic", "meaning",
                              {"p-a", "p-b"});
        Sources changed{workspace};
        changed.retain("p-a", "value-a");
        changed.retain("p-b", "value-b");
        changed.add_semantic("provenance-semantic", "meaning",
                             {"p-b", "p-a"});
        check(original, changed, Kind::Semantic, "provenance-semantic");
    }
    {
        Sources original{workspace};
        original.retain("episode-source", "episode-value");
        original.add_episode("chronology-episode", "occurrence", "context", 10,
                             {"episode-source"});
        Sources changed{workspace};
        changed.retain("episode-source", "episode-value");
        changed.add_episode("chronology-episode", "occurrence", "context", 11,
                            {"episode-source"});
        check(original, changed, Kind::Episodic, "chronology-episode");
    }
    {
        Sources original{workspace};
        original.retain("procedure-source", "original-value");
        original.add_procedure("provenance-procedure", "activity", {"step"},
                               {"procedure-source"});
        Sources changed{workspace};
        changed.retain("procedure-source", "changed-value");
        changed.add_procedure("provenance-procedure", "activity", {"step"},
                              {"procedure-source"});
        check(original, changed, Kind::Procedural, "provenance-procedure");
    }
}

TEST(MemoryReflectionAccessibilityTest,
     DerivationLeavesEverySourceBaseStateUnchanged) {
    Fixture fixture;
    prepare(fixture);
    const auto before = snapshot_of(fixture.sources);
    require_ok(derive(fixture));
    EXPECT_EQ(snapshot_of(fixture.sources), before);
}

TEST(MemoryReflectionIsolationTest, SourceAndReflectionLifecyclesNeverCascade) {
    Fixture fixture;
    prepare(fixture);
    auto result = derive(fixture);
    require_ok(result);
    Reflection detached{*result.reflection()};
    const auto reflection_before = snapshot_of(detached);
    require_ok(SemanticMemoryEngine{}.forget(fixture.sources.semantic, "shared"));
    require_ok(EpisodicMemoryEngine{}.forget(fixture.sources.episodic, "shared"));
    require_ok(ProceduralMemoryEngine{}.forget(fixture.sources.procedural, "shared"));
    EXPECT_EQ(snapshot_of(detached), reflection_before);
    const auto sources_before = snapshot_of(fixture.sources);
    require_ok(fixture.engine.forgetSession(fixture.session));
    EXPECT_EQ(snapshot_of(fixture.sources), sources_before);
}

TEST(MemoryReflectionFailureTest, SemanticFailuresPreserveCompleteState) {
    Fixture fixture;
    const auto session_before = snapshot_of(fixture.session);
    const auto sources_before = snapshot_of(fixture.sources);
    expect_failure(derive(fixture), "SESSION_NOT_PREPARED");
    EXPECT_EQ(snapshot_of(fixture.session), session_before);
    EXPECT_EQ(snapshot_of(fixture.sources), sources_before);
    ReflectionSession other{std::string{workspace}};
    expect_failure(fixture.engine.reflect(
                       other,
                       ReflectionQuery{std::string{workspace}, "shared", "knowledge"},
                       fixture.retrieval),
                   "IDENTITY_CONFLICT");
    EXPECT_EQ(other.state(), State::Pristine);
    EXPECT_EQ(snapshot_of(fixture.sources), sources_before);
}

TEST(MemoryReflectionValueTest, CopyMoveAndLifetimeContractsAreExact) {
    Fixture fixture;
    prepare(fixture);
    auto result = derive(fixture);
    require_ok(result);
    Reflection copy{*result.reflection()};
    Reflection assigned{copy};
    assigned = copy;
    EXPECT_EQ(snapshot_of(copy), snapshot_of(assigned));
    Reflection moved{std::move(copy)};
    EXPECT_EQ(moved.identifier(), target_identifier);
    EXPECT_TRUE(copy.workspaceIdentifier().empty());
    EXPECT_TRUE(copy.identifier().empty());
    EXPECT_TRUE(copy.knowledge().empty());
    EXPECT_TRUE(copy.sourceCandidates().empty());
    EXPECT_TRUE(copy.sourceExplanationChains().empty());

    ReflectionSession session_copy{fixture.session};
    EXPECT_EQ(snapshot_of(session_copy), snapshot_of(fixture.session));
    ReflectionSession session_moved{std::move(session_copy)};
    EXPECT_EQ(session_moved.state(), State::Derived);
    EXPECT_EQ(session_copy.state(), State::Pristine);
    EXPECT_EQ(session_copy.workspaceIdentifier(), workspace);
    EXPECT_TRUE(session_copy.sourceCandidates().empty());

    ReflectionResult moved_result{std::move(result)};
    EXPECT_TRUE(moved_result.succeeded());
    EXPECT_FALSE(result.succeeded());
    EXPECT_TRUE(result.code().empty());
    EXPECT_TRUE(result.message().empty());
    EXPECT_EQ(result.reflection(), nullptr);
}

TEST(MemoryReflectionDeterminismTest, EquivalentHistoriesAreCompletelyEqual) {
    Fixture first;
    Fixture second;
    prepare(first);
    prepare(second);
    auto first_result = derive(first);
    auto second_result = derive(second);
    require_ok(first_result);
    require_ok(second_result);
    EXPECT_EQ(snapshot_of(first.session), snapshot_of(second.session));
    EXPECT_EQ(snapshot_of(*first_result.reflection()),
              snapshot_of(*second_result.reflection()));
    EXPECT_EQ(first_result.code(), second_result.code());
    EXPECT_EQ(first_result.message(), second_result.message());
}

TEST(MemoryReflectionConcurrencyTest, IndependentValuesSupportConcurrentUse) {
    const auto run = [] {
        Fixture fixture;
        prepare(fixture);
        auto result = derive(fixture);
        require_ok(result);
        return snapshot_of(*result.reflection());
    };
    auto first = std::async(std::launch::async, run);
    auto second = std::async(std::launch::async, run);
    EXPECT_EQ(first.get(), second.get());
}

TEST(MemoryReflectionBoundaryTest,
     WorkspacesSourcesAndServicesRemainIsolated) {
    Fixture first;
    Fixture second;
    const auto first_sources = snapshot_of(first.sources);
    const auto second_sources = snapshot_of(second.sources);
    prepare(first);
    require_ok(derive(first));
    EXPECT_EQ(snapshot_of(first.sources), first_sources);
    EXPECT_EQ(snapshot_of(second.sources), second_sources);
    EXPECT_EQ(second.session.state(), State::Pristine);
    MemoryReflectionEngine another_engine;
    expect_ok(another_engine.retrieveSession(first.session));
}

TEST(MemoryReflectionBoundaryTest, NoExcludedBehaviorIsObservable) {
    Fixture fixture;
    const auto sources_before = snapshot_of(fixture.sources);
    prepare(fixture);
    auto result = derive(fixture);
    require_ok(result);
    ASSERT_NE(result.reflection(), nullptr);
    EXPECT_EQ(result.reflection()->knowledge(), target_knowledge);
    EXPECT_EQ(snapshot_of(fixture.sources), sources_before);
}

TEST(MemoryReflectionResultTest, AllCodesMessagesAndPayloadsAreClosed) {
    std::vector<std::string> observed;
    const auto capture = [&observed](const ReflectionResult& result,
                                     const std::string_view code) {
        expect_failure(result, code);
        observed.emplace_back(result.code());
    };

    Fixture fixture;
    capture(derive(fixture), "SESSION_NOT_PREPARED");
    capture(fixture.engine.explain(fixture.session, Kind::Semantic, "shared"),
            "REFLECTION_NOT_DERIVED");
    ReflectionSession ready{std::string{workspace}};
    RetrievalSession ready_retrieval{std::string{workspace}};
    capture(fixture.engine.reflect(ready, fixture.query, ready_retrieval),
            "RETRIEVAL_SESSION_NOT_STARTED");
    require_ok(MemoryRetrievalEngine{}.forgetSession(ready_retrieval));
    ReflectionSession forgotten_retrieval_target{std::string{workspace}};
    capture(fixture.engine.reflect(forgotten_retrieval_target, fixture.query,
                                   ready_retrieval),
            "RETRIEVAL_SESSION_FORGOTTEN");
    ReflectionSession empty_identifier{std::string{workspace}};
    capture(fixture.engine.reflect(
                empty_identifier,
                ReflectionQuery{std::string{workspace}, "", "knowledge"},
                fixture.retrieval),
            "INVALID_IDENTIFIER");
    ReflectionSession empty_knowledge{std::string{workspace}};
    capture(fixture.engine.reflect(
                empty_knowledge,
                ReflectionQuery{std::string{workspace}, "target", ""},
                fixture.retrieval),
            "INVALID_KNOWLEDGE");
    ReflectionSession identity{std::string{workspace}};
    capture(fixture.engine.reflect(
                identity,
                ReflectionQuery{std::string{workspace}, "shared", "knowledge"},
                fixture.retrieval),
            "IDENTITY_CONFLICT");
    ReflectionSession wrong_workspace{std::string{workspace}};
    capture(fixture.engine.reflect(
                wrong_workspace,
                ReflectionQuery{"other", "target", "knowledge"},
                fixture.retrieval),
            "WORKSPACE_MISMATCH");

    Sources sources{workspace};
    populate(sources);
    RetrievalSession empty{std::string{workspace}};
    require_ok(MemoryRetrievalEngine{}.search(
        empty, sources.semantic, sources.episodic, sources.procedural,
        KnowledgeQuery{"absent-query"}));
    ReflectionSession no_sources{std::string{workspace}};
    capture(fixture.engine.reflect(no_sources, fixture.query, empty),
            "NO_SOURCES");

    prepare(fixture);
    capture(fixture.engine.reflect(fixture.session, fixture.query,
                                   fixture.retrieval),
            "SESSION_ALREADY_STARTED");
    auto changed_sources = fixture.sources;
    require_ok(SemanticMemoryEngine{}.update(
        changed_sources.semantic, "shared", "changed"));
    capture(fixture.engine.derive(fixture.session, changed_sources.semantic,
                                  changed_sources.episodic,
                                  changed_sources.procedural),
            "SOURCE_CHANGED");
    auto missing_sources = fixture.sources;
    require_ok(SemanticMemoryEngine{}.forget(missing_sources.semantic, "shared"));
    capture(fixture.engine.derive(fixture.session, missing_sources.semantic,
                                  missing_sources.episodic,
                                  missing_sources.procedural),
            "SOURCE_NOT_FOUND");
    require_ok(derive(fixture));
    capture(derive(fixture), "SESSION_ALREADY_DERIVED");
    capture(fixture.engine.explain(fixture.session, static_cast<Kind>(999), "x"),
            "INVALID_SOURCE_KIND");
    capture(fixture.engine.explain(fixture.session, Kind::Semantic, "absent"),
            "SOURCE_NOT_FOUND");
    require_ok(fixture.engine.forgetSession(fixture.session));
    capture(fixture.engine.validate(fixture.session), "SESSION_FORGOTTEN");

    Fixture malformed;
    auto& candidate = const_cast<KnowledgeCandidate&>(
        malformed.retrieval.candidates().front());
    [[maybe_unused]] KnowledgeCandidate removed{std::move(candidate)};
    capture(malformed.engine.reflect(malformed.session, malformed.query,
                                     malformed.retrieval),
            "REFLECTION_STATE_MISMATCH");

    EXPECT_GE(observed.size(), 16U);
}

} // namespace

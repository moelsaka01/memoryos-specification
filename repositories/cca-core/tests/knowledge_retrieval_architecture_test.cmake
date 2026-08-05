if(NOT DEFINED CCA_CORE_SOURCE_DIR)
  message(FATAL_ERROR "CCA_CORE_SOURCE_DIR is required")
endif()

set(knowledge_public_header
    "${CCA_CORE_SOURCE_DIR}/include/cca/memory/knowledge_retrieval.hpp")
set(knowledge_implementation
    "${CCA_CORE_SOURCE_DIR}/src/memory/knowledge_retrieval.cpp")
set(knowledge_unit_test
    "${CCA_CORE_SOURCE_DIR}/tests/knowledge_retrieval_test.cpp")
set(knowledge_allocation_test
    "${CCA_CORE_SOURCE_DIR}/tests/knowledge_retrieval_allocation_failure_test.cpp")
set(knowledge_documentation
    "${CCA_CORE_SOURCE_DIR}/docs/memory-retrieval.md")
set(knowledge_example
    "${CCA_CORE_SOURCE_DIR}/examples/knowledge_retrieval_usage.cpp")

foreach(required_file IN LISTS
        knowledge_public_header
        knowledge_implementation
        knowledge_unit_test
        knowledge_allocation_test
        knowledge_documentation
        knowledge_example)
  if(NOT EXISTS "${required_file}")
    message(FATAL_ERROR "Missing Memory Retrieval evidence: ${required_file}")
  endif()
endforeach()

file(READ "${knowledge_public_header}" knowledge_public_text)
file(READ "${knowledge_implementation}" knowledge_implementation_text)
file(READ "${knowledge_unit_test}" knowledge_unit_test_text)
file(READ "${knowledge_allocation_test}" knowledge_allocation_test_text)
file(READ "${knowledge_documentation}" knowledge_documentation_text)
file(READ "${knowledge_example}" knowledge_example_text)

string(TOLOWER "${knowledge_public_text}" knowledge_public_lower)
string(TOLOWER "${knowledge_implementation_text}"
       knowledge_implementation_lower)
string(TOLOWER
       "${knowledge_public_text}\n${knowledge_implementation_text}"
       knowledge_production_lower)
string(TOLOWER "${knowledge_documentation_text}"
       knowledge_documentation_lower)
string(TOLOWER "${knowledge_example_text}" knowledge_example_lower)
string(REGEX REPLACE "[ \t\r\n]+" " " knowledge_public_normalized
       "${knowledge_public_lower}")

# CCA-KR-002 and CCA-KR-003: exactly four public Assets and one stateless
# Service, with exactly the six frozen public operations and no overloads.
string(REGEX MATCHALL
       "(^|[\r\n])class[ \t]+[a-z_][a-z0-9_]*[ \t\r\n]*\\{"
       knowledge_public_classes
       "${knowledge_public_lower}")
list(LENGTH knowledge_public_classes knowledge_public_class_count)
if(NOT knowledge_public_class_count EQUAL 5)
  message(FATAL_ERROR
          "Memory Retrieval must define exactly four Assets and one Service")
endif()

foreach(required_class IN ITEMS
        knowledgequery
        knowledgecandidate
        retrievalsession
        knowledgeresult
        memoryretrievalengine)
  string(REGEX MATCHALL
         "(^|[\r\n])class[ \t]+${required_class}[ \t\r\n]*\\{"
         class_matches
         "${knowledge_public_lower}")
  list(LENGTH class_matches class_match_count)
  if(NOT class_match_count EQUAL 1)
    message(FATAL_ERROR
            "Memory Retrieval public class must appear exactly once: ${required_class}")
  endif()
endforeach()

string(REGEX MATCH
       "enum[ \t\r\n]+class[ \t\r\n]+kind[ \t\r\n]*\\{([^}]*)\\}"
       knowledge_kind_match
       "${knowledge_public_lower}")
if("${knowledge_kind_match}" STREQUAL "")
  message(FATAL_ERROR "KnowledgeCandidate::Kind is absent")
endif()
set(knowledge_kind_body "${CMAKE_MATCH_1}")
string(REGEX REPLACE "[ \t\r\n]+" "" knowledge_kind_compact
       "${knowledge_kind_body}")
if(NOT "${knowledge_kind_compact}" STREQUAL
       "semantic,episodic,procedural")
  message(FATAL_ERROR
          "KnowledgeCandidate::Kind must contain exactly Semantic, Episodic, Procedural")
endif()

string(REGEX MATCH
       "class[ \t\r\n]+memoryretrievalengine[ \t\r\n]*\\{([^}]*)\\}"
       knowledge_engine_match
       "${knowledge_public_lower}")
if("${knowledge_engine_match}" STREQUAL "")
  message(FATAL_ERROR "Unable to inspect MemoryRetrievalEngine")
endif()
set(knowledge_engine_body "${CMAKE_MATCH_1}")
string(REGEX MATCH
       "public[ \t\r\n]*:([^}]*)private[ \t\r\n]*:"
       knowledge_engine_public_match
       "${knowledge_engine_body}")
if("${knowledge_engine_public_match}" STREQUAL "")
  message(FATAL_ERROR "Unable to isolate MemoryRetrievalEngine public API")
endif()
set(knowledge_engine_public "${CMAKE_MATCH_1}")

string(REGEX MATCHALL
       "knowledgeresult[ \t\r\n]+[a-z_][a-z0-9_]*[ \t\r\n]*\\("
       knowledge_operations
       "${knowledge_engine_public}")
list(LENGTH knowledge_operations knowledge_operation_count)
if(NOT knowledge_operation_count EQUAL 6)
  message(FATAL_ERROR
          "MemoryRetrievalEngine must expose exactly six operations")
endif()
foreach(required_operation IN ITEMS
        retrieve search filter rank explain forgetsession)
  string(REGEX MATCHALL
         "knowledgeresult[ \t\r\n]+${required_operation}[ \t\r\n]*\\("
         operation_matches
         "${knowledge_engine_public}")
  list(LENGTH operation_matches operation_match_count)
  if(NOT operation_match_count EQUAL 1)
    message(FATAL_ERROR
            "Memory Retrieval operation must appear exactly once: ${required_operation}")
  endif()
endforeach()

# API-010-HPP construction, observation, value, and immutability surface.
set(required_public_fragments
    "explicit knowledgequery(std::string text)"
    "const std::string& text() const noexcept"
    "~knowledgecandidate()"
    "knowledgecandidate(const knowledgecandidate&)"
    "knowledgecandidate& operator=(const knowledgecandidate&)"
    "knowledgecandidate(knowledgecandidate&&) noexcept"
    "knowledgecandidate& operator=(knowledgecandidate&&) noexcept"
    "const std::string& workspaceidentifier() const noexcept"
    "const std::string& sourceidentifier() const noexcept"
    "std::uint32_t rankscore() const noexcept"
    "const semanticconcept* semanticconcept() const noexcept"
    "const episode* episode() const noexcept"
    "const procedure* procedure() const noexcept"
    "explicit retrievalsession(std::string workspaceidentifier)"
    "~retrievalsession()"
    "retrievalsession(const retrievalsession&)"
    "retrievalsession& operator=(const retrievalsession&) = delete"
    "retrievalsession(retrievalsession&&) noexcept"
    "retrievalsession& operator=(retrievalsession&&) noexcept = delete"
    "bool started() const noexcept"
    "bool forgotten() const noexcept"
    "std::size_t size() const noexcept"
    "const std::vector<knowledgecandidate>& candidates() const noexcept"
    "knowledgeresult(knowledgeresult&&) noexcept"
    "knowledgeresult& operator=(knowledgeresult&&) noexcept"
    "knowledgeresult(const knowledgeresult&) = delete"
    "knowledgeresult& operator=(const knowledgeresult&) = delete"
    "~knowledgeresult()"
    "bool succeeded() const noexcept"
    "const std::string& code() const noexcept"
    "const std::string& message() const noexcept"
    "const knowledgecandidate* candidate() const noexcept"
    "const std::vector<std::string>& explanationchain() const noexcept")
foreach(required_fragment IN LISTS required_public_fragments)
  string(FIND "${knowledge_public_normalized}" "${required_fragment}"
         required_fragment_position)
  if(required_fragment_position EQUAL -1)
    message(FATAL_ERROR
            "API-010-HPP declaration is absent: ${required_fragment}")
  endif()
endforeach()

foreach(required_signature IN ITEMS
        "knowledgeresult[ \t\r\n]+retrieve[ \t\r\n]*\\([ \t\r\n]*retrievalsession[ \t\r\n]*&[^)]*const[ \t\r\n]+semanticmemory[ \t\r\n]*&[^)]*const[ \t\r\n]+episodicmemory[ \t\r\n]*&[^)]*const[ \t\r\n]+proceduralmemory[ \t\r\n]*&[^)]*knowledgecandidate::kind[^)]*std::string_view[^)]*\\)[ \t\r\n]*const"
        "knowledgeresult[ \t\r\n]+search[ \t\r\n]*\\([ \t\r\n]*retrievalsession[ \t\r\n]*&[^)]*const[ \t\r\n]+semanticmemory[ \t\r\n]*&[^)]*const[ \t\r\n]+episodicmemory[ \t\r\n]*&[^)]*const[ \t\r\n]+proceduralmemory[ \t\r\n]*&[^)]*const[ \t\r\n]+knowledgequery[ \t\r\n]*&[^)]*\\)[ \t\r\n]*const"
        "knowledgeresult[ \t\r\n]+filter[ \t\r\n]*\\([ \t\r\n]*retrievalsession[ \t\r\n]*&[^)]*const[ \t\r\n]+knowledgequery[ \t\r\n]*&[^)]*\\)[ \t\r\n]*const"
        "knowledgeresult[ \t\r\n]+rank[ \t\r\n]*\\([ \t\r\n]*retrievalsession[ \t\r\n]*&[^)]*\\)[ \t\r\n]*const"
        "knowledgeresult[ \t\r\n]+explain[ \t\r\n]*\\([ \t\r\n]*const[ \t\r\n]+retrievalsession[ \t\r\n]*&[^)]*knowledgecandidate::kind[^)]*std::string_view[^)]*\\)[ \t\r\n]*const"
        "knowledgeresult[ \t\r\n]+forgetsession[ \t\r\n]*\\([ \t\r\n]*retrievalsession[ \t\r\n]*&[^)]*\\)[ \t\r\n]*const")
  string(REGEX MATCH "${required_signature}" signature_match
         "${knowledge_engine_public}")
  if("${signature_match}" STREQUAL "")
    message(FATAL_ERROR
            "MemoryRetrievalEngine signature differs from API-010-HPP: ${required_signature}")
  endif()
endforeach()

# CCA-KR-009 and CCA-KR-010: Kind is the strong discriminator and callers
# cannot forge an initial candidate from any source category.
string(REGEX REPLACE
       "enum[ \t\r\n]+class[ \t\r\n]+kind[ \t\r\n]*\\{[^}]*\\}[ \t\r\n]*;"
       ""
       knowledge_public_without_kind
       "${knowledge_public_lower}")
string(REGEX MATCH
       "class[ \t\r\n]+knowledgecandidate[ \t\r\n]*\\{([^}]*)\\}"
       knowledge_candidate_match
       "${knowledge_public_without_kind}")
if("${knowledge_candidate_match}" STREQUAL "")
  message(FATAL_ERROR "Unable to inspect KnowledgeCandidate")
endif()
set(knowledge_candidate_body "${CMAKE_MATCH_1}")
string(REGEX MATCH
       "public[ \t\r\n]*:([^}]*)private[ \t\r\n]*:"
       knowledge_candidate_public_match
       "${knowledge_candidate_body}")
if("${knowledge_candidate_public_match}" STREQUAL "")
  message(FATAL_ERROR "Unable to isolate KnowledgeCandidate public API")
endif()
set(knowledge_candidate_public "${CMAKE_MATCH_1}")
foreach(source_type IN ITEMS semanticconcept episode procedure)
  string(REGEX MATCH
         "knowledgecandidate[ \t\r\n]*\\([^)]*${source_type}"
         forging_constructor
         "${knowledge_candidate_public}")
  if(NOT "${forging_constructor}" STREQUAL "")
    message(FATAL_ERROR
            "Public source-forging KnowledgeCandidate constructor detected")
  endif()
endforeach()

# CCA-KR-001, CCA-KR-005, and CCA-KR-036: the installed Contract depends
# only on the three released category Contracts and the standard library.
string(REGEX MATCHALL "#include[ \t]+<cca/[^>]+>"
       knowledge_cca_public_includes "${knowledge_public_lower}")
list(LENGTH knowledge_cca_public_includes knowledge_cca_include_count)
if(NOT knowledge_cca_include_count EQUAL 3)
  message(FATAL_ERROR
          "Memory Retrieval public Contract must have exactly three CCA dependencies")
endif()
foreach(required_header IN ITEMS
        "cca/memory/semantic_memory.hpp"
        "cca/memory/episodic_memory.hpp"
        "cca/memory/procedural_memory.hpp")
  string(FIND "${knowledge_public_lower}" "#include <${required_header}>"
         required_header_position)
  if(required_header_position EQUAL -1)
    message(FATAL_ERROR
            "Released category dependency is absent: ${required_header}")
  endif()
endforeach()

set(forbidden_dependencies
    "cca/memory/memory.hpp"
    "cca/memory/working_memory.hpp"
    "cca/memory/long_term_memory.hpp"
    "semantic_memory_persistence"
    "episodic_memory_persistence"
    "procedural_memory_persistence"
    "long_term_memory_persistence"
    "cca/persistence/"
    "cca/process/"
    "cca/representation/"
    "cca/runtime/")
foreach(forbidden_dependency IN LISTS forbidden_dependencies)
  string(FIND "${knowledge_production_lower}" "${forbidden_dependency}"
         forbidden_dependency_position)
  if(NOT forbidden_dependency_position EQUAL -1)
    message(FATAL_ERROR
            "Memory Retrieval has forbidden production dependency: ${forbidden_dependency}")
  endif()
endforeach()

# CCA-KR-014, CCA-KR-025, CCA-KR-026, and CCA-KR-038: implementation can
# only observe released const category values. It cannot reach mutator
# Services, private state, or synthesize a mutable path through a cast.
foreach(forbidden_mutator IN ITEMS
        "SemanticMemoryEngine"
        "EpisodicMemoryEngine"
        "ProceduralMemoryEngine"
        "LongTermMemoryEngine"
        "const_cast")
  string(FIND "${knowledge_implementation_text}" "${forbidden_mutator}"
         forbidden_mutator_position)
  if(NOT forbidden_mutator_position EQUAL -1)
    message(FATAL_ERROR
            "Memory Retrieval reaches forbidden source mutation: ${forbidden_mutator}")
  endif()
endforeach()

# The released category implementations must not acquire a reverse retrieval
# dependency. Only production files participate so test usage is permitted.
set(category_production_files
    "${CCA_CORE_SOURCE_DIR}/include/cca/memory/semantic_memory.hpp"
    "${CCA_CORE_SOURCE_DIR}/src/memory/semantic_memory.cpp"
    "${CCA_CORE_SOURCE_DIR}/src/memory/semantic_memory_persistence.hpp"
    "${CCA_CORE_SOURCE_DIR}/src/memory/semantic_memory_persistence.cpp"
    "${CCA_CORE_SOURCE_DIR}/include/cca/memory/episodic_memory.hpp"
    "${CCA_CORE_SOURCE_DIR}/src/memory/episodic_memory.cpp"
    "${CCA_CORE_SOURCE_DIR}/src/memory/episodic_memory_persistence.hpp"
    "${CCA_CORE_SOURCE_DIR}/src/memory/episodic_memory_persistence.cpp"
    "${CCA_CORE_SOURCE_DIR}/include/cca/memory/procedural_memory.hpp"
    "${CCA_CORE_SOURCE_DIR}/src/memory/procedural_memory.cpp"
    "${CCA_CORE_SOURCE_DIR}/src/memory/procedural_memory_persistence.hpp"
    "${CCA_CORE_SOURCE_DIR}/src/memory/procedural_memory_persistence.cpp")
set(category_production_text "")
foreach(category_file IN LISTS category_production_files)
  if(EXISTS "${category_file}")
    file(READ "${category_file}" category_file_text)
    string(APPEND category_production_text "\n${category_file_text}")
  endif()
endforeach()
foreach(reverse_dependency IN ITEMS
        "knowledge_retrieval.hpp"
        "KnowledgeQuery"
        "KnowledgeCandidate"
        "RetrievalSession"
        "KnowledgeResult"
        "MemoryRetrievalEngine")
  string(FIND "${category_production_text}" "${reverse_dependency}"
         reverse_dependency_position)
  if(NOT reverse_dependency_position EQUAL -1)
    message(FATAL_ERROR
            "Released source Contract acquired reverse retrieval dependency: ${reverse_dependency}")
  endif()
endforeach()

# CCA-KR-031, CCA-KR-033 through CCA-KR-037: no Runtime/Persistence seam,
# Provider choice, clock, scheduler, thread, or excluded capability is part of
# production. Exact identifiers/includes avoid matching descriptive prose.
file(GLOB knowledge_persistence_files
     "${CCA_CORE_SOURCE_DIR}/src/memory/knowledge_retrieval*persistence*"
     "${CCA_CORE_SOURCE_DIR}/include/cca/memory/knowledge_retrieval*persistence*")
if(knowledge_persistence_files)
  message(FATAL_ERROR
          "Memory Retrieval must not add a Persistence mapping or seam")
endif()

set(forbidden_production_tokens
    "PersistenceEngine"
    "PersistencePackage"
    "ExecutionContextSnapshot"
    "RuntimeContext"
    "RuntimeState"
    "ServiceRegistry"
    "DependencyInjector"
    "EventBus"
    "<filesystem>"
    "<fstream>"
    "<thread>"
    "<chrono>"
    "system_clock"
    "steady_clock"
    "high_resolution_clock"
    "random_device"
    "sleep_for"
    "sleep_until"
    "Embedding"
    "VectorSearch"
    "SimilaritySearch"
    "KnowledgeGraph"
    "MemoryStudio"
    "ReflectionEngine"
    "ConsolidationEngine"
    "PlanningEngine"
    "SimulationEngine"
    "WorkflowEngine"
    "Scheduler")
foreach(forbidden_token IN LISTS forbidden_production_tokens)
  string(FIND "${knowledge_public_text}\n${knowledge_implementation_text}"
         "${forbidden_token}" forbidden_token_position)
  if(NOT forbidden_token_position EQUAL -1)
    message(FATAL_ERROR
            "Forbidden retrieval architecture token detected: ${forbidden_token}")
  endif()
endforeach()

# Limit Provider-name inspection to dependency directives. This catches an
# actual selected dependency without treating a prohibition in a comment or
# diagnostic as architectural coupling.
string(REGEX MATCHALL "#include[ \t]+[<\"][^>\"\r\n]+[>\"]"
       knowledge_production_includes "${knowledge_production_lower}")
foreach(production_include IN LISTS knowledge_production_includes)
  foreach(forbidden_provider_term IN ITEMS
          database sqlite socket network cloud compress encrypt)
    string(FIND "${production_include}" "${forbidden_provider_term}"
           forbidden_provider_position)
    if(NOT forbidden_provider_position EQUAL -1)
      message(FATAL_ERROR
              "Memory Retrieval selects a forbidden Provider dependency: ${production_include}")
    endif()
  endforeach()
endforeach()

foreach(prohibited_operation IN ITEMS
        modify classify derive consolidate reflect reason plan execute archive
        restore infer enrich normalize traverse schedule)
  string(REGEX MATCH
         "knowledgeresult[ \t\r\n]+${prohibited_operation}[a-z0-9_]*[ \t\r\n]*\\("
         prohibited_operation_match "${knowledge_engine_public}")
  if(NOT "${prohibited_operation_match}" STREQUAL "")
    message(FATAL_ERROR
            "Prohibited retrieval Service operation exposed: ${prohibited_operation}")
  endif()
endforeach()

# CCA-KR-027 and CCA-KR-039: documentation states the closed outcome set and
# the complete mechanical explanation grammar.
foreach(required_code IN ITEMS
        ok
        session_forgotten
        session_already_started
        session_not_started
        workspace_mismatch
        invalid_source_kind
        invalid_identifier
        not_found)
  string(FIND "${knowledge_documentation_lower}" "${required_code}"
         result_code_position)
  if(result_code_position EQUAL -1)
    message(FATAL_ERROR
            "Memory Retrieval documentation omits result code: ${required_code}")
  endif()
endforeach()
foreach(required_grammar IN ITEMS
        "retrieve:identifier-exact"
        "empty-query"
        "identifier-substring"
        "content-exact"
        "content-substring"
        "rank:score:n"
        "rank:stable-tie"
        "category[n]"
        "step[n]")
  string(FIND "${knowledge_documentation_lower}" "${required_grammar}"
         grammar_position)
  if(grammar_position EQUAL -1)
    message(FATAL_ERROR
            "Memory Retrieval documentation omits explanation grammar: ${required_grammar}")
  endif()
endforeach()

# CCA-KR-039 and CCA-KR-040: public evidence covers all requirements and the
# example exercises exactly the released entry points through the public API.
set(traceability_text
    "${knowledge_unit_test_text}\n${knowledge_allocation_test_text}\n${knowledge_documentation_text}")
foreach(requirement_number RANGE 1 41)
  if(requirement_number LESS 10)
    set(requirement_suffix "00${requirement_number}")
  else()
    set(requirement_suffix "0${requirement_number}")
  endif()
  string(FIND "${traceability_text}" "CCA-KR-${requirement_suffix}"
         requirement_position)
  if(requirement_position EQUAL -1)
    message(FATAL_ERROR
            "Missing verification trace for CCA-KR-${requirement_suffix}")
  endif()
endforeach()

foreach(example_operation IN ITEMS
        retrieve search filter rank explain forgetsession)
  string(REGEX MATCH "\\.${example_operation}[ \t\r\n]*\\("
         example_operation_match "${knowledge_example_lower}")
  if("${example_operation_match}" STREQUAL "")
    message(FATAL_ERROR
            "Memory Retrieval example omits operation: ${example_operation}")
  endif()
endforeach()
string(FIND "${knowledge_example_lower}"
       "#include <cca/memory/knowledge_retrieval.hpp>"
       public_example_include_position)
if(public_example_include_position EQUAL -1)
  message(FATAL_ERROR
          "Memory Retrieval example does not use the installed public Contract")
endif()
foreach(private_example_token IN ITEMS
        "_persistence.hpp"
        "cca/persistence/"
        "cca/process/"
        "cca/representation/"
        "cca/runtime/")
  string(FIND "${knowledge_example_lower}" "${private_example_token}"
         private_example_position)
  if(NOT private_example_position EQUAL -1)
    message(FATAL_ERROR
            "Memory Retrieval example crosses a private boundary: ${private_example_token}")
  endif()
endforeach()

# CCA-KR-041: all implementation, verification, and example artifacts are
# registered under the repository C++23 warnings-as-errors gates.
set(core_cmake "${CCA_CORE_SOURCE_DIR}/CMakeLists.txt")
set(test_cmake "${CCA_CORE_SOURCE_DIR}/tests/CMakeLists.txt")
set(workspace_presets "${CCA_CORE_SOURCE_DIR}/../../CMakePresets.json")
foreach(build_evidence IN ITEMS core_cmake test_cmake workspace_presets)
  if(NOT EXISTS "${${build_evidence}}")
    message(FATAL_ERROR "Missing build evidence: ${${build_evidence}}")
  endif()
endforeach()
file(READ "${core_cmake}" core_cmake_text)
file(READ "${test_cmake}" test_cmake_text)
file(READ "${workspace_presets}" workspace_presets_text)
string(TOLOWER "${core_cmake_text}" core_cmake_lower)
string(TOLOWER "${test_cmake_text}" test_cmake_lower)
string(TOLOWER "${workspace_presets_text}" workspace_presets_lower)

foreach(required_source IN ITEMS "src/memory/knowledge_retrieval.cpp")
  string(FIND "${core_cmake_lower}" "${required_source}"
         source_registration_position)
  if(source_registration_position EQUAL -1)
    message(FATAL_ERROR
            "Memory Retrieval production source is not registered: ${required_source}")
  endif()
endforeach()
foreach(required_build_token IN ITEMS
        "knowledge_retrieval_test.cpp"
        "knowledge_retrieval_allocation_failure_test.cpp"
        "knowledge_retrieval_architecture_test.cmake"
        "cca_knowledge_retrieval_allocation_tests")
  string(FIND "${test_cmake_lower}" "${required_build_token}"
         test_registration_position)
  if(test_registration_position EQUAL -1)
    message(FATAL_ERROR
            "Memory Retrieval verification is not registered: ${required_build_token}")
  endif()
endforeach()
foreach(required_example_token IN ITEMS
        "knowledge_retrieval_usage.cpp"
        "cca_knowledge_retrieval_example"
        "cca_configure_target(cca_knowledge_retrieval_example)")
  string(FIND "${core_cmake_lower}" "${required_example_token}"
         example_registration_position)
  if(example_registration_position EQUAL -1)
    message(FATAL_ERROR
            "Memory Retrieval example/build gate is absent: ${required_example_token}")
  endif()
endforeach()
string(FIND "${core_cmake_lower}" "cca_configure_target(cca_memory)"
       memory_warning_gate_position)
if(memory_warning_gate_position EQUAL -1)
  message(FATAL_ERROR "cca_memory is not under repository warning gates")
endif()
string(REGEX MATCH
       "\"cca_warnings_as_errors\"[ \t\r\n]*:[ \t\r\n]*\"on\""
       warnings_as_errors_match "${workspace_presets_lower}")
if("${warnings_as_errors_match}" STREQUAL "")
  message(FATAL_ERROR
          "CI preset does not enable CCA_WARNINGS_AS_ERRORS")
endif()
string(REGEX MATCH
       "\"cmake_cxx_standard\"[ \t\r\n]*:[ \t\r\n]*\"23\""
       cxx23_match "${workspace_presets_lower}")
if("${cxx23_match}" STREQUAL "")
  message(FATAL_ERROR "Workspace presets do not require C++23")
endif()

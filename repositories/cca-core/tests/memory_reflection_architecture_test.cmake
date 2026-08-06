if(NOT DEFINED CCA_CORE_SOURCE_DIR)
  message(FATAL_ERROR "CCA_CORE_SOURCE_DIR is required")
endif()

set(reflection_public_header
    "${CCA_CORE_SOURCE_DIR}/include/cca/memory/memory_reflection.hpp")
set(reflection_implementation
    "${CCA_CORE_SOURCE_DIR}/src/memory/memory_reflection.cpp")
set(reflection_unit_test
    "${CCA_CORE_SOURCE_DIR}/tests/memory_reflection_test.cpp")
set(reflection_allocation_test
    "${CCA_CORE_SOURCE_DIR}/tests/memory_reflection_allocation_failure_test.cpp")
set(reflection_documentation
    "${CCA_CORE_SOURCE_DIR}/docs/memory-reflection.md")
set(reflection_example
    "${CCA_CORE_SOURCE_DIR}/examples/memory_reflection_usage.cpp")

foreach(required_file IN ITEMS
        reflection_public_header
        reflection_implementation
        reflection_unit_test
        reflection_allocation_test
        reflection_documentation
        reflection_example)
  if(NOT EXISTS "${${required_file}}")
    message(FATAL_ERROR
            "Missing Memory Reflection deliverable: ${${required_file}}")
  endif()
endforeach()

file(READ "${reflection_public_header}" reflection_public_text)
file(READ "${reflection_implementation}" reflection_implementation_text)
file(READ "${reflection_unit_test}" reflection_unit_test_text)
file(READ "${reflection_allocation_test}" reflection_allocation_test_text)
file(READ "${reflection_documentation}" reflection_documentation_text)
file(READ "${reflection_example}" reflection_example_text)

string(TOLOWER "${reflection_public_text}" reflection_public_lower)
string(TOLOWER "${reflection_implementation_text}"
       reflection_implementation_lower)
string(TOLOWER
       "${reflection_public_text}\n${reflection_implementation_text}"
       reflection_production_lower)
string(TOLOWER "${reflection_documentation_text}"
       reflection_documentation_lower)
string(TOLOWER "${reflection_example_text}" reflection_example_lower)
string(REGEX REPLACE "[ \t\r\n]+" " " reflection_public_normalized
       "${reflection_public_lower}")
string(REGEX REPLACE "[ \t\r\n]+" " " reflection_implementation_normalized
       "${reflection_implementation_lower}")
string(REGEX REPLACE "[ \t\r\n]+" " " reflection_example_normalized
       "${reflection_example_lower}")

# CCA-REFLECT-003, CCA-REFLECT-004, and API-012-HPP: exactly four public
# Assets and one stateless Service, with exactly the six frozen operations.
string(REGEX MATCHALL
       "(^|[\r\n])class[ \t]+[a-z_][a-z0-9_]*[ \t\r\n]*\\{"
       reflection_public_classes
       "${reflection_public_lower}")
list(LENGTH reflection_public_classes reflection_public_class_count)
if(NOT reflection_public_class_count EQUAL 5)
  message(FATAL_ERROR
          "Memory Reflection must define exactly four Assets and one Service")
endif()

foreach(required_class IN ITEMS
        reflectionquery
        reflection
        reflectionsession
        reflectionresult
        memoryreflectionengine)
  string(REGEX MATCHALL
         "(^|[\r\n])class[ \t]+${required_class}[ \t\r\n]*\\{"
         class_matches
         "${reflection_public_lower}")
  list(LENGTH class_matches class_match_count)
  if(NOT class_match_count EQUAL 1)
    message(FATAL_ERROR
            "Memory Reflection public class must appear exactly once: ${required_class}")
  endif()
endforeach()

string(REGEX MATCH
       "enum[ \t\r\n]+class[ \t\r\n]+state[ \t\r\n]*\\{([^}]*)\\}"
       reflection_state_match
       "${reflection_public_lower}")
if("${reflection_state_match}" STREQUAL "")
  message(FATAL_ERROR "ReflectionSession::State is absent")
endif()
set(reflection_state_body "${CMAKE_MATCH_1}")
string(REGEX REPLACE "[ \t\r\n]+" "" reflection_state_compact
       "${reflection_state_body}")
if(NOT "${reflection_state_compact}" STREQUAL
       "pristine,prepared,derived,forgotten")
  message(FATAL_ERROR
          "ReflectionSession::State differs from API-012-HPP")
endif()

string(REGEX MATCH
       "class[ \t\r\n]+memoryreflectionengine[ \t\r\n]*\\{([^}]*)\\}"
       reflection_engine_match
       "${reflection_public_lower}")
if("${reflection_engine_match}" STREQUAL "")
  message(FATAL_ERROR "Unable to inspect MemoryReflectionEngine")
endif()
set(reflection_engine_body "${CMAKE_MATCH_1}")
string(REGEX MATCHALL
       "reflectionresult[ \t\r\n]+[a-z_][a-z0-9_]*[ \t\r\n]*\\("
       reflection_operations
       "${reflection_engine_body}")
list(LENGTH reflection_operations reflection_operation_count)
if(NOT reflection_operation_count EQUAL 6)
  message(FATAL_ERROR
          "MemoryReflectionEngine must expose exactly six operations")
endif()
foreach(required_operation IN ITEMS
        reflect derive explain validate retrievesession forgetsession)
  string(REGEX MATCHALL
         "reflectionresult[ \t\r\n]+${required_operation}[ \t\r\n]*\\("
         operation_matches
         "${reflection_engine_body}")
  list(LENGTH operation_matches operation_match_count)
  if(NOT operation_match_count EQUAL 1)
    message(FATAL_ERROR
            "Reflection operation must appear exactly once: ${required_operation}")
  endif()
endforeach()

# API-012-HPP construction, ownership, observation, and move surface.
set(required_public_fragments
    "reflectionquery(std::string workspaceidentifier, std::string identifier, std::string knowledge)"
    "const std::string& workspaceidentifier() const noexcept"
    "const std::string& identifier() const noexcept"
    "const std::string& knowledge() const noexcept"
    "~reflection()"
    "reflection(const reflection&)"
    "reflection& operator=(const reflection&)"
    "reflection(reflection&&) noexcept"
    "reflection& operator=(reflection&&) noexcept"
    "const std::vector<knowledgecandidate>& sourcecandidates() const noexcept"
    "const std::vector<std::vector<std::string>>& sourceexplanationchains() const noexcept"
    "explicit reflectionsession(std::string workspaceidentifier)"
    "~reflectionsession()"
    "reflectionsession(const reflectionsession&)"
    "reflectionsession& operator=(const reflectionsession&) = delete"
    "reflectionsession(reflectionsession&&) noexcept"
    "reflectionsession& operator=(reflectionsession&&) noexcept = delete"
    "state state() const noexcept"
    "const reflectionquery* query() const noexcept"
    "std::size_t size() const noexcept"
    "const reflection* reflection() const noexcept"
    "reflectionresult(reflectionresult&&) noexcept"
    "reflectionresult& operator=(reflectionresult&&) noexcept"
    "reflectionresult(const reflectionresult&) = delete"
    "reflectionresult& operator=(const reflectionresult&) = delete"
    "~reflectionresult()"
    "bool succeeded() const noexcept"
    "const std::string& code() const noexcept"
    "const std::string& message() const noexcept"
    "const reflection* reflection() const noexcept"
    "const reflectionsession* session() const noexcept"
    "const knowledgecandidate* candidate() const noexcept"
    "const std::vector<std::string>& explanationchain() const noexcept")
foreach(required_fragment IN LISTS required_public_fragments)
  string(FIND "${reflection_public_normalized}" "${required_fragment}"
         required_fragment_position)
  if(required_fragment_position EQUAL -1)
    message(FATAL_ERROR
            "API-012-HPP declaration is absent: ${required_fragment}")
  endif()
endforeach()

set(required_engine_signatures
    "reflectionresult reflect( reflectionsession& session, const reflectionquery& query, const retrievalsession& retrievalsession) const"
    "reflectionresult derive( reflectionsession& session, const semanticmemory& semanticmemory, const episodicmemory& episodicmemory, const proceduralmemory& proceduralmemory) const"
    "reflectionresult explain( const reflectionsession& session, knowledgecandidate::kind kind, std::string_view identifier) const"
    "reflectionresult validate(const reflectionsession& session) const"
    "reflectionresult retrievesession(const reflectionsession& session) const"
    "reflectionresult forgetsession(reflectionsession& session) const")
foreach(required_signature IN LISTS required_engine_signatures)
  string(FIND "${reflection_public_normalized}" "${required_signature}"
         required_signature_position)
  if(required_signature_position EQUAL -1)
    message(FATAL_ERROR
            "MemoryReflectionEngine signature differs from API-012-HPP: ${required_signature}")
  endif()
endforeach()

# CCA-REFLECT-012: raw target/provenance construction stays private.
string(REGEX MATCH
       "class[ \t\r\n]+reflection[ \t\r\n]*\\{[ \t\r\n]*public[ \t\r\n]*:([^}]*)private[ \t\r\n]*:"
       reflection_class_public_match
       "${reflection_public_lower}")
if("${reflection_class_public_match}" STREQUAL "")
  message(FATAL_ERROR "Unable to isolate Reflection public API")
endif()
set(reflection_class_public "${CMAKE_MATCH_1}")
string(REGEX MATCH
       "reflection[ \t\r\n]*\\([^)]*std::string"
       forging_constructor
       "${reflection_class_public}")
if(NOT "${forging_constructor}" STREQUAL "")
  message(FATAL_ERROR "Public source-forging Reflection constructor detected")
endif()

# CCA-REFLECT-005: the public Contract depends only on released CCA-KR-1.0;
# its header supplies the released category public types transitively.
string(REGEX MATCHALL "#include[ \t]+<cca/[^>]+>"
       reflection_cca_public_includes "${reflection_public_lower}")
list(LENGTH reflection_cca_public_includes reflection_cca_include_count)
if(NOT reflection_cca_include_count EQUAL 1)
  message(FATAL_ERROR
          "Memory Reflection public Contract must have one CCA dependency")
endif()
string(FIND "${reflection_public_lower}"
       "#include <cca/memory/knowledge_retrieval.hpp>"
       retrieval_dependency_position)
if(retrieval_dependency_position EQUAL -1)
  message(FATAL_ERROR "Released CCA-KR-1.0 dependency is absent")
endif()

set(forbidden_dependencies
    "cca/memory/memory_consolidation.hpp"
    "cca/memory/working_memory.hpp"
    "cca/persistence/"
    "cca/process/"
    "cca/representation/"
    "cca/runtime/"
    "_persistence.hpp"
    "<chrono>"
    "<ctime>"
    "<filesystem>"
    "<fstream>"
    "<thread>"
    "event_bus"
    "scheduler")
foreach(forbidden_dependency IN LISTS forbidden_dependencies)
  string(FIND "${reflection_production_lower}" "${forbidden_dependency}"
         forbidden_dependency_position)
  if(NOT forbidden_dependency_position EQUAL -1)
    message(FATAL_ERROR
            "Memory Reflection has forbidden production dependency: ${forbidden_dependency}")
  endif()
endforeach()

# CCA-REFLECT-019 through CCA-REFLECT-022: reflect may use CP-007 explain,
# while derive must use and retain all three category-Service Results. It must
# not call CP-007 retrieve or reinterpret a bare aggregate accessor.
foreach(required_category_type IN ITEMS
        "semanticmemoryengine"
        "episodicmemoryengine"
        "proceduralmemoryengine"
        "semanticresult"
        "episoderesult"
        "procedureresult")
  string(FIND "${reflection_implementation_lower}"
         "${required_category_type}" category_type_position)
  if(category_type_position EQUAL -1)
    message(FATAL_ERROR
            "Required category retrieval boundary is absent: ${required_category_type}")
  endif()
endforeach()
string(REGEX MATCHALL "\\.retrieve[ \t\r\n]*\\("
       category_retrieve_calls "${reflection_implementation_lower}")
list(LENGTH category_retrieve_calls category_retrieve_call_count)
if(NOT category_retrieve_call_count EQUAL 3)
  message(FATAL_ERROR
          "derive must call exactly the three matching category retrieve operations")
endif()
string(FIND "${reflection_implementation_lower}"
       "memoryretrievalengine" retrieval_engine_position)
string(REGEX MATCHALL "\\.explain[ \t\r\n]*\\("
       retrieval_explain_calls "${reflection_implementation_lower}")
list(LENGTH retrieval_explain_calls retrieval_explain_call_count)
if(retrieval_engine_position EQUAL -1 OR
   NOT retrieval_explain_call_count EQUAL 1)
  message(FATAL_ERROR "reflect must use released CP-007 explain behavior")
endif()
foreach(forbidden_cp007_retrieve IN ITEMS
        "memoryretrievalengine::retrieve"
        "retrieval_engine.retrieve(")
  string(FIND "${reflection_implementation_normalized}"
         "${forbidden_cp007_retrieve}" forbidden_retrieval_position)
  if(NOT forbidden_retrieval_position EQUAL -1)
    message(FATAL_ERROR
            "derive must not consume a detached CP-007 retrieve Result")
  endif()
endforeach()

# Category Results are implementation-local accessibility guards. They must
# not become public state; unit and allocation-failure tests verify their
# lifetime through both fully staged publication values and the no-fail commit.
foreach(category_result IN ITEMS semanticresult episoderesult procedureresult)
  string(FIND "${reflection_public_lower}" "${category_result}"
         public_result_position)
  if(NOT public_result_position EQUAL -1)
    message(FATAL_ERROR
            "Category Result leaked into the public CP-009 Contract: ${category_result}")
  endif()
endforeach()

foreach(forbidden_source_access IN ITEMS
        ".find("
        "const_cast"
        "semantic_engine.classify("
        "semantic_engine.categorize("
        "semantic_engine.link("
        "semantic_engine.update("
        "semantic_engine.forget("
        "episodic_engine.record("
        "episodic_engine.derive("
        "episodic_engine.link("
        "episodic_engine.update("
        "episodic_engine.forget("
        "procedural_engine.derive("
        "procedural_engine.compose("
        "procedural_engine.link("
        "procedural_engine.update("
        "procedural_engine.forget(")
  string(FIND "${reflection_implementation_normalized}"
         "${forbidden_source_access}" forbidden_source_access_position)
  if(NOT forbidden_source_access_position EQUAL -1)
    message(FATAL_ERROR
            "Forbidden source access or mutation: ${forbidden_source_access}")
  endif()
endforeach()

# Released dependencies must not acquire a reverse CP-009 dependency.
set(source_production_files
    "${CCA_CORE_SOURCE_DIR}/include/cca/memory/knowledge_retrieval.hpp"
    "${CCA_CORE_SOURCE_DIR}/src/memory/knowledge_retrieval.cpp"
    "${CCA_CORE_SOURCE_DIR}/include/cca/memory/semantic_memory.hpp"
    "${CCA_CORE_SOURCE_DIR}/src/memory/semantic_memory.cpp"
    "${CCA_CORE_SOURCE_DIR}/include/cca/memory/episodic_memory.hpp"
    "${CCA_CORE_SOURCE_DIR}/src/memory/episodic_memory.cpp"
    "${CCA_CORE_SOURCE_DIR}/include/cca/memory/procedural_memory.hpp"
    "${CCA_CORE_SOURCE_DIR}/src/memory/procedural_memory.cpp")
foreach(source_file IN LISTS source_production_files)
  if(EXISTS "${source_file}")
    file(READ "${source_file}" source_file_text)
    string(FIND "${source_file_text}" "memory_reflection" reverse_include)
    string(FIND "${source_file_text}" "MemoryReflectionEngine" reverse_type)
    if(NOT reverse_include EQUAL -1 OR NOT reverse_type EQUAL -1)
      message(FATAL_ERROR
              "Released source acquired a reverse CP-009 dependency: ${source_file}")
    endif()
  endif()
endforeach()

# CCA-REFLECT-043: no excluded capability may be hidden in the implementation.
foreach(forbidden_behavior IN ITEMS
        "memoryconsolidationengine"
        "longtermmemoryengine"
        "workingmemoryengine"
        "reason"
        "planner"
        "simulation"
        "embedding"
        "vector_search"
        "knowledgegraph"
        "language_model"
        "network"
        "database")
  string(FIND "${reflection_implementation_lower}" "${forbidden_behavior}"
         forbidden_behavior_position)
  if(NOT forbidden_behavior_position EQUAL -1)
    message(FATAL_ERROR
            "Excluded Memory Reflection behavior detected: ${forbidden_behavior}")
  endif()
endforeach()

# CCA-REFLECT-044: the public example exercises exactly the six operations and
# demonstrates both CP-007 preparation and all three live source aggregates.
foreach(example_operation IN ITEMS
        ".reflect("
        ".derive("
        ".explain("
        ".validate("
        ".retrievesession("
        ".forgetsession(")
  string(FIND "${reflection_example_normalized}" "${example_operation}"
         example_operation_position)
  if(example_operation_position EQUAL -1)
    message(FATAL_ERROR
            "Memory Reflection example omits: ${example_operation}")
  endif()
endforeach()
foreach(example_boundary IN ITEMS
        "retrievalsession"
        "semanticmemory"
        "episodicmemory"
        "proceduralmemory"
        "reflectionquery"
        "reflectionsession")
  string(FIND "${reflection_example_lower}" "${example_boundary}"
         example_boundary_position)
  if(example_boundary_position EQUAL -1)
    message(FATAL_ERROR
            "Memory Reflection example omits boundary: ${example_boundary}")
  endif()
endforeach()

# CCA-REFLECT-045: all requirements have documentation and automated evidence.
set(reflection_test_evidence
    "${reflection_unit_test_text}\n${reflection_allocation_test_text}")
foreach(requirement_number RANGE 1 45)
  if(requirement_number LESS 10)
    set(requirement_suffix "00${requirement_number}")
  else()
    set(requirement_suffix "0${requirement_number}")
  endif()
  set(requirement_id "CCA-REFLECT-${requirement_suffix}")
  string(FIND "${reflection_documentation_text}" "${requirement_id}"
         documentation_requirement_position)
  if(documentation_requirement_position EQUAL -1)
    message(FATAL_ERROR
            "Documentation omits requirement: ${requirement_id}")
  endif()
  string(FIND "${reflection_test_evidence}" "${requirement_id}"
         test_requirement_position)
  if(test_requirement_position EQUAL -1)
    message(FATAL_ERROR
            "Automated traceability omits requirement: ${requirement_id}")
  endif()
endforeach()

# Production, unit, allocation, architecture, documentation, and example must
# all be registered in the C++23 warnings-as-errors build/test graph.
set(cca_core_cmake "${CCA_CORE_SOURCE_DIR}/CMakeLists.txt")
set(cca_core_tests_cmake "${CCA_CORE_SOURCE_DIR}/tests/CMakeLists.txt")
foreach(build_file IN ITEMS cca_core_cmake cca_core_tests_cmake)
  if(NOT EXISTS "${${build_file}}")
    message(FATAL_ERROR "Missing build registration file: ${${build_file}}")
  endif()
endforeach()
file(READ "${cca_core_cmake}" cca_core_cmake_text)
file(READ "${cca_core_tests_cmake}" cca_core_tests_cmake_text)
string(TOLOWER "${cca_core_cmake_text}" cca_core_cmake_lower)
string(TOLOWER "${cca_core_tests_cmake_text}" cca_core_tests_cmake_lower)
string(REGEX REPLACE "[ \t\r\n]+" " " cca_core_cmake_normalized
       "${cca_core_cmake_lower}")
string(REGEX REPLACE "[ \t\r\n]+" " " cca_core_tests_cmake_normalized
       "${cca_core_tests_cmake_lower}")

foreach(core_registration IN ITEMS
        "src/memory/memory_reflection.cpp"
        "cca_memory_reflection_example"
        "examples/memory_reflection_usage.cpp"
        "cca_configure_target(cca_memory_reflection_example)"
        "cca.memory_reflection.example"
        "example;memory;memory_reflection")
  string(FIND "${cca_core_cmake_normalized}" "${core_registration}"
         core_registration_position)
  if(core_registration_position EQUAL -1)
    message(FATAL_ERROR
            "Core build omits Memory Reflection registration: ${core_registration}")
  endif()
endforeach()

foreach(test_registration IN ITEMS
        "memory_reflection_test.cpp"
        "memory_reflection_architecture_test.cmake"
        "cca.memory_reflection.architecture"
        "memory_reflection_allocation_failure_test.cpp"
        "cca_memory_reflection_allocation_tests")
  string(FIND "${cca_core_tests_cmake_normalized}" "${test_registration}"
         test_registration_position)
  if(test_registration_position EQUAL -1)
    message(FATAL_ERROR
            "Test build omits Memory Reflection registration: ${test_registration}")
  endif()
endforeach()

message(STATUS "Memory Reflection architecture checks passed")

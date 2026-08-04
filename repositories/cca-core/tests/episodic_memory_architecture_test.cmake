set(episodic_public_header
    "${CCA_CORE_SOURCE_DIR}/include/cca/memory/episodic_memory.hpp")
set(episodic_implementation
    "${CCA_CORE_SOURCE_DIR}/src/memory/episodic_memory.cpp")
set(episodic_persistence_header
    "${CCA_CORE_SOURCE_DIR}/src/memory/episodic_memory_persistence.hpp")
set(episodic_persistence_implementation
    "${CCA_CORE_SOURCE_DIR}/src/memory/episodic_memory_persistence.cpp")
set(episodic_unit_test
    "${CCA_CORE_SOURCE_DIR}/tests/episodic_memory_test.cpp")
set(episodic_allocation_test
    "${CCA_CORE_SOURCE_DIR}/tests/episodic_memory_allocation_failure_test.cpp")
set(episodic_documentation
    "${CCA_CORE_SOURCE_DIR}/docs/episodic-memory.md")
set(episodic_example
    "${CCA_CORE_SOURCE_DIR}/examples/episodic_memory_usage.cpp")

foreach(required_file IN LISTS
        episodic_public_header
        episodic_implementation
        episodic_persistence_header
        episodic_persistence_implementation
        episodic_unit_test
        episodic_allocation_test
        episodic_documentation
        episodic_example)
  if(NOT EXISTS "${required_file}")
    message(FATAL_ERROR "Missing Episodic Memory evidence: ${required_file}")
  endif()
endforeach()

file(READ "${episodic_public_header}" episodic_public_text)
file(READ "${episodic_implementation}" episodic_implementation_text)
file(READ "${episodic_persistence_header}" episodic_persistence_header_text)
file(READ "${episodic_persistence_implementation}"
     episodic_persistence_implementation_text)
file(READ "${episodic_unit_test}" episodic_unit_test_text)
file(READ "${episodic_allocation_test}" episodic_allocation_test_text)
file(READ "${episodic_documentation}" episodic_documentation_text)
file(READ "${episodic_example}" episodic_example_text)

string(TOLOWER "${episodic_public_text}" episodic_public_lower)
string(TOLOWER "${episodic_implementation_text}"
       episodic_implementation_lower)
string(TOLOWER
       "${episodic_persistence_header_text}\n${episodic_persistence_implementation_text}"
       episodic_persistence_lower)
string(TOLOWER
       "${episodic_public_text}\n${episodic_implementation_text}\n${episodic_persistence_header_text}\n${episodic_persistence_implementation_text}"
       episodic_production_lower)
string(TOLOWER "${episodic_example_text}" episodic_example_lower)

# CCA-EPMEM-002 and CCA-EPMEM-003: exactly four public Assets and one
# stateless Service are defined, with exactly the seven frozen operations.
string(REGEX MATCHALL
       "class[ \t\r\n]+[a-z_][a-z0-9_]*[ \t\r\n]*(final[ \t\r\n]*)?\\{"
       episodic_public_classes
       "${episodic_public_lower}")
list(LENGTH episodic_public_classes episodic_public_class_count)
if(NOT episodic_public_class_count EQUAL 5)
  message(FATAL_ERROR
          "Episodic Memory must define exactly four Assets and one Service")
endif()

foreach(required_class IN ITEMS
        episode
        episodequery
        episodicmemory
        episoderesult
        episodicmemoryengine)
  string(REGEX MATCHALL
         "class[ \t\r\n]+${required_class}[ \t\r\n]*(final[ \t\r\n]*)?\\{"
         class_matches
         "${episodic_public_lower}")
  list(LENGTH class_matches class_match_count)
  if(NOT class_match_count EQUAL 1)
    message(FATAL_ERROR
            "Episodic Memory public class must appear exactly once: ${required_class}")
  endif()
endforeach()

string(REGEX MATCH
       "class[ \t\r\n]+episodicmemoryengine[ \t\r\n]*(final[ \t\r\n]*)?\\{([^}]*)\\}"
       episodic_engine_match
       "${episodic_public_lower}")
if("${episodic_engine_match}" STREQUAL "")
  message(FATAL_ERROR "Unable to inspect EpisodicMemoryEngine")
endif()
set(episodic_engine_body "${CMAKE_MATCH_2}")

string(REGEX MATCHALL
       "episoderesult[ \t\r\n]+[a-z_][a-z0-9_]*[ \t\r\n]*\\("
       episodic_operations
       "${episodic_engine_body}")
list(LENGTH episodic_operations episodic_operation_count)
if(NOT episodic_operation_count EQUAL 7)
  message(FATAL_ERROR
          "EpisodicMemoryEngine must expose exactly seven operations")
endif()

foreach(required_operation IN ITEMS
        record
        derive
        retrieve
        search
        link
        update
        forget)
  string(REGEX MATCHALL
         "episoderesult[ \t\r\n]+${required_operation}[ \t\r\n]*\\("
         operation_matches
         "${episodic_engine_body}")
  list(LENGTH operation_matches operation_match_count)
  if(NOT operation_match_count EQUAL 1)
    message(FATAL_ERROR
            "Episodic operation must appear exactly once: ${required_operation}")
  endif()
endforeach()

# API-008-HPP: the public chronology and provenance declarations use the
# exact released types, and both establishment operations receive const
# Long-Term evidence plus one detached Episode value.
foreach(required_declaration IN ITEMS
        "std::int64_t[ \t\r\n]+chronology[ \t\r\n]*\\([ \t\r\n]*\\)[ \t\r\n]*const[ \t\r\n]+noexcept"
        "vector<longtermmemoryentry>[ \t\r\n]*&[ \t\r\n]*sourceentries[ \t\r\n]*\\([ \t\r\n]*\\)[ \t\r\n]*const[ \t\r\n]+noexcept"
        "vector<std::string>[ \t\r\n]*&[ \t\r\n]*linkedepisodeidentifiers[ \t\r\n]*\\([ \t\r\n]*\\)[ \t\r\n]*const[ \t\r\n]+noexcept")
  string(REGEX MATCH "${required_declaration}" declaration_match
         "${episodic_public_lower}")
  if("${declaration_match}" STREQUAL "")
    message(FATAL_ERROR
            "Required Episodic public declaration is absent: ${required_declaration}")
  endif()
endforeach()

string(REGEX MATCHALL
       "const[ \t\r\n]+longtermmemory[ \t\r\n]*&[ \t\r\n]*evidence"
       establishment_evidence_parameters
       "${episodic_engine_body}")
list(LENGTH establishment_evidence_parameters evidence_parameter_count)
if(NOT evidence_parameter_count EQUAL 2)
  message(FATAL_ERROR
          "record and derive must each accept const LongTermMemory evidence")
endif()

# CCA-EPMEM-001, 005, 007, 008, 030, 032, and 033: the installed contract
# depends only on released CCA-LTMEM and standard headers.
string(FIND "${episodic_public_lower}"
       "#include <cca/memory/long_term_memory.hpp>"
       long_term_include_position)
if(long_term_include_position EQUAL -1)
  message(FATAL_ERROR "Released Long-Term Memory dependency is absent")
endif()

set(forbidden_public_headers
    "cca/memory/memory.hpp"
    "cca/memory/working_memory.hpp"
    "cca/memory/semantic_memory.hpp"
    "cca/persistence/"
    "cca/process/"
    "cca/representation/"
    "cca/runtime/")
foreach(forbidden_header IN LISTS forbidden_public_headers)
  string(FIND "${episodic_public_lower}" "${forbidden_header}"
         forbidden_header_position)
  if(NOT forbidden_header_position EQUAL -1)
    message(FATAL_ERROR
            "Episodic public contract has forbidden dependency: ${forbidden_header}")
  endif()
endforeach()

# The core consumes only released public CP-003 observations. It must not use
# a Long-Term Service, CP-003 private persistence state, infrastructure, or a
# clock to establish Episodic state.
set(forbidden_core_dependencies
    "cca/memory/memory.hpp"
    "cca/memory/working_memory.hpp"
    "cca/memory/semantic_memory.hpp"
    "long_term_memory_persistence.hpp"
    "cca/persistence/"
    "cca/process/"
    "cca/representation/"
    "cca/runtime/"
    "longtermmemoryengine")
foreach(forbidden_dependency IN LISTS forbidden_core_dependencies)
  string(FIND "${episodic_implementation_lower}" "${forbidden_dependency}"
         forbidden_dependency_position)
  if(NOT forbidden_dependency_position EQUAL -1)
    message(FATAL_ERROR
            "Episodic core has forbidden dependency: ${forbidden_dependency}")
  endif()
endforeach()

set(forbidden_nondeterminism
    "<chrono>"
    "<ctime>"
    "system_clock"
    "steady_clock"
    "high_resolution_clock"
    "random_device"
    "event_bus"
    "scheduler"
    "sleep_for"
    "sleep_until")
foreach(forbidden_source IN LISTS forbidden_nondeterminism)
  string(FIND "${episodic_production_lower}" "${forbidden_source}"
         forbidden_source_position)
  if(NOT forbidden_source_position EQUAL -1)
    message(FATAL_ERROR
            "Episodic behavior depends on forbidden source: ${forbidden_source}")
  endif()
endforeach()

# CCA-EPMEM-030/031: Persistence uses one non-installed private seam and the
# existing Representation/Persistence boundary. It may encode public source
# snapshots, but may not use a Long-Term engine or private adapter.
string(REGEX MATCH
       "class[ \t\r\n]+episodicmemorypersistence[ \t\r\n]*\\{([^}]*)\\}"
       persistence_class_match
       "${episodic_persistence_lower}")
if("${persistence_class_match}" STREQUAL "")
  message(FATAL_ERROR "Private Episodic Persistence adapter is absent")
endif()
set(persistence_class_body "${CMAKE_MATCH_1}")
string(REGEX MATCHALL "static[ \t\r\n]+" persistence_static_operations
       "${persistence_class_body}")
list(LENGTH persistence_static_operations persistence_static_count)
if(NOT persistence_static_count EQUAL 3)
  message(FATAL_ERROR
          "Private Episodic Persistence seam must expose exactly three operations")
endif()
foreach(private_operation IN ITEMS project reconstruct roundtrip)
  string(REGEX MATCHALL "${private_operation}[ \t\r\n]*\\("
         private_operation_matches "${persistence_class_body}")
  list(LENGTH private_operation_matches private_operation_count)
  if(NOT private_operation_count EQUAL 1)
    message(FATAL_ERROR
            "Private persistence operation must appear exactly once: ${private_operation}")
  endif()
endforeach()

foreach(required_private_dependency IN ITEMS
        "cca/representation/representation.hpp"
        "cca/persistence/persistence.hpp")
  string(FIND "${episodic_persistence_lower}"
         "${required_private_dependency}"
         required_private_dependency_position)
  if(required_private_dependency_position EQUAL -1)
    message(FATAL_ERROR
            "Episodic Persistence dependency is absent: ${required_private_dependency}")
  endif()
endforeach()

set(forbidden_persistence_choices
    "long_term_memory_persistence"
    "longtermmemoryengine"
    "persistenceformat"
    "cca/runtime/"
    "<filesystem>"
    "<fstream>"
    "database"
    "socket"
    "network"
    "cloud"
    "compression"
    "encryption")
foreach(forbidden_choice IN LISTS forbidden_persistence_choices)
  string(FIND "${episodic_persistence_lower}" "${forbidden_choice}"
         forbidden_choice_position)
  if(NOT forbidden_choice_position EQUAL -1)
    message(FATAL_ERROR
            "Episodic Persistence selects forbidden behavior: ${forbidden_choice}")
  endif()
endforeach()

# CCA-EPMEM-034 through 036: no excluded capability or hidden operation may
# enter the public or production boundary.
set(excluded_capability_patterns
    "semantic_memory"
    "semanticmemory"
    "semanticconcept"
    "procedural_memory"
    "proceduralmemory"
    "reflection"
    "consolidation"
    "knowledge[ _-]*graph"
    "embedding"
    "vector[ _-]*(search|index)"
    "similarity[ _-]*(search|index)"
    "(^|[^a-z0-9_])llm([^a-z0-9_]|$)"
    "memory[ _-]*studio"
    "(^|[^a-z0-9_])ai([^a-z0-9_]|$)")
foreach(excluded_pattern IN LISTS excluded_capability_patterns)
  string(REGEX MATCH "${excluded_pattern}" excluded_match
         "${episodic_production_lower}")
  if(NOT "${excluded_match}" STREQUAL "")
    message(FATAL_ERROR
            "Excluded capability leaked into Episodic Memory: ${excluded_match}")
  endif()
endforeach()

set(prohibited_operation_patterns
    "episoderesult[ \t\r\n]+archive[ \t\r\n]*\\("
    "episoderesult[ \t\r\n]+unlink[ \t\r\n]*\\("
    "episoderesult[ \t\r\n]+infer[a-z0-9_]*[ \t\r\n]*\\("
    "episoderesult[ \t\r\n]+reason[a-z0-9_]*[ \t\r\n]*\\(")
foreach(prohibited_pattern IN LISTS prohibited_operation_patterns)
  string(REGEX MATCH "${prohibited_pattern}" prohibited_operation
         "${episodic_public_lower}")
  if(NOT "${prohibited_operation}" STREQUAL "")
    message(FATAL_ERROR
            "Prohibited Episodic operation exposed: ${prohibited_operation}")
  endif()
endforeach()

# CCA-EPMEM-037 through 039: each requirement has evidence; production,
# tests, documentation, and the seven-operation example are registered under
# repository warning and warnings-as-errors gates.
set(traceability_text
    "${episodic_unit_test_text}\n${episodic_allocation_test_text}\n${episodic_documentation_text}")
foreach(requirement_number RANGE 1 39)
  if(requirement_number LESS 10)
    set(requirement_suffix "00${requirement_number}")
  else()
    set(requirement_suffix "0${requirement_number}")
  endif()
  string(FIND "${traceability_text}"
       "CCA-EPMEM-${requirement_suffix}"
       requirement_position)
  if(requirement_position EQUAL -1)
    message(FATAL_ERROR
            "Missing verification trace for CCA-EPMEM-${requirement_suffix}")
  endif()
endforeach()

foreach(example_operation IN ITEMS
        record derive retrieve search link update forget)
  string(REGEX MATCH "\\.${example_operation}[ \t\r\n]*\\("
         example_operation_match "${episodic_example_lower}")
  if("${example_operation_match}" STREQUAL "")
    message(FATAL_ERROR
            "Episodic example omits operation: ${example_operation}")
  endif()
endforeach()

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

foreach(required_source IN ITEMS
        "src/memory/episodic_memory.cpp"
        "src/memory/episodic_memory_persistence.cpp")
  string(FIND "${core_cmake_lower}" "${required_source}"
         source_registration_position)
  if(source_registration_position EQUAL -1)
    message(FATAL_ERROR
            "Episodic production source is not registered: ${required_source}")
  endif()
endforeach()
foreach(required_build_token IN ITEMS
        "episodic_memory_test.cpp"
        "episodic_memory_allocation_failure_test.cpp"
        "episodic_memory_architecture_test.cmake"
        "cca_episodic_memory_allocation_tests")
  string(FIND "${test_cmake_lower}" "${required_build_token}"
         test_registration_position)
  if(test_registration_position EQUAL -1)
    message(FATAL_ERROR
            "Episodic verification is not registered: ${required_build_token}")
  endif()
endforeach()
foreach(required_example_token IN ITEMS
        "episodic_memory_usage.cpp"
        "cca_episodic_memory_example"
        "cca_configure_target(cca_episodic_memory_example)")
  string(FIND "${core_cmake_lower}" "${required_example_token}"
         example_registration_position)
  if(example_registration_position EQUAL -1)
    message(FATAL_ERROR
            "Episodic example/build gate is absent: ${required_example_token}")
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

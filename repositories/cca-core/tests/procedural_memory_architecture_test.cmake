set(procedural_public_header
    "${CCA_CORE_SOURCE_DIR}/include/cca/memory/procedural_memory.hpp")
set(procedural_implementation
    "${CCA_CORE_SOURCE_DIR}/src/memory/procedural_memory.cpp")
set(procedural_persistence_header
    "${CCA_CORE_SOURCE_DIR}/src/memory/procedural_memory_persistence.hpp")
set(procedural_persistence_implementation
    "${CCA_CORE_SOURCE_DIR}/src/memory/procedural_memory_persistence.cpp")
set(procedural_unit_test
    "${CCA_CORE_SOURCE_DIR}/tests/procedural_memory_test.cpp")
set(procedural_allocation_test
    "${CCA_CORE_SOURCE_DIR}/tests/procedural_memory_allocation_failure_test.cpp")
set(procedural_documentation
    "${CCA_CORE_SOURCE_DIR}/docs/procedural-memory.md")
set(procedural_example
    "${CCA_CORE_SOURCE_DIR}/examples/procedural_memory_usage.cpp")

foreach(required_file IN LISTS
        procedural_public_header
        procedural_implementation
        procedural_persistence_header
        procedural_persistence_implementation
        procedural_unit_test
        procedural_allocation_test
        procedural_documentation
        procedural_example)
  if(NOT EXISTS "${required_file}")
    message(FATAL_ERROR "Missing Procedural Memory evidence: ${required_file}")
  endif()
endforeach()

file(READ "${procedural_public_header}" procedural_public_text)
file(READ "${procedural_implementation}" procedural_implementation_text)
file(READ "${procedural_persistence_header}"
     procedural_persistence_header_text)
file(READ "${procedural_persistence_implementation}"
     procedural_persistence_implementation_text)
file(READ "${procedural_unit_test}" procedural_unit_test_text)
file(READ "${procedural_allocation_test}" procedural_allocation_test_text)
file(READ "${procedural_documentation}" procedural_documentation_text)
file(READ "${procedural_example}" procedural_example_text)

string(TOLOWER "${procedural_public_text}" procedural_public_lower)
string(TOLOWER "${procedural_implementation_text}"
       procedural_implementation_lower)
string(TOLOWER
       "${procedural_persistence_header_text}\n${procedural_persistence_implementation_text}"
       procedural_persistence_lower)
string(TOLOWER
       "${procedural_public_text}\n${procedural_implementation_text}\n${procedural_persistence_header_text}\n${procedural_persistence_implementation_text}"
       procedural_production_lower)
string(TOLOWER "${procedural_documentation_text}" procedural_documentation_lower)
string(TOLOWER "${procedural_example_text}" procedural_example_lower)

# CCA-PRMEM-002 and CCA-PRMEM-003: exactly four public Assets and one
# stateless Service, with exactly the seven frozen operations.
string(REGEX MATCHALL
       "class[ \t\r\n]+[a-z_][a-z0-9_]*[ \t\r\n]*(final[ \t\r\n]*)?\\{"
       procedural_public_classes
       "${procedural_public_lower}")
list(LENGTH procedural_public_classes procedural_public_class_count)
if(NOT procedural_public_class_count EQUAL 5)
  message(FATAL_ERROR
          "Procedural Memory must define exactly four Assets and one Service")
endif()

foreach(required_class IN ITEMS
        procedure
        procedurequery
        proceduralmemory
        procedureresult
        proceduralmemoryengine)
  string(REGEX MATCHALL
         "class[ \t\r\n]+${required_class}[ \t\r\n]*(final[ \t\r\n]*)?\\{"
         class_matches
         "${procedural_public_lower}")
  list(LENGTH class_matches class_match_count)
  if(NOT class_match_count EQUAL 1)
    message(FATAL_ERROR
            "Procedural Memory public class must appear exactly once: ${required_class}")
  endif()
endforeach()

string(REGEX MATCH
       "class[ \t\r\n]+proceduralmemoryengine[ \t\r\n]*(final[ \t\r\n]*)?\\{([^}]*)\\}"
       procedural_engine_match
       "${procedural_public_lower}")
if("${procedural_engine_match}" STREQUAL "")
  message(FATAL_ERROR "Unable to inspect ProceduralMemoryEngine")
endif()
set(procedural_engine_body "${CMAKE_MATCH_2}")

string(REGEX MATCHALL
       "procedureresult[ \t\r\n]+[a-z_][a-z0-9_]*[ \t\r\n]*\\("
       procedural_operations
       "${procedural_engine_body}")
list(LENGTH procedural_operations procedural_operation_count)
if(NOT procedural_operation_count EQUAL 7)
  message(FATAL_ERROR
          "ProceduralMemoryEngine must expose exactly seven operations")
endif()

foreach(required_operation IN ITEMS
        derive compose retrieve search link update forget)
  string(REGEX MATCHALL
         "procedureresult[ \t\r\n]+${required_operation}[ \t\r\n]*\\("
         operation_matches
         "${procedural_engine_body}")
  list(LENGTH operation_matches operation_match_count)
  if(NOT operation_match_count EQUAL 1)
    message(FATAL_ERROR
            "Procedural operation must appear exactly once: ${required_operation}")
  endif()
endforeach()

# API-009-HPP exact ordered content/provenance/link declarations.
foreach(required_declaration IN ITEMS
        "string[ \t\r\n]*&[ \t\r\n]*activity[ \t\r\n]*\\([ \t\r\n]*\\)[ \t\r\n]*const[ \t\r\n]+noexcept"
        "vector<std::string>[ \t\r\n]*&[ \t\r\n]*steps[ \t\r\n]*\\([ \t\r\n]*\\)[ \t\r\n]*const[ \t\r\n]+noexcept"
        "vector<longtermmemoryentry>[ \t\r\n]*&[ \t\r\n]*sourceentries[ \t\r\n]*\\([ \t\r\n]*\\)[ \t\r\n]*const[ \t\r\n]+noexcept"
        "vector<std::string>[ \t\r\n]*&[ \t\r\n]*linkedprocedureidentifiers[ \t\r\n]*\\([ \t\r\n]*\\)[ \t\r\n]*const[ \t\r\n]+noexcept")
  string(REGEX MATCH "${required_declaration}" declaration_match
         "${procedural_public_lower}")
  if("${declaration_match}" STREQUAL "")
    message(FATAL_ERROR
            "Required Procedural declaration is absent: ${required_declaration}")
  endif()
endforeach()

string(REGEX MATCHALL
       "const[ \t\r\n]+longtermmemory[ \t\r\n]*&[ \t\r\n]*evidence"
       establishment_evidence_parameters
       "${procedural_engine_body}")
list(LENGTH establishment_evidence_parameters evidence_parameter_count)
if(NOT evidence_parameter_count EQUAL 2)
  message(FATAL_ERROR
          "derive and compose must each accept const LongTermMemory evidence")
endif()

# CCA-PRMEM-001, 005, 007, 035: the installed Contract depends only on the
# released CP-003 public header and standard headers.
string(FIND "${procedural_public_lower}"
       "#include <cca/memory/long_term_memory.hpp>"
       long_term_include_position)
if(long_term_include_position EQUAL -1)
  message(FATAL_ERROR "Released Long-Term Memory dependency is absent")
endif()

set(forbidden_public_headers
    "cca/memory/memory.hpp"
    "cca/memory/working_memory.hpp"
    "cca/memory/semantic_memory.hpp"
    "cca/memory/episodic_memory.hpp"
    "cca/persistence/"
    "cca/process/"
    "cca/representation/"
    "cca/runtime/")
foreach(forbidden_header IN LISTS forbidden_public_headers)
  string(FIND "${procedural_public_lower}" "${forbidden_header}"
         forbidden_header_position)
  if(NOT forbidden_header_position EQUAL -1)
    message(FATAL_ERROR
            "Procedural public Contract has forbidden dependency: ${forbidden_header}")
  endif()
endforeach()

set(forbidden_core_dependencies
    "cca/memory/memory.hpp"
    "cca/memory/working_memory.hpp"
    "cca/memory/semantic_memory.hpp"
    "cca/memory/episodic_memory.hpp"
    "long_term_memory_persistence.hpp"
    "cca/persistence/"
    "cca/process/"
    "cca/representation/"
    "cca/runtime/"
    "longtermmemoryengine")
foreach(forbidden_dependency IN LISTS forbidden_core_dependencies)
  string(FIND "${procedural_implementation_lower}"
         "${forbidden_dependency}"
         forbidden_dependency_position)
  if(NOT forbidden_dependency_position EQUAL -1)
    message(FATAL_ERROR
            "Procedural core has forbidden dependency: ${forbidden_dependency}")
  endif()
endforeach()

# Verify that CP-003 does not acquire the forbidden reverse dependency.
set(long_term_production_files
    "${CCA_CORE_SOURCE_DIR}/include/cca/memory/long_term_memory.hpp"
    "${CCA_CORE_SOURCE_DIR}/src/memory/long_term_memory.cpp"
    "${CCA_CORE_SOURCE_DIR}/src/memory/long_term_memory_persistence.hpp"
    "${CCA_CORE_SOURCE_DIR}/src/memory/long_term_memory_persistence.cpp")
set(long_term_production_text "")
foreach(long_term_file IN LISTS long_term_production_files)
  if(EXISTS "${long_term_file}")
    file(READ "${long_term_file}" long_term_file_text)
    string(APPEND long_term_production_text "\n${long_term_file_text}")
  endif()
endforeach()
string(TOLOWER "${long_term_production_text}" long_term_production_lower)
foreach(reverse_dependency IN ITEMS
        "procedural_memory"
        "proceduralmemory"
        "procedureresult"
        "proceduralmemoryengine")
  string(FIND "${long_term_production_lower}" "${reverse_dependency}"
         reverse_dependency_position)
  if(NOT reverse_dependency_position EQUAL -1)
    message(FATAL_ERROR
            "Long-Term Memory acquired reverse Procedural dependency: ${reverse_dependency}")
  endif()
endforeach()

# CCA-PRMEM-014, 029, 031, and 034: no nondeterministic source participates.
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
  string(FIND "${procedural_production_lower}" "${forbidden_source}"
         forbidden_source_position)
  if(NOT forbidden_source_position EQUAL -1)
    message(FATAL_ERROR
            "Procedural behavior depends on forbidden source: ${forbidden_source}")
  endif()
endforeach()

# CCA-PRMEM-032/033: Persistence is one non-installed, private,
# provider-independent seam using only the existing boundary.
string(REGEX MATCH
       "class[ \t\r\n]+proceduralmemorypersistence[ \t\r\n]*\\{([^}]*)\\}"
       persistence_class_match
       "${procedural_persistence_lower}")
if("${persistence_class_match}" STREQUAL "")
  message(FATAL_ERROR "Private Procedural Persistence adapter is absent")
endif()
set(persistence_class_body "${CMAKE_MATCH_1}")
string(REGEX MATCHALL "static[ \t\r\n]+" persistence_static_operations
       "${persistence_class_body}")
list(LENGTH persistence_static_operations persistence_static_count)
if(NOT persistence_static_count EQUAL 3)
  message(FATAL_ERROR
          "Private Procedural Persistence seam must expose exactly three operations")
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
  string(FIND "${procedural_persistence_lower}"
         "${required_private_dependency}"
         required_private_dependency_position)
  if(required_private_dependency_position EQUAL -1)
    message(FATAL_ERROR
            "Procedural Persistence dependency is absent: ${required_private_dependency}")
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
  string(FIND "${procedural_persistence_lower}" "${forbidden_choice}"
         forbidden_choice_position)
  if(NOT forbidden_choice_position EQUAL -1)
    message(FATAL_ERROR
            "Procedural Persistence selects forbidden behavior: ${forbidden_choice}")
  endif()
endforeach()

# CCA-PRMEM-036 through 038: excluded capabilities and hidden operations do
# not enter public or production boundaries.
set(excluded_capability_patterns
    "semantic_memory"
    "semanticmemory"
    "semanticconcept"
    "episodic_memory"
    "episodicmemory"
    "episoderesult"
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
         "${procedural_production_lower}")
  if(NOT "${excluded_match}" STREQUAL "")
    message(FATAL_ERROR
            "Excluded capability leaked into Procedural Memory: ${excluded_match}")
  endif()
endforeach()

set(prohibited_operation_patterns
    "procedureresult[ \t\r\n]+execute[ \t\r\n]*\\("
    "procedureresult[ \t\r\n]+schedule[ \t\r\n]*\\("
    "procedureresult[ \t\r\n]+plan[ \t\r\n]*\\("
    "procedureresult[ \t\r\n]+archive[ \t\r\n]*\\("
    "procedureresult[ \t\r\n]+restore[ \t\r\n]*\\("
    "procedureresult[ \t\r\n]+unlink[ \t\r\n]*\\("
    "procedureresult[ \t\r\n]+infer[a-z0-9_]*[ \t\r\n]*\\("
    "procedureresult[ \t\r\n]+reason[a-z0-9_]*[ \t\r\n]*\\(")
foreach(prohibited_pattern IN LISTS prohibited_operation_patterns)
  string(REGEX MATCH "${prohibited_pattern}" prohibited_operation
         "${procedural_public_lower}")
  if(NOT "${prohibited_operation}" STREQUAL "")
    message(FATAL_ERROR
            "Prohibited Procedural operation exposed: ${prohibited_operation}")
  endif()
endforeach()

# CCA-PRMEM-026: public documentation contains the closed result-code set.
foreach(required_code IN ITEMS
        ok
        workspace_mismatch
        invalid_identifier
        invalid_activity
        invalid_steps
        invalid_source_cardinality
        invalid_provenance
        source_not_long_term
        invalid_procedure_state
        forgotten_identifier
        identifier_conflict
        source_not_found
        source_mismatch
        invalid_relationship
        not_found)
  string(FIND "${procedural_documentation_lower}" "${required_code}"
         result_code_position)
  if(result_code_position EQUAL -1)
    message(FATAL_ERROR
            "Procedural documentation omits result code: ${required_code}")
  endif()
endforeach()

# CCA-PRMEM-039 through 041: every requirement has evidence and every
# implementation/test/example target is under repository gates.
set(traceability_text
    "${procedural_unit_test_text}\n${procedural_allocation_test_text}\n${procedural_documentation_text}")
foreach(requirement_number RANGE 1 41)
  if(requirement_number LESS 10)
    set(requirement_suffix "00${requirement_number}")
  else()
    set(requirement_suffix "0${requirement_number}")
  endif()
  string(FIND "${traceability_text}"
       "CCA-PRMEM-${requirement_suffix}"
       requirement_position)
  if(requirement_position EQUAL -1)
    message(FATAL_ERROR
            "Missing verification trace for CCA-PRMEM-${requirement_suffix}")
  endif()
endforeach()

foreach(example_operation IN ITEMS
        derive compose retrieve search link update forget)
  string(REGEX MATCH "\\.${example_operation}[ \t\r\n]*\\("
         example_operation_match "${procedural_example_lower}")
  if("${example_operation_match}" STREQUAL "")
    message(FATAL_ERROR
            "Procedural example omits operation: ${example_operation}")
  endif()
endforeach()

string(FIND "${procedural_example_lower}"
       "#include <cca/memory/procedural_memory.hpp>"
       public_example_include_position)
if(public_example_include_position EQUAL -1)
  message(FATAL_ERROR
          "Procedural example does not use the installed public Contract")
endif()
foreach(private_example_token IN ITEMS
        "procedural_memory_persistence"
        "cca/representation/"
        "cca/persistence/"
        "cca/runtime/")
  string(FIND "${procedural_example_lower}" "${private_example_token}"
         private_example_position)
  if(NOT private_example_position EQUAL -1)
    message(FATAL_ERROR
            "Procedural example crosses a private boundary: ${private_example_token}")
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
        "src/memory/procedural_memory.cpp"
        "src/memory/procedural_memory_persistence.cpp")
  string(FIND "${core_cmake_lower}" "${required_source}"
         source_registration_position)
  if(source_registration_position EQUAL -1)
    message(FATAL_ERROR
            "Procedural production source is not registered: ${required_source}")
  endif()
endforeach()
foreach(required_build_token IN ITEMS
        "procedural_memory_test.cpp"
        "procedural_memory_allocation_failure_test.cpp"
        "procedural_memory_architecture_test.cmake"
        "cca_procedural_memory_allocation_tests")
  string(FIND "${test_cmake_lower}" "${required_build_token}"
         test_registration_position)
  if(test_registration_position EQUAL -1)
    message(FATAL_ERROR
            "Procedural verification is not registered: ${required_build_token}")
  endif()
endforeach()
foreach(required_example_token IN ITEMS
        "procedural_memory_usage.cpp"
        "cca_procedural_memory_example"
        "cca_configure_target(cca_procedural_memory_example)")
  string(FIND "${core_cmake_lower}" "${required_example_token}"
         example_registration_position)
  if(example_registration_position EQUAL -1)
    message(FATAL_ERROR
            "Procedural example/build gate is absent: ${required_example_token}")
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

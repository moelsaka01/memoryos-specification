set(consolidation_public_header
    "${CCA_CORE_SOURCE_DIR}/include/cca/memory/memory_consolidation.hpp")
set(consolidation_implementation
    "${CCA_CORE_SOURCE_DIR}/src/memory/memory_consolidation.cpp")
set(consolidation_documentation
    "${CCA_CORE_SOURCE_DIR}/docs/memory-consolidation.md")
set(consolidation_example
    "${CCA_CORE_SOURCE_DIR}/examples/memory_consolidation_usage.cpp")
set(consolidation_unit_test
    "${CCA_CORE_SOURCE_DIR}/tests/memory_consolidation_test.cpp")
set(consolidation_allocation_test
    "${CCA_CORE_SOURCE_DIR}/tests/memory_consolidation_allocation_failure_test.cpp")

foreach(required_file IN ITEMS
        consolidation_public_header
        consolidation_implementation
        consolidation_documentation
        consolidation_example
        consolidation_unit_test
        consolidation_allocation_test)
  if(NOT EXISTS "${${required_file}}")
    message(FATAL_ERROR
            "Missing Memory Consolidation deliverable: ${${required_file}}")
  endif()
endforeach()

file(READ "${consolidation_public_header}" consolidation_public_text)
file(READ "${consolidation_implementation}" consolidation_implementation_text)
string(TOLOWER "${consolidation_public_text}" consolidation_public_lower)
string(TOLOWER
       "${consolidation_implementation_text}"
       consolidation_implementation_lower)

# CCA-CONS-003, CCA-CONS-004, and API-011-HPP: exactly four public Assets and
# the single stateless Service are defined, with exactly the six frozen
# operations and no overloads.
string(REGEX MATCHALL
       "class[ \t\r\n]+(consolidation(request|candidate|result|session)|memoryconsolidationengine)[ \t\r\n]*(final[ \t\r\n]*)?\\{"
       consolidation_public_classes
       "${consolidation_public_lower}")
list(LENGTH consolidation_public_classes consolidation_public_class_count)
if(NOT consolidation_public_class_count EQUAL 5)
  message(FATAL_ERROR
          "Memory Consolidation public class set differs from API-011-HPP")
endif()

foreach(required_public_class IN ITEMS
        consolidationrequest
        consolidationcandidate
        consolidationresult
        consolidationsession
        memoryconsolidationengine)
  string(REGEX MATCHALL
         "class[ \t\r\n]+${required_public_class}[ \t\r\n]*(final[ \t\r\n]*)?\\{"
         required_public_class_matches
         "${consolidation_public_lower}")
  list(LENGTH required_public_class_matches required_public_class_count)
  if(NOT required_public_class_count EQUAL 1)
    message(FATAL_ERROR
            "Public class must appear exactly once: ${required_public_class}")
  endif()
endforeach()

string(REGEX MATCH
       "class[ \t\r\n]+memoryconsolidationengine[ \t\r\n]*(final[ \t\r\n]*)?\\{([^}]*)\\}"
       consolidation_engine_match
       "${consolidation_public_lower}")
if("${consolidation_engine_match}" STREQUAL "")
  message(FATAL_ERROR
          "Unable to inspect MemoryConsolidationEngine declaration")
endif()
set(consolidation_engine_body "${CMAKE_MATCH_2}")
string(REGEX MATCHALL
       "consolidationresult[ \t\r\n]+[a-z_][a-z0-9_]*[ \t\r\n]*\\("
       consolidation_operation_declarations
       "${consolidation_engine_body}")
list(LENGTH consolidation_operation_declarations consolidation_operation_count)
if(NOT consolidation_operation_count EQUAL 6)
  message(FATAL_ERROR
          "MemoryConsolidationEngine must expose exactly six operations")
endif()

foreach(required_operation IN ITEMS
        analyze
        promote
        retain
        validate
        retrievesession
        forgetsession)
  string(REGEX MATCHALL
         "consolidationresult[ \t\r\n]+${required_operation}[ \t\r\n]*\\("
         required_operation_matches
         "${consolidation_engine_body}")
  list(LENGTH required_operation_matches required_operation_count)
  if(NOT required_operation_count EQUAL 1)
    message(FATAL_ERROR
            "Engine operation must appear exactly once: ${required_operation}")
  endif()
endforeach()

# CCA-CONS-005 and CCA-CONS-041 through CCA-CONS-044: the capability uses
# only the released Working/Long-Term contracts and contains no Runtime,
# Persistence, Provider, derived-memory, clock, scheduler, or I/O dependency.
foreach(required_dependency IN ITEMS
        "cca/memory/working_memory.hpp"
        "cca/memory/long_term_memory.hpp")
  string(FIND
         "${consolidation_public_lower}"
         "${required_dependency}"
         match_position)
  if(match_position EQUAL -1)
    message(FATAL_ERROR
            "Required released dependency is missing: ${required_dependency}")
  endif()
endforeach()

set(forbidden_dependencies
    "cca/memory/semantic_memory.hpp"
    "cca/memory/episodic_memory.hpp"
    "cca/memory/procedural_memory.hpp"
    "cca/memory/knowledge_retrieval.hpp"
    "cca/persistence/"
    "cca/process/"
    "cca/representation/"
    "cca/runtime/"
    "<chrono>"
    "<ctime>"
    "<filesystem>"
    "<fstream>"
    "<thread>"
    "event_bus"
    "scheduler"
    "provider")
foreach(forbidden_dependency IN LISTS forbidden_dependencies)
  string(FIND
         "${consolidation_public_lower}\n${consolidation_implementation_lower}"
         "${forbidden_dependency}"
         match_position)
  if(NOT match_position EQUAL -1)
    message(FATAL_ERROR
            "Forbidden Memory Consolidation dependency: ${forbidden_dependency}")
  endif()
endforeach()

# CCA-CONS-044: CP-008 must not use released operations that would expire or
# forget Working state, or archive/forget Long-Term state, as hidden
# transition or rollback mechanisms.
foreach(forbidden_call IN ITEMS
        ".expire("
        "workingmemoryengine::expire"
        "workingmemoryengine::forget"
        "longtermmemoryengine::archive"
        "longtermmemoryengine::forget")
  string(FIND
         "${consolidation_implementation_lower}"
         "${forbidden_call}"
         match_position)
  if(NOT match_position EQUAL -1)
    message(FATAL_ERROR
            "Forbidden hidden memory transition: ${forbidden_call}")
  endif()
endforeach()

# CCA-CONS-045 and CCA-CONS-047: production, tests, architecture test, and
# the executable example are wired into the warnings-as-errors build.
set(cca_core_cmake "${CCA_CORE_SOURCE_DIR}/CMakeLists.txt")
set(cca_core_tests_cmake "${CCA_CORE_SOURCE_DIR}/tests/CMakeLists.txt")
set(cca_workspace_presets "${CCA_CORE_SOURCE_DIR}/../../CMakePresets.json")
foreach(required_build_file IN ITEMS
        cca_core_cmake
        cca_core_tests_cmake
        cca_workspace_presets)
  if(NOT EXISTS "${${required_build_file}}")
    message(FATAL_ERROR
            "Missing build evidence: ${${required_build_file}}")
  endif()
endforeach()

file(READ "${cca_core_cmake}" cca_core_cmake_text)
file(READ "${cca_core_tests_cmake}" cca_core_tests_cmake_text)
file(READ "${cca_workspace_presets}" cca_workspace_presets_text)
string(TOLOWER "${cca_core_cmake_text}" cca_core_cmake_lower)
string(TOLOWER "${cca_core_tests_cmake_text}" cca_core_tests_cmake_lower)
string(TOLOWER "${cca_workspace_presets_text}" cca_workspace_presets_lower)

foreach(required_build_token IN ITEMS
        "src/memory/memory_consolidation.cpp"
        "examples/memory_consolidation_usage.cpp"
        "cca_configure_target(cca_memory)"
        "cca_configure_target(cca_memory_consolidation_example)")
  string(FIND
         "${cca_core_cmake_lower}"
         "${required_build_token}"
         match_position)
  if(match_position EQUAL -1)
    message(FATAL_ERROR
            "Memory Consolidation build registration is missing: ${required_build_token}")
  endif()
endforeach()

foreach(required_test_token IN ITEMS
        "memory_consolidation_test.cpp"
        "memory_consolidation_allocation_failure_test.cpp"
        "memory_consolidation_architecture_test.cmake")
  string(FIND
         "${cca_core_tests_cmake_lower}"
         "${required_test_token}"
         match_position)
  if(match_position EQUAL -1)
    message(FATAL_ERROR
            "Memory Consolidation test registration is missing: ${required_test_token}")
  endif()
endforeach()

string(REGEX MATCH
       "\"cca_warnings_as_errors\"[ \t\r\n]*:[ \t\r\n]*\"on\""
       warnings_as_errors_match
       "${cca_workspace_presets_lower}")
if("${warnings_as_errors_match}" STREQUAL "")
  message(FATAL_ERROR
          "Repository CI preset does not enable CCA_WARNINGS_AS_ERRORS")
endif()

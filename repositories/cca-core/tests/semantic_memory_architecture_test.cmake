set(semantic_public_header
    "${CCA_CORE_SOURCE_DIR}/include/cca/memory/semantic_memory.hpp")
set(semantic_implementation
    "${CCA_CORE_SOURCE_DIR}/src/memory/semantic_memory.cpp")
set(semantic_persistence_header
    "${CCA_CORE_SOURCE_DIR}/src/memory/semantic_memory_persistence.hpp")
set(semantic_persistence_implementation
    "${CCA_CORE_SOURCE_DIR}/src/memory/semantic_memory_persistence.cpp")
set(semantic_unit_test
    "${CCA_CORE_SOURCE_DIR}/tests/semantic_memory_test.cpp")
set(semantic_allocation_test
    "${CCA_CORE_SOURCE_DIR}/tests/semantic_memory_allocation_failure_test.cpp")
set(semantic_documentation
    "${CCA_CORE_SOURCE_DIR}/docs/semantic-memory.md")
set(semantic_example
    "${CCA_CORE_SOURCE_DIR}/examples/semantic_memory_usage.cpp")

foreach(required_file IN LISTS
        semantic_public_header
        semantic_implementation
        semantic_persistence_header
        semantic_persistence_implementation
        semantic_unit_test
        semantic_allocation_test
        semantic_documentation
        semantic_example)
  if(NOT EXISTS "${required_file}")
    message(FATAL_ERROR "Missing Semantic Memory evidence: ${required_file}")
  endif()
endforeach()

file(READ "${semantic_public_header}" semantic_public_text)
file(READ "${semantic_implementation}" semantic_implementation_text)
file(READ "${semantic_persistence_header}" semantic_persistence_header_text)
file(READ "${semantic_persistence_implementation}"
     semantic_persistence_implementation_text)
file(READ "${semantic_unit_test}" semantic_unit_test_text)
file(READ "${semantic_allocation_test}" semantic_allocation_test_text)
file(READ "${semantic_documentation}" semantic_documentation_text)
file(READ "${semantic_example}" semantic_example_text)

string(TOLOWER "${semantic_public_text}" semantic_public_lower)
string(TOLOWER "${semantic_implementation_text}"
       semantic_implementation_lower)
string(TOLOWER
       "${semantic_persistence_header_text}\n${semantic_persistence_implementation_text}"
       semantic_persistence_lower)
string(TOLOWER
       "${semantic_public_text}\n${semantic_implementation_text}\n${semantic_persistence_header_text}\n${semantic_persistence_implementation_text}"
       semantic_production_lower)
string(TOLOWER "${semantic_example_text}" semantic_example_lower)

# CCA-SEMMEM-002 and CCA-SEMMEM-003: exactly four public Assets and one
# public Service are defined. The detail forward declaration is incomplete
# and therefore is not a public class definition.
string(REGEX MATCHALL
       "class[ \t\r\n]+semantic[a-z0-9_]*[ \t\r\n]*(final[ \t\r\n]*)?\\{"
       semantic_public_classes
       "${semantic_public_lower}")
list(LENGTH semantic_public_classes semantic_public_class_count)
if(NOT semantic_public_class_count EQUAL 5)
  message(FATAL_ERROR
          "Semantic Memory must define exactly four Assets and one Service")
endif()

foreach(required_class IN ITEMS
        semanticconcept
        semanticquery
        semanticmemory
        semanticresult
        semanticmemoryengine)
  string(REGEX MATCHALL
         "class[ \t\r\n]+${required_class}[ \t\r\n]*(final[ \t\r\n]*)?\\{"
         class_matches
         "${semantic_public_lower}")
  list(LENGTH class_matches class_match_count)
  if(NOT class_match_count EQUAL 1)
    message(FATAL_ERROR
            "Semantic Memory public class must appear exactly once: ${required_class}")
  endif()
endforeach()

string(REGEX MATCH
       "class[ \t\r\n]+semanticmemoryengine[ \t\r\n]*(final[ \t\r\n]*)?\\{([^}]*)\\}"
       semantic_engine_match
       "${semantic_public_lower}")
if("${semantic_engine_match}" STREQUAL "")
  message(FATAL_ERROR "Unable to inspect SemanticMemoryEngine")
endif()
set(semantic_engine_body "${CMAKE_MATCH_2}")

string(REGEX MATCHALL
       "semanticresult[ \t\r\n]+[a-z_][a-z0-9_]*[ \t\r\n]*\\("
       semantic_operations
       "${semantic_engine_body}")
list(LENGTH semantic_operations semantic_operation_count)
if(NOT semantic_operation_count EQUAL 7)
  message(FATAL_ERROR
          "SemanticMemoryEngine must expose exactly seven operations")
endif()

foreach(required_operation IN ITEMS
        classify
        categorize
        link
        retrieve
        search
        update
        forget)
  string(REGEX MATCHALL
         "semanticresult[ \t\r\n]+${required_operation}[ \t\r\n]*\\("
         operation_matches
         "${semantic_engine_body}")
  list(LENGTH operation_matches operation_match_count)
  if(NOT operation_match_count EQUAL 1)
    message(FATAL_ERROR
            "Semantic operation must appear exactly once: ${required_operation}")
  endif()
endforeach()

# CP-004-R1 and CCA-SEMMEM-013/023: the repaired C++23-safe identifiers are
# exact, while the reserved keyword is absent from callable declarations.
string(REGEX MATCHALL
       "const[ \t\r\n]+semanticconcept[ \t\r\n]*\\*[ \t\r\n]*semanticconcept[ \t\r\n]*\\("
       semantic_concept_accessor_matches
       "${semantic_public_lower}")
list(LENGTH semantic_concept_accessor_matches
     semantic_concept_accessor_count)
if(NOT semantic_concept_accessor_count EQUAL 1)
  message(FATAL_ERROR
          "SemanticResult must expose exactly one semanticConcept() accessor")
endif()
string(REGEX MATCH
       "(^|[^a-z0-9_])concept[ \t\r\n]*\\("
       reserved_concept_accessor
       "${semantic_public_lower}")
if(NOT "${reserved_concept_accessor}" STREQUAL "")
  message(FATAL_ERROR "Reserved C++23 concept() identifier is exposed")
endif()
string(REGEX MATCHALL
       "semanticconcept[ \t\r\n]+semanticconcept[ \t\r\n]*\\)"
       classify_parameter_matches
       "${semantic_engine_body}")
list(LENGTH classify_parameter_matches classify_parameter_count)
if(NOT classify_parameter_count EQUAL 1)
  message(FATAL_ERROR
          "classify must use the repaired semanticConcept parameter")
endif()

# CCA-SEMMEM-001, 005, 007, 008, 029, 031, and 032: the installed contract
# depends only on released CCA-LTMEM and standard headers. Runtime,
# Representation, Persistence, Provider, and earlier Memory capability types
# must not become public dependencies.
string(FIND "${semantic_public_lower}"
       "#include <cca/memory/long_term_memory.hpp>"
       long_term_include_position)
if(long_term_include_position EQUAL -1)
  message(FATAL_ERROR "Released Long-Term Memory dependency is absent")
endif()

set(forbidden_public_headers
    "cca/memory/memory.hpp"
    "cca/memory/working_memory.hpp"
    "cca/persistence/"
    "cca/process/"
    "cca/representation/"
    "cca/runtime/")
foreach(forbidden_header IN LISTS forbidden_public_headers)
  string(FIND "${semantic_public_lower}" "${forbidden_header}"
         forbidden_header_position)
  if(NOT forbidden_header_position EQUAL -1)
    message(FATAL_ERROR
            "Semantic public contract has forbidden dependency: ${forbidden_header}")
  endif()
endforeach()

set(forbidden_public_type_patterns
    "(^|[^a-z0-9_])memory(entry|query|result|engine)([^a-z0-9_]|$)"
    "(^|[^a-z0-9_])workingmemory(entry|query|result|engine)?([^a-z0-9_]|$)"
    "(^|[^a-z0-9_])persistence(package|format|result|engine)?([^a-z0-9_]|$)"
    "(^|[^a-z0-9_])runtime(state|context|result|host)?([^a-z0-9_]|$)"
    "(^|[^a-z0-9_])provider([^a-z0-9_]|$)")
foreach(forbidden_pattern IN LISTS forbidden_public_type_patterns)
  string(REGEX MATCH "${forbidden_pattern}" forbidden_public_type
         "${semantic_public_lower}")
  if(NOT "${forbidden_public_type}" STREQUAL "")
    message(FATAL_ERROR
            "Semantic public contract exposes forbidden type: ${forbidden_public_type}")
  endif()
endforeach()

# The Semantic state machine consumes only the released public Long-Term
# contract. It must not access CP-003 private state, invoke its Service, or
# depend on Runtime/Persistence/Representation infrastructure.
set(forbidden_core_dependencies
    "cca/memory/memory.hpp"
    "cca/memory/working_memory.hpp"
    "long_term_memory_persistence.hpp"
    "cca/persistence/"
    "cca/process/"
    "cca/representation/"
    "cca/runtime/"
    "longtermmemoryengine")
foreach(forbidden_dependency IN LISTS forbidden_core_dependencies)
  string(FIND "${semantic_implementation_lower}" "${forbidden_dependency}"
         forbidden_dependency_position)
  if(NOT forbidden_dependency_position EQUAL -1)
    message(FATAL_ERROR
            "Semantic core has forbidden dependency: ${forbidden_dependency}")
  endif()
endforeach()

set(forbidden_nondeterminism
    "<chrono>"
    "<ctime>"
    "system_clock"
    "steady_clock"
    "random_device"
    "event_bus"
    "scheduler"
    "thread")
foreach(forbidden_source IN LISTS forbidden_nondeterminism)
  string(FIND "${semantic_implementation_lower}" "${forbidden_source}"
         forbidden_source_position)
  if(NOT forbidden_source_position EQUAL -1)
    message(FATAL_ERROR
            "Semantic behavior depends on nondeterministic source: ${forbidden_source}")
  endif()
endforeach()

# CCA-SEMMEM-029/030: the private mapping has exactly the approved seam, stays
# in src/memory, and uses Representation plus the existing Persistence Engine
# without selecting storage, format, networking, or a Provider.
string(REGEX MATCH
       "class[ \t\r\n]+semanticmemorypersistence[ \t\r\n]*\\{([^}]*)\\}"
       persistence_class_match
       "${semantic_persistence_lower}")
if("${persistence_class_match}" STREQUAL "")
  message(FATAL_ERROR "Private Semantic Persistence adapter is absent")
endif()
set(persistence_class_body "${CMAKE_MATCH_1}")
string(REGEX MATCHALL "static[ \t\r\n]+" persistence_static_operations
       "${persistence_class_body}")
list(LENGTH persistence_static_operations persistence_static_count)
if(NOT persistence_static_count EQUAL 3)
  message(FATAL_ERROR
          "Private Semantic Persistence seam must expose exactly three operations")
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
  string(FIND "${semantic_persistence_lower}"
         "${required_private_dependency}"
         required_private_dependency_position)
  if(required_private_dependency_position EQUAL -1)
    message(FATAL_ERROR
            "Semantic Persistence dependency is absent: ${required_private_dependency}")
  endif()
endforeach()

set(forbidden_persistence_choices
    "persistenceformat"
    "cca/runtime/"
    "longtermmemoryengine"
    "<filesystem>"
    "<fstream>"
    "database"
    "socket"
    "network"
    "cloud"
    "compression"
    "encryption")
foreach(forbidden_choice IN LISTS forbidden_persistence_choices)
  string(FIND "${semantic_persistence_lower}" "${forbidden_choice}"
         forbidden_choice_position)
  if(NOT forbidden_choice_position EQUAL -1)
    message(FATAL_ERROR
            "Semantic Persistence selects forbidden behavior: ${forbidden_choice}")
  endif()
endforeach()

# CCA-SEMMEM-033 through 035: no excluded capability, inference operation, or
# hidden Semantic archive operation may enter production dependencies.
set(excluded_capability_patterns
    "episodic(memory)?"
    "procedural(memory)?"
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
         "${semantic_production_lower}")
  if(NOT "${excluded_match}" STREQUAL "")
    message(FATAL_ERROR
            "Excluded capability leaked into Semantic Memory: ${excluded_match}")
  endif()
endforeach()

set(prohibited_operation_patterns
    "semanticresult[ \t\r\n]+archive[ \t\r\n]*\\("
    "semanticresult[ \t\r\n]+unlink[ \t\r\n]*\\("
    "semanticresult[ \t\r\n]+uncategorize[ \t\r\n]*\\("
    "semanticresult[ \t\r\n]+infer[a-z0-9_]*[ \t\r\n]*\\("
    "semanticresult[ \t\r\n]+reason[a-z0-9_]*[ \t\r\n]*\\(")
foreach(prohibited_pattern IN LISTS prohibited_operation_patterns)
  string(REGEX MATCH "${prohibited_pattern}" prohibited_operation
         "${semantic_public_lower}")
  if(NOT "${prohibited_operation}" STREQUAL "")
    message(FATAL_ERROR
            "Prohibited Semantic operation exposed: ${prohibited_operation}")
  endif()
endforeach()

# CCA-SEMMEM-036 through 038: every requirement has explicit automated or
# architecture evidence; production, tests, docs, and the seven-operation
# example are registered under repository warning and warnings-as-errors gates.
set(traceability_text
    "${semantic_unit_test_text}\n${semantic_allocation_test_text}\n${semantic_documentation_text}")
foreach(requirement_number RANGE 1 38)
  if(requirement_number LESS 10)
    set(requirement_suffix "00${requirement_number}")
  else()
    set(requirement_suffix "0${requirement_number}")
  endif()
  string(FIND "${traceability_text}"
       "CCA-SEMMEM-${requirement_suffix}"
       requirement_position)
  if(requirement_position EQUAL -1)
    message(FATAL_ERROR
            "Missing verification trace for CCA-SEMMEM-${requirement_suffix}")
  endif()
endforeach()

foreach(example_operation IN ITEMS
        classify categorize link retrieve search update forget)
  string(REGEX MATCH "\\.${example_operation}[ \t\r\n]*\\("
         example_operation_match "${semantic_example_lower}")
  if("${example_operation_match}" STREQUAL "")
    message(FATAL_ERROR
            "Semantic example omits operation: ${example_operation}")
  endif()
endforeach()
string(FIND "${semantic_example_lower}" "semanticconcept()"
       repaired_example_accessor_position)
if(repaired_example_accessor_position EQUAL -1)
  message(FATAL_ERROR
          "Semantic example does not use repaired semanticConcept() accessor")
endif()

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
        "src/memory/semantic_memory.cpp"
        "src/memory/semantic_memory_persistence.cpp")
  string(FIND "${core_cmake_lower}" "${required_source}"
         source_registration_position)
  if(source_registration_position EQUAL -1)
    message(FATAL_ERROR
            "Semantic production source is not registered: ${required_source}")
  endif()
endforeach()
foreach(required_build_token IN ITEMS
        "semantic_memory_test.cpp"
        "semantic_memory_allocation_failure_test.cpp"
        "semantic_memory_architecture_test.cmake"
        "cca_semantic_memory_allocation_tests")
  string(FIND "${test_cmake_lower}" "${required_build_token}"
         test_registration_position)
  if(test_registration_position EQUAL -1)
    message(FATAL_ERROR
            "Semantic verification is not registered: ${required_build_token}")
  endif()
endforeach()
foreach(required_example_token IN ITEMS
        "semantic_memory_usage.cpp"
        "cca_semantic_memory_example"
        "cca_configure_target(cca_semantic_memory_example)")
  string(FIND "${core_cmake_lower}" "${required_example_token}"
         example_registration_position)
  if(example_registration_position EQUAL -1)
    message(FATAL_ERROR
            "Semantic example/build gate is absent: ${required_example_token}")
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

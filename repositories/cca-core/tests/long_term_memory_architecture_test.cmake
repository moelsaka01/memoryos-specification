set(long_term_memory_public_header
    "${CCA_CORE_SOURCE_DIR}/include/cca/memory/long_term_memory.hpp")
set(long_term_memory_implementation
    "${CCA_CORE_SOURCE_DIR}/src/memory/long_term_memory.cpp")
set(long_term_memory_persistence_header
    "${CCA_CORE_SOURCE_DIR}/src/memory/long_term_memory_persistence.hpp")
set(long_term_memory_persistence_implementation
    "${CCA_CORE_SOURCE_DIR}/src/memory/long_term_memory_persistence.cpp")

foreach(required_file IN LISTS
        long_term_memory_public_header
        long_term_memory_implementation
        long_term_memory_persistence_header
        long_term_memory_persistence_implementation)
  if(NOT EXISTS "${required_file}")
    message(FATAL_ERROR
            "Missing Long-Term Memory file: ${required_file}")
  endif()
endforeach()

file(READ "${long_term_memory_public_header}"
     long_term_memory_public_text)
file(READ "${long_term_memory_implementation}"
     long_term_memory_implementation_text)
file(READ "${long_term_memory_persistence_header}"
     long_term_memory_persistence_header_text)
file(READ "${long_term_memory_persistence_implementation}"
     long_term_memory_persistence_implementation_text)

string(TOLOWER
       "${long_term_memory_public_text}"
       long_term_memory_public_lower)
string(TOLOWER
       "${long_term_memory_implementation_text}"
       long_term_memory_implementation_lower)
string(TOLOWER
       "${long_term_memory_persistence_header_text}\n${long_term_memory_persistence_implementation_text}"
       long_term_memory_persistence_lower)
string(TOLOWER
       "${long_term_memory_public_text}\n${long_term_memory_implementation_text}\n${long_term_memory_persistence_header_text}\n${long_term_memory_persistence_implementation_text}"
       long_term_memory_all_source_lower)

# CCA-LTMEM-002 and CCA-LTMEM-003: the public contract contains exactly the
# four frozen Assets and one frozen Service. An incomplete detail helper used
# only for private friendship is not a class definition and exposes no usable
# public API type.
string(REGEX MATCHALL
       "class[ \t\r\n]+longtermmemory[a-z0-9_]*[ \t\r\n]*(final[ \t\r\n]*)?\\{"
       long_term_memory_public_classes
       "${long_term_memory_public_lower}")
list(LENGTH long_term_memory_public_classes
     long_term_memory_public_class_count)
if(NOT long_term_memory_public_class_count EQUAL 5)
  message(FATAL_ERROR
          "Long-Term Memory public class set differs from the frozen four Assets and one Service")
endif()

foreach(required_public_class IN ITEMS
        longtermmemoryentry
        longtermmemoryquery
        longtermmemoryresult
        longtermmemory
        longtermmemoryengine)
  string(REGEX MATCHALL
         "class[ \t\r\n]+${required_public_class}[ \t\r\n]*(final[ \t\r\n]*)?\\{"
         required_public_class_matches
         "${long_term_memory_public_lower}")
  list(LENGTH required_public_class_matches
       required_public_class_count)
  if(NOT required_public_class_count EQUAL 1)
    message(FATAL_ERROR
            "Public class must appear exactly once: ${required_public_class}")
  endif()
endforeach()

string(REGEX MATCH
       "class[ \t\r\n]+longtermmemoryengine[ \t\r\n]*(final[ \t\r\n]*)?\\{([^}]*)\\}"
       long_term_memory_engine_match
       "${long_term_memory_public_lower}")
if("${long_term_memory_engine_match}" STREQUAL "")
  message(FATAL_ERROR
          "Unable to inspect LongTermMemoryEngine public declaration")
endif()
set(long_term_memory_engine_body "${CMAKE_MATCH_2}")

string(REGEX MATCHALL
       "longtermmemoryresult[ \t\r\n]+[a-z_][a-z0-9_]*[ \t\r\n]*\\("
       long_term_memory_operation_declarations
       "${long_term_memory_engine_body}")
list(LENGTH long_term_memory_operation_declarations
     long_term_memory_operation_count)
if(NOT long_term_memory_operation_count EQUAL 7)
  message(FATAL_ERROR
          "LongTermMemoryEngine must expose exactly seven operations")
endif()

foreach(required_operation IN ITEMS
        retain
        store
        retrieve
        search
        archive
        restore
        forget)
  string(REGEX MATCHALL
         "longtermmemoryresult[ \t\r\n]+${required_operation}[ \t\r\n]*\\("
         required_operation_matches
         "${long_term_memory_engine_body}")
  list(LENGTH required_operation_matches required_operation_count)
  if(NOT required_operation_count EQUAL 1)
    message(FATAL_ERROR
            "LongTermMemoryEngine operation must appear exactly once: ${required_operation}")
  endif()
endforeach()

# CCA-LTMEM-001, CCA-LTMEM-005, CCA-LTMEM-024, CCA-LTMEM-025, and
# CCA-LTMEM-026: the installed API remains inside the Memory Domain and has no
# Runtime, Provider, Persistence, Representation, Process, CP-001, or CP-002
# dependency. The approved Persistence integration is confined to src/memory.
set(forbidden_public_dependency_headers
    "cca/memory/memory.hpp"
    "cca/memory/working_memory.hpp"
    "cca/persistence/"
    "cca/process/"
    "cca/representation/"
    "cca/runtime/")
foreach(forbidden_header IN LISTS forbidden_public_dependency_headers)
  string(FIND
         "${long_term_memory_public_lower}"
         "${forbidden_header}"
         match_position)
  if(NOT match_position EQUAL -1)
    message(FATAL_ERROR
            "Long-Term Memory public API has forbidden dependency: ${forbidden_header}")
  endif()
endforeach()

set(forbidden_public_type_patterns
    "(^|[^a-z0-9_])memoryentry([^a-z0-9_]|$)"
    "(^|[^a-z0-9_])workingmemory(entry)?([^a-z0-9_]|$)"
    "(^|[^a-z0-9_])persistence(package|format|engine|result)?([^a-z0-9_]|$)"
    "(^|[^a-z0-9_])provider([^a-z0-9_]|$)"
    "(^|[^a-z0-9_])runtime(state|context|result)?([^a-z0-9_]|$)")
foreach(forbidden_pattern IN LISTS forbidden_public_type_patterns)
  string(REGEX MATCH
         "${forbidden_pattern}"
         forbidden_public_type_match
         "${long_term_memory_public_lower}")
  if(NOT "${forbidden_public_type_match}" STREQUAL "")
    message(FATAL_ERROR
            "Long-Term Memory public API exposes a forbidden architectural type: ${forbidden_public_type_match}")
  endif()
endforeach()

# The core state machine must not depend on released Memory/Working Memory
# state, foundations above the Memory Domain, or the private persistence seam.
set(forbidden_core_dependencies
    "cca/memory/memory.hpp"
    "cca/memory/working_memory.hpp"
    "cca/persistence/"
    "cca/process/"
    "cca/representation/"
    "cca/runtime/"
    "long_term_memory_persistence.hpp")
foreach(forbidden_dependency IN LISTS forbidden_core_dependencies)
  string(FIND
         "${long_term_memory_implementation_lower}"
         "${forbidden_dependency}"
         match_position)
  if(NOT match_position EQUAL -1)
    message(FATAL_ERROR
            "Long-Term Memory core has forbidden dependency: ${forbidden_dependency}")
  endif()
endforeach()

# CCA-LTMEM-018 and CCA-LTMEM-025: no clock, timer, Runtime event, or Runtime
# lifecycle source may drive a base-state transition.
set(forbidden_implicit_transition_sources
    "<chrono>"
    "<ctime>"
    "system_clock"
    "steady_clock"
    "cca/runtime/"
    "event_bus"
    "scheduler")
foreach(forbidden_source IN LISTS forbidden_implicit_transition_sources)
  string(FIND
         "${long_term_memory_implementation_lower}"
         "${forbidden_source}"
         match_position)
  if(NOT match_position EQUAL -1)
    message(FATAL_ERROR
            "Implicit Long-Term Memory transition source detected: ${forbidden_source}")
  endif()
endforeach()

# CCA-LTMEM-024: the required private adapter exists, exposes only the three
# internal projection operations, and uses the existing provider-independent
# Persistence boundary without selecting a format or external storage system.
foreach(required_private_operation IN ITEMS project reconstruct roundtrip)
  string(REGEX MATCH
         "${required_private_operation}[ \t\r\n]*\\("
         private_operation_match
         "${long_term_memory_persistence_lower}")
  if("${private_operation_match}" STREQUAL "")
    message(FATAL_ERROR
            "Private Long-Term Memory persistence operation is missing: ${required_private_operation}")
  endif()
endforeach()

set(forbidden_private_integration_dependencies
    "cca/memory/memory.hpp"
    "cca/memory/working_memory.hpp"
    "cca/runtime/"
    "cca/runtime/provider.hpp"
    "persistenceformat"
    "<filesystem>"
    "<fstream>"
    "database"
    "socket"
    "cloud"
    "compression"
    "encryption")
foreach(forbidden_dependency IN LISTS forbidden_private_integration_dependencies)
  string(FIND
         "${long_term_memory_persistence_lower}"
         "${forbidden_dependency}"
         match_position)
  if(NOT match_position EQUAL -1)
    message(FATAL_ERROR
            "Private Long-Term Memory Persistence mapping selects a forbidden dependency: ${forbidden_dependency}")
  endif()
endforeach()

# CCA-LTMEM-027: no excluded specialized-memory or product capability may leak
# into either the public contract or the implementation dependency boundary.
set(excluded_capabilities
    "semantic memory"
    "episodic memory"
    "procedural memory"
    "reflection"
    "consolidation"
    "embedding"
    "knowledge graph"
    "memory studio")
foreach(excluded_capability IN LISTS excluded_capabilities)
  string(FIND
         "${long_term_memory_all_source_lower}"
         "${excluded_capability}"
         match_position)
  if(NOT match_position EQUAL -1)
    message(FATAL_ERROR
            "Excluded capability leaked into Long-Term Memory: ${excluded_capability}")
  endif()
endforeach()

string(REGEX MATCH
       "(^|[^a-z])ai([^a-z]|$)"
       excluded_ai_match
       "${long_term_memory_all_source_lower}")
if(NOT "${excluded_ai_match}" STREQUAL "")
  message(FATAL_ERROR
          "Excluded capability leaked into Long-Term Memory: AI")
endif()

# CCA-LTMEM-029: the production and private integration translation units are
# registered on the warnings-configured target, and the repository retains an
# explicit warnings-as-errors CI gate.
set(cca_core_cmake "${CCA_CORE_SOURCE_DIR}/CMakeLists.txt")
set(cca_workspace_presets "${CCA_CORE_SOURCE_DIR}/../../CMakePresets.json")
foreach(required_build_file IN ITEMS cca_core_cmake cca_workspace_presets)
  if(NOT EXISTS "${${required_build_file}}")
    message(FATAL_ERROR
            "Missing Long-Term Memory build evidence: ${${required_build_file}}")
  endif()
endforeach()

file(READ "${cca_core_cmake}" cca_core_cmake_text)
string(TOLOWER "${cca_core_cmake_text}" cca_core_cmake_lower)
foreach(required_source IN ITEMS
        "src/memory/long_term_memory.cpp"
        "src/memory/long_term_memory_persistence.cpp")
  string(FIND "${cca_core_cmake_lower}" "${required_source}" match_position)
  if(match_position EQUAL -1)
    message(FATAL_ERROR
            "Long-Term Memory source is not registered on cca_memory: ${required_source}")
  endif()
endforeach()
string(FIND
       "${cca_core_cmake_lower}"
       "cca_configure_target(cca_memory)"
       warning_target_position)
if(warning_target_position EQUAL -1)
  message(FATAL_ERROR
          "cca_memory is not registered with the repository warning gates")
endif()

file(READ "${cca_workspace_presets}" cca_workspace_presets_text)
string(TOLOWER "${cca_workspace_presets_text}" cca_workspace_presets_lower)
string(REGEX MATCH
       "\"cca_warnings_as_errors\"[ \t\r\n]*:[ \t\r\n]*\"on\""
       warnings_as_errors_match
       "${cca_workspace_presets_lower}")
if("${warnings_as_errors_match}" STREQUAL "")
  message(FATAL_ERROR
          "Repository CI preset does not enable CCA_WARNINGS_AS_ERRORS")
endif()

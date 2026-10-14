set(working_memory_public_header
    "${CCA_CORE_SOURCE_DIR}/include/cca/memory/working_memory.hpp")
set(working_memory_implementation
    "${CCA_CORE_SOURCE_DIR}/src/memory/working_memory.cpp")

foreach(required_file IN LISTS
        working_memory_public_header
        working_memory_implementation)
  if(NOT EXISTS "${required_file}")
    message(FATAL_ERROR
            "Missing Working Memory file: ${required_file}")
  endif()
endforeach()

file(READ "${working_memory_public_header}" working_memory_public_text)
file(READ "${working_memory_implementation}" working_memory_implementation_text)
string(TOLOWER
       "${working_memory_public_text}\n${working_memory_implementation_text}"
       working_memory_source_text)

# CCA-WMEM-001 and CCA-WMEM-005: remain inside the Memory Domain and preserve
# the acyclic constitutional dependency boundary.
set(forbidden_dependency_headers
    "cca/persistence/"
    "cca/process/"
    "cca/representation/"
    "cca/runtime/")
foreach(forbidden_header IN LISTS forbidden_dependency_headers)
  string(FIND
         "${working_memory_source_text}"
         "${forbidden_header}"
         match_position)
  if(NOT match_position EQUAL -1)
    message(FATAL_ERROR
            "Working Memory has forbidden dependency: ${forbidden_header}")
  endif()
endforeach()

# CCA-WMEM-018: Working Memory must not read, own, or modify CP-001 state.
string(FIND
       "${working_memory_source_text}"
       "cca/memory/memory.hpp"
       memory_foundation_include_position)
if(NOT memory_foundation_include_position EQUAL -1)
  message(FATAL_ERROR
          "Working Memory implementation depends on Memory Foundation state")
endif()

# CCA-WMEM-019: none of the frozen exclusions may leak into the public contract
# or implementation dependency boundary.
set(excluded_capabilities
    "long-term memory"
    "semantic memory"
    "episodic memory"
    "procedural memory"
    "reflection"
    "consolidation"
    "embedding"
    "vector search"
    "knowledge graph"
    "memory studio")
foreach(excluded_capability IN LISTS excluded_capabilities)
  string(FIND
         "${working_memory_source_text}"
         "${excluded_capability}"
         match_position)
  if(NOT match_position EQUAL -1)
    message(FATAL_ERROR
            "Excluded capability leaked into Working Memory: ${excluded_capability}")
  endif()
endforeach()

string(REGEX MATCH
       "(^|[^a-z])ai([^a-z]|$)"
       excluded_ai_match
       "${working_memory_source_text}")
if(NOT "${excluded_ai_match}" STREQUAL "")
  message(FATAL_ERROR
          "Excluded capability leaked into Working Memory: AI")
endif()

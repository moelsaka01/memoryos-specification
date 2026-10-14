set(memory_public_header
    "${CCA_CORE_SOURCE_DIR}/include/cca/memory/memory.hpp")
set(memory_implementation
    "${CCA_CORE_SOURCE_DIR}/src/memory/memory.cpp")

foreach(required_file IN LISTS memory_public_header memory_implementation)
  if(NOT EXISTS "${required_file}")
    message(FATAL_ERROR "Missing Memory Foundation file: ${required_file}")
  endif()
endforeach()

file(READ "${memory_public_header}" memory_public_text)
file(READ "${memory_implementation}" memory_implementation_text)
string(TOLOWER
       "${memory_public_text}\n${memory_implementation_text}"
       memory_source_text)

set(forbidden_dependency_headers
    "cca/persistence/"
    "cca/process/"
    "cca/runtime/"
    "cca/representation/")
foreach(forbidden_header IN LISTS forbidden_dependency_headers)
  string(FIND "${memory_source_text}" "${forbidden_header}" match_position)
  if(NOT match_position EQUAL -1)
    message(FATAL_ERROR
            "Memory Foundation has forbidden dependency: ${forbidden_header}")
  endif()
endforeach()

set(excluded_capabilities
    "working memory"
    "long-term memory"
    "semantic memory"
    "embedding"
    "reflection"
    "consolidation"
    "llm"
    "knowledge graph")
foreach(excluded_capability IN LISTS excluded_capabilities)
  string(FIND "${memory_source_text}" "${excluded_capability}" match_position)
  if(NOT match_position EQUAL -1)
    message(FATAL_ERROR
            "Excluded capability leaked into Memory Foundation: ${excluded_capability}")
  endif()
endforeach()

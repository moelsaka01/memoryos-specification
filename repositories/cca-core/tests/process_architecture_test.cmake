if(NOT DEFINED CCA_CORE_SOURCE_DIR)
  message(FATAL_ERROR "CCA_CORE_SOURCE_DIR is required")
endif()

file(
  GLOB_RECURSE process_public_headers
  "${CCA_CORE_SOURCE_DIR}/include/cca/process/*.hpp"
)
if(NOT process_public_headers)
  message(FATAL_ERROR "Process public headers were not found")
endif()

foreach(public_header IN LISTS process_public_headers)
  file(READ "${public_header}" public_contents)
  if(public_contents MATCHES "#[ \t]*include[ \t]*[<\"]cca/runtime/")
    message(
      FATAL_ERROR
      "Public Process header depends on Runtime implementation API: ${public_header}"
    )
  endif()
  if(public_contents MATCHES "ProcessEngineProvider|ProcessEngineContract|ServiceProvider")
    message(
      FATAL_ERROR
      "Private Process Provider surface leaked into ${public_header}"
    )
  endif()
endforeach()

file(
  GLOB_RECURSE runtime_files
  "${CCA_CORE_SOURCE_DIR}/include/cca/runtime/*.hpp"
  "${CCA_CORE_SOURCE_DIR}/src/runtime/*.cpp"
)
foreach(runtime_file IN LISTS runtime_files)
  file(READ "${runtime_file}" runtime_contents)
  if(runtime_contents MATCHES "cca/process")
    message(
      FATAL_ERROR
      "Runtime Foundation depends upward on Process: ${runtime_file}"
    )
  endif()
endforeach()

file(
  GLOB_RECURSE process_implementation_files
  "${CCA_CORE_SOURCE_DIR}/include/cca/process/*.hpp"
  "${CCA_CORE_SOURCE_DIR}/src/process/*.cpp"
  "${CCA_CORE_SOURCE_DIR}/src/process/*.hpp"
)
set(
  forbidden_process_concepts
  "MemoryOS"
  "Studio"
  "BPMN"
  "Artificial Intelligence"
  "workflow designer"
  "distributed execution"
  "networking"
  "persistence"
  "scheduling"
)
foreach(process_file IN LISTS process_implementation_files)
  file(READ "${process_file}" process_contents)
  foreach(forbidden_concept IN LISTS forbidden_process_concepts)
    string(
      FIND
      "${process_contents}"
      "${forbidden_concept}"
      forbidden_position
    )
    if(NOT forbidden_position EQUAL -1)
      message(
        FATAL_ERROR
        "Excluded concept '${forbidden_concept}' appears in ${process_file}"
      )
    endif()
  endforeach()
endforeach()

file(READ "${CCA_CORE_SOURCE_DIR}/CMakeLists.txt" core_cmake)
foreach(required_token IN ITEMS "cca_process" "cca::representation" "cca::runtime")
  string(FIND "${core_cmake}" "${required_token}" token_position)
  if(token_position EQUAL -1)
    message(
      FATAL_ERROR
      "Process build boundary is missing '${required_token}'"
    )
  endif()
endforeach()

message(STATUS "CCA-PROC architecture and exclusion checks passed")

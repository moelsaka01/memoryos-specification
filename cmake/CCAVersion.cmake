include_guard(GLOBAL)

set(
  CCA_VERSION_PRERELEASE
  "dev"
  CACHE STRING
  "Semantic-version prerelease identifier (empty for a release)"
)
set(
  CCA_VERSION_BUILD_METADATA
  ""
  CACHE STRING
  "Semantic-version build metadata (empty for reproducible release artifacts)"
)

function(cca_configure_version)
  set(one_value_arguments VERSION PRERELEASE BUILD_METADATA)
  cmake_parse_arguments(CCAV "" "${one_value_arguments}" "" ${ARGN})

  if(NOT CCAV_VERSION MATCHES "^[0-9]+\\.[0-9]+\\.[0-9]+$")
    message(FATAL_ERROR "cca_configure_version requires VERSION in major.minor.patch form")
  endif()

  foreach(identifier IN ITEMS CCAV_PRERELEASE CCAV_BUILD_METADATA)
    if(NOT "${${identifier}}" MATCHES "^[0-9A-Za-z.-]*$")
      message(FATAL_ERROR "${identifier} contains characters that are not valid in SemVer")
    endif()
  endforeach()

  string(REPLACE "." ";" version_components "${CCAV_VERSION}")
  list(GET version_components 0 CCA_VERSION_MAJOR)
  list(GET version_components 1 CCA_VERSION_MINOR)
  list(GET version_components 2 CCA_VERSION_PATCH)

  set(CCA_VERSION_PRERELEASE_VALUE "${CCAV_PRERELEASE}")
  set(CCA_VERSION_BUILD_METADATA_VALUE "${CCAV_BUILD_METADATA}")
  set(CCA_VERSION_STRING "${CCAV_VERSION}")
  if(NOT "${CCAV_PRERELEASE}" STREQUAL "")
    string(APPEND CCA_VERSION_STRING "-${CCAV_PRERELEASE}")
  endif()
  if(NOT "${CCAV_BUILD_METADATA}" STREQUAL "")
    string(APPEND CCA_VERSION_STRING "+${CCAV_BUILD_METADATA}")
  endif()

  set(generated_include_directory "${CMAKE_BINARY_DIR}/generated/include")
  file(MAKE_DIRECTORY "${generated_include_directory}/cca")
  configure_file(
    "${CMAKE_CURRENT_FUNCTION_LIST_DIR}/version.hpp.in"
    "${generated_include_directory}/cca/version.hpp"
    @ONLY
  )

  if(NOT TARGET cca_version)
    add_library(cca_version INTERFACE)
    add_library(cca::version ALIAS cca_version)
    target_include_directories(
      cca_version
      INTERFACE
        "$<BUILD_INTERFACE:${generated_include_directory}>"
    )
  endif()

  set(
    CCA_VERSION_STRING
    "${CCA_VERSION_STRING}"
    CACHE INTERNAL
    "Complete CCA version"
    FORCE
  )
  message(STATUS "Configuring CCA ${CCA_VERSION_STRING}")
endfunction()

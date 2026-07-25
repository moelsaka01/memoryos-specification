cmake_minimum_required(VERSION 3.28)

project(
  CCA
  VERSION 0.1.0
  DESCRIPTION "Reference engineering workspace for the Cognitive Computing Architecture"
  LANGUAGES CXX
)

list(PREPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/cmake")

include(CTest)
include(GNUInstallDirs)
include(CCAVersion)
include(CCAProjectOptions)
include(CCATesting)

set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
# This milestone defines no C++ module file sets. Enable scanning with an
# explicit module architecture instead of requiring clang-scan-deps implicitly.
set(CMAKE_CXX_SCAN_FOR_MODULES OFF)
option(CCA_BUILD_TESTS "Build CCA repository unit tests" "${BUILD_TESTING}")

cca_configure_version(
  VERSION "${PROJECT_VERSION}"
  PRERELEASE "${CCA_VERSION_PRERELEASE}"
  BUILD_METADATA "${CCA_VERSION_BUILD_METADATA}"
)
cca_initialize_project_options()

install(
  FILES "${CMAKE_BINARY_DIR}/generated/include/cca/version.hpp"
  DESTINATION "${CMAKE_INSTALL_INCLUDEDIR}/cca"
)

function(cca_add_workspace_repository repository_name)
  set(repository_directory "${CMAKE_CURRENT_SOURCE_DIR}/repositories/${repository_name}")
  if(EXISTS "${repository_directory}/CMakeLists.txt")
    add_subdirectory("${repository_directory}")
  else()
    message(STATUS "CCA repository '${repository_name}' is not present; skipping")
  endif()
endfunction()

cca_add_workspace_repository(cca-core)
cca_add_workspace_repository(cca-compiler)
cca_add_workspace_repository(memoryos)
cca_add_workspace_repository(cca-studio)
cca_add_workspace_repository(cca-sdk)
cca_add_workspace_repository(cca-conformance)
cca_add_workspace_repository(cca-atlas)

if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/examples/CMakeLists.txt")
  add_subdirectory(examples)
endif()

if(BUILD_TESTING AND EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/tests/CMakeLists.txt")
  add_subdirectory(tests)
endif()

include(CCACoverage)
cca_add_coverage_report_target()

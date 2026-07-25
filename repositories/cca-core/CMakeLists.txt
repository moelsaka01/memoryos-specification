cmake_minimum_required(VERSION 3.25)

if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
  project(cca_core VERSION 0.1.0 LANGUAGES CXX)
  include(CTest)
  option(CCA_BUILD_TESTS "Build CCA unit tests" ${BUILD_TESTING})
endif()

add_library(
  cca_core
  STATIC
    src/configuration.cpp
    src/logging.cpp
    src/string_utils.cpp
    src/version.cpp
)
add_library(cca::core ALIAS cca_core)

target_compile_features(cca_core PUBLIC cxx_std_23)
target_include_directories(
  cca_core
  PUBLIC
    "$<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>"
    "$<INSTALL_INTERFACE:include>"
)

if(COMMAND cca_configure_target)
  cca_configure_target(cca_core)
else()
  if(MSVC)
    target_compile_options(cca_core PRIVATE /W4 /permissive-)
  else()
    target_compile_options(cca_core PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion)
  endif()

  configure_file(
    "${CMAKE_CURRENT_SOURCE_DIR}/cmake/version.hpp.in"
    "${CMAKE_CURRENT_BINARY_DIR}/generated/cca/version.hpp"
    @ONLY
  )
  target_include_directories(
    cca_core
    PUBLIC "$<BUILD_INTERFACE:${CMAKE_CURRENT_BINARY_DIR}/generated>"
  )
endif()

add_library(
  cca_testing
  STATIC
    src/testing/recording_log_sink.cpp
)
add_library(cca::testing ALIAS cca_testing)

target_compile_features(cca_testing PUBLIC cxx_std_23)
target_include_directories(
  cca_testing
  PUBLIC
    "$<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>"
    "$<INSTALL_INTERFACE:include>"
)
target_link_libraries(cca_testing PUBLIC cca::core)

if(COMMAND cca_configure_target)
  cca_configure_target(cca_testing)
elseif(MSVC)
  target_compile_options(cca_testing PRIVATE /W4 /permissive-)
else()
  target_compile_options(cca_testing PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion)
endif()

if(BUILD_TESTING AND CCA_BUILD_TESTS)
  add_subdirectory(tests)
endif()


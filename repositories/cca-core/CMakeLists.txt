cmake_minimum_required(VERSION 3.25)

if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
project(cca_core VERSION 0.2.0 LANGUAGES CXX)
  include(CTest)
  include(GNUInstallDirs)
  option(CCA_BUILD_TESTS "Build CCA unit tests" ${BUILD_TESTING})
endif()

find_package(Threads REQUIRED)

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

add_library(
  cca_runtime
  STATIC
    src/runtime/configuration_manager.cpp
    src/runtime/dependency_injector.cpp
    src/runtime/event_bus.cpp
    src/runtime/lifecycle_manager.cpp
    src/runtime/observability.cpp
    src/runtime/runtime.cpp
    src/runtime/runtime_builder.cpp
    src/runtime/runtime_context.cpp
    src/runtime/runtime_host.cpp
    src/runtime/runtime_id.cpp
    src/runtime/runtime_result.cpp
    src/runtime/runtime_state.cpp
    src/runtime/service_registry.cpp
)
add_library(cca::runtime ALIAS cca_runtime)

target_compile_features(cca_runtime PUBLIC cxx_std_23)
target_include_directories(
  cca_runtime
  PUBLIC
    "$<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>"
    "$<INSTALL_INTERFACE:include>"
)
target_link_libraries(
  cca_runtime
  PUBLIC
    cca::core
    Threads::Threads
)

if(COMMAND cca_configure_target)
  cca_configure_target(cca_runtime)
elseif(MSVC)
  target_compile_options(cca_runtime PRIVATE /W4 /permissive-)
else()
  target_compile_options(
    cca_runtime
    PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion
  )
endif()

add_executable(cca_runtime_host src/runtime/main.cpp)
add_executable(cca::runtime_host ALIAS cca_runtime_host)
set_target_properties(cca_runtime_host PROPERTIES OUTPUT_NAME "cca-runtime")
target_compile_features(cca_runtime_host PRIVATE cxx_std_23)
target_link_libraries(cca_runtime_host PRIVATE cca::runtime)

if(COMMAND cca_configure_target)
  cca_configure_target(cca_runtime_host)
elseif(MSVC)
  target_compile_options(cca_runtime_host PRIVATE /W4 /permissive-)
else()
  target_compile_options(
    cca_runtime_host
    PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion
  )
endif()

install(TARGETS cca_runtime_host RUNTIME DESTINATION "${CMAKE_INSTALL_BINDIR}")

if(BUILD_TESTING AND CCA_BUILD_TESTS)
  add_subdirectory(tests)
endif()

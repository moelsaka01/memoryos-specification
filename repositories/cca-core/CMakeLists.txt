cmake_minimum_required(VERSION 3.25)

if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
project(cca_core VERSION 0.2.0 LANGUAGES CXX)
  include(CTest)
  include(GNUInstallDirs)
  option(CCA_BUILD_TESTS "Build CCA unit tests" ${BUILD_TESTING})
endif()

find_package(Threads REQUIRED)
option(
  CCA_BUILD_PROCESS_EXAMPLES
  "Build CCA Process Foundation examples"
  "${BUILD_TESTING}"
)
option(
  CCA_BUILD_PERSISTENCE_EXAMPLES
  "Build CCA Persistence Foundation examples"
  "${BUILD_TESTING}"
)

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
  cca_representation
  STATIC
    src/representation/representation.cpp
)
add_library(cca::representation ALIAS cca_representation)

target_compile_features(cca_representation PUBLIC cxx_std_23)
target_include_directories(
  cca_representation
  PUBLIC
    "$<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>"
    "$<INSTALL_INTERFACE:include>"
)

if(COMMAND cca_configure_target)
  cca_configure_target(cca_representation)
elseif(MSVC)
  target_compile_options(cca_representation PRIVATE /W4 /permissive-)
else()
  target_compile_options(
    cca_representation
    PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion
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

add_library(
  cca_process
  STATIC
    src/process/process.cpp
    src/process/process_runtime_integration.cpp
)
add_library(cca::process ALIAS cca_process)

add_library(cca_persistence STATIC src/persistence/persistence.cpp)
add_library(cca::persistence ALIAS cca_persistence)
target_compile_features(cca_persistence PUBLIC cxx_std_23)
target_include_directories(cca_persistence PUBLIC "$<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>")
target_link_libraries(cca_persistence PUBLIC cca::process cca::representation)
if(COMMAND cca_configure_target)
  cca_configure_target(cca_persistence)
elseif(MSVC)
  target_compile_options(cca_persistence PRIVATE /W4 /permissive-)
else()
  target_compile_options(cca_persistence PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion)
endif()

if(CCA_BUILD_PERSISTENCE_EXAMPLES)
  add_executable(cca_persistence_example examples/persistence_usage.cpp)
  target_compile_features(cca_persistence_example PRIVATE cxx_std_23)
  target_link_libraries(cca_persistence_example PRIVATE cca::persistence)
  if(COMMAND cca_configure_target)
    cca_configure_target(cca_persistence_example)
  elseif(MSVC)
    target_compile_options(cca_persistence_example PRIVATE /W4 /permissive-)
  else()
    target_compile_options(cca_persistence_example PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion)
  endif()
  if(BUILD_TESTING)
    add_test(NAME cca.persistence.example COMMAND cca_persistence_example)
    set_tests_properties(cca.persistence.example PROPERTIES LABELS "example;persistence")
  endif()
endif()

target_compile_features(cca_process PUBLIC cxx_std_23)
target_include_directories(
  cca_process
  PUBLIC
    "$<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>"
    "$<INSTALL_INTERFACE:include>"
)
target_link_libraries(
  cca_process
  PUBLIC
    cca::representation
  PRIVATE
    cca::runtime
)

if(COMMAND cca_configure_target)
  cca_configure_target(cca_process)
elseif(MSVC)
  target_compile_options(cca_process PRIVATE /W4 /permissive-)
else()
  target_compile_options(
    cca_process
    PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion
  )
endif()

if(CCA_BUILD_PROCESS_EXAMPLES)
  add_executable(
    cca_process_direct_example
    examples/process_usage.cpp
  )
  target_compile_features(
    cca_process_direct_example
    PRIVATE cxx_std_23
  )
  target_link_libraries(
    cca_process_direct_example
    PRIVATE cca::process
  )

  add_executable(
    cca_process_runtime_example
    examples/process_runtime_usage.cpp
  )
  target_compile_features(
    cca_process_runtime_example
    PRIVATE cxx_std_23
  )
  target_link_libraries(
    cca_process_runtime_example
    PRIVATE cca::process cca::runtime
  )

  if(COMMAND cca_configure_target)
    cca_configure_target(cca_process_direct_example)
    cca_configure_target(cca_process_runtime_example)
  elseif(MSVC)
    target_compile_options(
      cca_process_direct_example
      PRIVATE /W4 /permissive-
    )
    target_compile_options(
      cca_process_runtime_example
      PRIVATE /W4 /permissive-
    )
  else()
    target_compile_options(
      cca_process_direct_example
      PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion
    )
    target_compile_options(
      cca_process_runtime_example
      PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion
    )
  endif()

  if(BUILD_TESTING)
    add_test(
      NAME cca.process.example.direct
      COMMAND cca_process_direct_example
    )
    add_test(
      NAME cca.process.example.runtime
      COMMAND cca_process_runtime_example
    )
    set_tests_properties(
      cca.process.example.direct
      cca.process.example.runtime
      PROPERTIES LABELS "example;process"
    )
  endif()
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

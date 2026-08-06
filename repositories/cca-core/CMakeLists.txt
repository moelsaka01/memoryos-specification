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
option(
  CCA_BUILD_MEMORY_EXAMPLES
  "Build CCA Memory Foundation examples"
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

add_library(
  cca_memory
  STATIC
    src/memory/episodic_memory.cpp
    src/memory/episodic_memory_persistence.cpp
    src/memory/knowledge_retrieval.cpp
    src/memory/long_term_memory.cpp
    src/memory/long_term_memory_persistence.cpp
    src/memory/memory.cpp
    src/memory/memory_consolidation.cpp
    src/memory/memory_reflection.cpp
    src/memory/procedural_memory.cpp
    src/memory/procedural_memory_persistence.cpp
    src/memory/semantic_memory.cpp
    src/memory/semantic_memory_persistence.cpp
    src/memory/working_memory.cpp
)
add_library(cca::memory ALIAS cca_memory)
target_compile_features(cca_memory PUBLIC cxx_std_23)
target_include_directories(
  cca_memory
  PUBLIC
    "$<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>"
    "$<INSTALL_INTERFACE:include>"
)
target_link_libraries(cca_memory PRIVATE cca::persistence)
if(COMMAND cca_configure_target)
  cca_configure_target(cca_memory)
elseif(MSVC)
  target_compile_options(cca_memory PRIVATE /W4 /permissive-)
else()
  target_compile_options(
    cca_memory
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

if(CCA_BUILD_MEMORY_EXAMPLES)
  add_executable(cca_memory_example examples/memory_usage.cpp)
  target_compile_features(cca_memory_example PRIVATE cxx_std_23)
  target_link_libraries(cca_memory_example PRIVATE cca::memory)

  add_executable(
    cca_memory_consolidation_example
    examples/memory_consolidation_usage.cpp
  )
  target_compile_features(
    cca_memory_consolidation_example
    PRIVATE cxx_std_23
  )
  target_link_libraries(
    cca_memory_consolidation_example
    PRIVATE cca::memory
  )

  add_executable(
    cca_long_term_memory_example
    examples/long_term_memory_usage.cpp
  )
  target_compile_features(
    cca_long_term_memory_example
    PRIVATE cxx_std_23
  )
  target_link_libraries(
    cca_long_term_memory_example
    PRIVATE cca::memory
  )

  add_executable(
    cca_working_memory_example
    examples/working_memory_usage.cpp
  )
  target_compile_features(
    cca_working_memory_example
    PRIVATE cxx_std_23
  )
  target_link_libraries(
    cca_working_memory_example
    PRIVATE cca::memory
  )

  add_executable(
    cca_semantic_memory_example
    examples/semantic_memory_usage.cpp
  )
  target_compile_features(
    cca_semantic_memory_example
    PRIVATE cxx_std_23
  )
  target_link_libraries(
    cca_semantic_memory_example
    PRIVATE cca::memory
  )

  add_executable(
    cca_episodic_memory_example
    examples/episodic_memory_usage.cpp
  )
  target_compile_features(
    cca_episodic_memory_example
    PRIVATE cxx_std_23
  )
  target_link_libraries(
    cca_episodic_memory_example
    PRIVATE cca::memory
  )

  add_executable(
    cca_procedural_memory_example
    examples/procedural_memory_usage.cpp
  )
  target_compile_features(
    cca_procedural_memory_example
    PRIVATE cxx_std_23
  )
  target_link_libraries(
    cca_procedural_memory_example
    PRIVATE cca::memory
  )

  add_executable(
    cca_knowledge_retrieval_example
    examples/knowledge_retrieval_usage.cpp
  )
  target_compile_features(
    cca_knowledge_retrieval_example
    PRIVATE cxx_std_23
  )
  target_link_libraries(
    cca_knowledge_retrieval_example
    PRIVATE cca::memory
  )

  add_executable(
    cca_memory_reflection_example
    examples/memory_reflection_usage.cpp
  )
  target_compile_features(
    cca_memory_reflection_example
    PRIVATE cxx_std_23
  )
  target_link_libraries(
    cca_memory_reflection_example
    PRIVATE cca::memory
  )

  if(COMMAND cca_configure_target)
    cca_configure_target(cca_memory_example)
    cca_configure_target(cca_memory_consolidation_example)
    cca_configure_target(cca_long_term_memory_example)
    cca_configure_target(cca_episodic_memory_example)
    cca_configure_target(cca_procedural_memory_example)
    cca_configure_target(cca_knowledge_retrieval_example)
    cca_configure_target(cca_memory_reflection_example)
    cca_configure_target(cca_semantic_memory_example)
    cca_configure_target(cca_working_memory_example)
  elseif(MSVC)
    target_compile_options(cca_memory_example PRIVATE /W4 /permissive-)
    target_compile_options(
      cca_memory_consolidation_example
      PRIVATE /W4 /permissive-
    )
    target_compile_options(
      cca_long_term_memory_example
      PRIVATE /W4 /permissive-
    )
    target_compile_options(
      cca_episodic_memory_example
      PRIVATE /W4 /permissive-
    )
    target_compile_options(
      cca_procedural_memory_example
      PRIVATE /W4 /permissive-
    )
    target_compile_options(
      cca_knowledge_retrieval_example
      PRIVATE /W4 /permissive-
    )
    target_compile_options(
      cca_memory_reflection_example
      PRIVATE /W4 /permissive-
    )
    target_compile_options(
      cca_semantic_memory_example
      PRIVATE /W4 /permissive-
    )
    target_compile_options(
      cca_working_memory_example
      PRIVATE /W4 /permissive-
    )
  else()
    target_compile_options(
      cca_memory_example
      PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion
    )
    target_compile_options(
      cca_memory_consolidation_example
      PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion
    )
    target_compile_options(
      cca_long_term_memory_example
      PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion
    )
    target_compile_options(
      cca_episodic_memory_example
      PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion
    )
    target_compile_options(
      cca_procedural_memory_example
      PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion
    )
    target_compile_options(
      cca_knowledge_retrieval_example
      PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion
    )
    target_compile_options(
      cca_memory_reflection_example
      PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion
    )
    target_compile_options(
      cca_semantic_memory_example
      PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion
    )
    target_compile_options(
      cca_working_memory_example
      PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion
    )
  endif()

  if(BUILD_TESTING)
    add_test(NAME cca.memory.example COMMAND cca_memory_example)
    add_test(
      NAME cca.memory_consolidation.example
      COMMAND cca_memory_consolidation_example
    )
    add_test(
      NAME cca.long_term_memory.example
      COMMAND cca_long_term_memory_example
    )
    add_test(
      NAME cca.episodic_memory.example
      COMMAND cca_episodic_memory_example
    )
    add_test(
      NAME cca.procedural_memory.example
      COMMAND cca_procedural_memory_example
    )
    add_test(
      NAME cca.knowledge_retrieval.example
      COMMAND cca_knowledge_retrieval_example
    )
    add_test(
      NAME cca.memory_reflection.example
      COMMAND cca_memory_reflection_example
    )
    add_test(
      NAME cca.semantic_memory.example
      COMMAND cca_semantic_memory_example
    )
    add_test(
      NAME cca.working_memory.example
      COMMAND cca_working_memory_example
    )
    set_tests_properties(
      cca.memory.example
      PROPERTIES LABELS "example;memory"
    )
    set_tests_properties(
      cca.memory_consolidation.example
      PROPERTIES LABELS "example;memory;memory_consolidation"
    )
    set_tests_properties(
      cca.long_term_memory.example
      PROPERTIES LABELS "example;memory;long_term_memory"
    )
    set_tests_properties(
      cca.episodic_memory.example
      PROPERTIES LABELS "example;memory;episodic_memory"
    )
    set_tests_properties(
      cca.procedural_memory.example
      PROPERTIES LABELS "example;memory;procedural_memory"
    )
    set_tests_properties(
      cca.knowledge_retrieval.example
      PROPERTIES LABELS "example;memory;knowledge_retrieval"
    )
    set_tests_properties(
      cca.memory_reflection.example
      PROPERTIES LABELS "example;memory;memory_reflection"
    )
    set_tests_properties(
      cca.semantic_memory.example
      PROPERTIES LABELS "example;memory;semantic_memory"
    )
    set_tests_properties(
      cca.working_memory.example
      PROPERTIES LABELS "example;memory;working_memory"
    )
  endif()
endif()

if(BUILD_TESTING AND CCA_BUILD_TESTS)
  add_subdirectory(tests)
endif()

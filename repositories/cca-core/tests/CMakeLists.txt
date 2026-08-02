set(
  CCA_CORE_TEST_SOURCES
  configuration_test.cpp
  configuration_manager_runtime_test.cpp
  dependency_injector_test.cpp
  event_bus_test.cpp
  lifecycle_manager_test.cpp
  logging_test.cpp
  memory_test.cpp
  observability_test.cpp
  process_test.cpp
  persistence_test.cpp
  representation_internal_test.cpp
  representation_test.cpp
  recording_log_sink_test.cpp
  runtime_host_test.cpp
  runtime_test.cpp
  service_registry_test.cpp
  string_utils_test.cpp
  version_test.cpp
  working_memory_test.cpp
)

add_test(
  NAME cca.memory.architecture
  COMMAND
    "${CMAKE_COMMAND}"
    "-DCCA_CORE_SOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}/.."
    -P
    "${CMAKE_CURRENT_SOURCE_DIR}/memory_architecture_test.cmake"
)
set_tests_properties(
  cca.memory.architecture
  PROPERTIES LABELS "architecture;core;memory"
)

add_test(
  NAME cca.working_memory.architecture
  COMMAND
    "${CMAKE_COMMAND}"
    "-DCCA_CORE_SOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}/.."
    -P
    "${CMAKE_CURRENT_SOURCE_DIR}/working_memory_architecture_test.cmake"
)
set_tests_properties(
  cca.working_memory.architecture
  PROPERTIES LABELS "architecture;core;memory;working_memory"
)

add_test(
  NAME cca.process.architecture
  COMMAND
    "${CMAKE_COMMAND}"
    "-DCCA_CORE_SOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}/.."
    -P
    "${CMAKE_CURRENT_SOURCE_DIR}/process_architecture_test.cmake"
)
set_tests_properties(
  cca.process.architecture
  PROPERTIES LABELS "architecture;core;process"
)

if(COMMAND cca_add_google_test)
  cca_add_google_test(
    TARGET cca_core_tests
    SOURCES ${CCA_CORE_TEST_SOURCES}
    LIBRARIES cca::core cca::memory cca::process cca::persistence cca::representation cca::runtime cca::testing
    LABELS core memory process representation runtime unit
  )
  cca_add_google_test(
    TARGET cca_process_allocation_tests
    SOURCES process_allocation_failure_test.cpp
    LIBRARIES cca::process cca::representation
    LABELS core process unit
  )
  cca_add_google_test(
    TARGET cca_memory_allocation_tests
    SOURCES memory_allocation_failure_test.cpp
    LIBRARIES cca::memory
    LABELS core memory unit
  )
  cca_add_google_test(
    TARGET cca_working_memory_allocation_tests
    SOURCES working_memory_allocation_failure_test.cpp
    LIBRARIES cca::memory
    LABELS core memory working_memory unit
  )
else()
  find_package(GTest CONFIG REQUIRED)

  add_executable(cca_core_tests ${CCA_CORE_TEST_SOURCES})
  target_link_libraries(
    cca_core_tests
    PRIVATE
      cca::core
      cca::memory
      cca::process
      cca::persistence
      cca::representation
      cca::runtime
      cca::testing
      GTest::gtest_main
  )

  if(MSVC)
    target_compile_options(cca_core_tests PRIVATE /W4 /permissive-)
  else()
    target_compile_options(
      cca_core_tests
      PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion
    )
  endif()

  include(GoogleTest)
  gtest_discover_tests(cca_core_tests DISCOVERY_TIMEOUT 30)

  add_executable(
    cca_process_allocation_tests
    process_allocation_failure_test.cpp
  )
  target_link_libraries(
    cca_process_allocation_tests
    PRIVATE
      cca::process
      cca::representation
      GTest::gtest_main
  )

  if(MSVC)
    target_compile_options(
      cca_process_allocation_tests
      PRIVATE /W4 /permissive-
    )
  else()
    target_compile_options(
      cca_process_allocation_tests
      PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion
    )
  endif()

  gtest_discover_tests(
    cca_process_allocation_tests
    DISCOVERY_TIMEOUT 30
  )

  add_executable(
    cca_memory_allocation_tests
    memory_allocation_failure_test.cpp
  )
  target_link_libraries(
    cca_memory_allocation_tests
    PRIVATE
      cca::memory
      GTest::gtest_main
  )

  if(MSVC)
    target_compile_options(
      cca_memory_allocation_tests
      PRIVATE /W4 /permissive-
    )
  else()
    target_compile_options(
      cca_memory_allocation_tests
      PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion
    )
  endif()

  gtest_discover_tests(
    cca_memory_allocation_tests
    DISCOVERY_TIMEOUT 30
  )

  add_executable(
    cca_working_memory_allocation_tests
    working_memory_allocation_failure_test.cpp
  )
  target_link_libraries(
    cca_working_memory_allocation_tests
    PRIVATE
      cca::memory
      GTest::gtest_main
  )

  if(MSVC)
    target_compile_options(
      cca_working_memory_allocation_tests
      PRIVATE /W4 /permissive-
    )
  else()
    target_compile_options(
      cca_working_memory_allocation_tests
      PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion
    )
  endif()

  gtest_discover_tests(
    cca_working_memory_allocation_tests
    DISCOVERY_TIMEOUT 30
  )
endif()

target_include_directories(
  cca_core_tests
  PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/../src/representation"
)

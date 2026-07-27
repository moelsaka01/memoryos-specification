set(
  CCA_CORE_TEST_SOURCES
  configuration_test.cpp
  configuration_manager_runtime_test.cpp
  dependency_injector_test.cpp
  event_bus_test.cpp
  lifecycle_manager_test.cpp
  logging_test.cpp
  observability_test.cpp
  recording_log_sink_test.cpp
  runtime_host_test.cpp
  runtime_test.cpp
  service_registry_test.cpp
  string_utils_test.cpp
  version_test.cpp
)

if(COMMAND cca_add_google_test)
  cca_add_google_test(
    TARGET cca_core_tests
    SOURCES ${CCA_CORE_TEST_SOURCES}
    LIBRARIES cca::core cca::runtime cca::testing
    LABELS core runtime unit
  )
else()
  find_package(GTest CONFIG REQUIRED)

  add_executable(cca_core_tests ${CCA_CORE_TEST_SOURCES})
  target_link_libraries(
    cca_core_tests
    PRIVATE
      cca::core
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
endif()

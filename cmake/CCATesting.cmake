include_guard(GLOBAL)

include(GoogleTest)

function(cca_add_google_test)
  set(one_value_arguments TARGET)
  set(multi_value_arguments SOURCES LIBRARIES LABELS)
  cmake_parse_arguments(CCATEST "" "${one_value_arguments}" "${multi_value_arguments}" ${ARGN})

  if(NOT BUILD_TESTING)
    return()
  endif()
  if(NOT CCATEST_TARGET)
    message(FATAL_ERROR "cca_add_google_test requires TARGET")
  endif()
  if(NOT CCATEST_SOURCES)
    message(FATAL_ERROR "cca_add_google_test(${CCATEST_TARGET}) requires SOURCES")
  endif()

  find_package(GTest CONFIG REQUIRED)
  add_executable("${CCATEST_TARGET}" ${CCATEST_SOURCES})
  target_link_libraries(
    "${CCATEST_TARGET}"
    PRIVATE
      GTest::gtest_main
      ${CCATEST_LIBRARIES}
  )
  cca_configure_target("${CCATEST_TARGET}")

  gtest_discover_tests(
    "${CCATEST_TARGET}"
    DISCOVERY_MODE PRE_TEST
    PROPERTIES LABELS "${CCATEST_LABELS}"
  )
endfunction()

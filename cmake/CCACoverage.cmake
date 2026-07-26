include_guard(GLOBAL)

function(cca_add_coverage_report_target)
  if(NOT CCA_ENABLE_COVERAGE OR TARGET cca_coverage)
    return()
  endif()

  find_program(gcovr_executable NAMES gcovr)
  if(NOT gcovr_executable)
    message(STATUS "gcovr was not found; the cca_coverage report target is unavailable")
    return()
  endif()

  set(coverage_directory "${CMAKE_BINARY_DIR}/coverage")
  add_custom_target(
    cca_coverage
    COMMAND "${CMAKE_COMMAND}" -E make_directory "${coverage_directory}"
    COMMAND
      "${gcovr_executable}"
      --root "${CMAKE_SOURCE_DIR}"
      --filter "${CMAKE_SOURCE_DIR}/repositories"
      --exclude "${CMAKE_SOURCE_DIR}/out"
      --fail-under-line 90
      --html-details "${coverage_directory}/index.html"
      --xml-pretty "${coverage_directory}/coverage.xml"
      "${CMAKE_BINARY_DIR}"
    WORKING_DIRECTORY "${CMAKE_SOURCE_DIR}"
    COMMENT "Generating CCA HTML and Cobertura coverage reports"
    VERBATIM
  )
endfunction()

find_package(Python3 3.12 COMPONENTS Interpreter QUIET)

if(Python3_Interpreter_FOUND)
  add_test(
    NAME cca.workspace.verify
    COMMAND
      "${Python3_EXECUTABLE}"
      "${CMAKE_SOURCE_DIR}/tools/verify_workspace.py"
      --root
      "${CMAKE_SOURCE_DIR}"
  )
  set_tests_properties(cca.workspace.verify PROPERTIES LABELS "infrastructure")
  # Hosted POSIX runners cannot re-run the MO-1304 Windows-toolchain parity
  # validation; the verifier then reports that one sub-check as
  # NOT_RUN_ON_HOSTED_RUNNER and still enforces every other check.
  option(
    CCA_WORKSPACE_VERIFY_NOT_RUN_MO1304_PARITY
    "Report only the MO-1304 Windows-toolchain parity sub-check of cca.workspace.verify as not run"
    OFF
  )
  if(CCA_WORKSPACE_VERIFY_NOT_RUN_MO1304_PARITY OR "$ENV{CCA_WORKSPACE_VERIFY_NOT_RUN_MO1304_PARITY}" STREQUAL "1")
    set_property(
      TEST cca.workspace.verify
      PROPERTY ENVIRONMENT "CCA_VERIFY_WORKSPACE_NOT_RUN=MO1304_WINDOWS_TOOLCHAIN_PARITY"
    )
  endif()
else()
  message(STATUS "Python 3.12+ not found; workspace structure test is disabled")
endif()

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
else()
  message(STATUS "Python 3.12+ not found; workspace structure test is disabled")
endif()

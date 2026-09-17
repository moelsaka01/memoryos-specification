cmake_minimum_required(VERSION 3.28)

if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
  project(memoryos_vscode VERSION 0.1.0 LANGUAGES NONE)
  include(CTest)
  option(CCA_BUILD_TESTS "Build MemoryOS VS Code extension tests" "${BUILD_TESTING}")
endif()

find_program(MEMORYOS_VSCODE_NODE_EXECUTABLE NAMES node node.exe REQUIRED)
find_program(MEMORYOS_VSCODE_NPM_EXECUTABLE NAMES npm npm.cmd REQUIRED)

add_custom_target(
  memoryos_vscode_check
  COMMAND "${MEMORYOS_VSCODE_NPM_EXECUTABLE}" run typecheck
  COMMAND "${MEMORYOS_VSCODE_NPM_EXECUTABLE}" test -- --test-concurrency=1
  WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
  COMMENT "Checking the MemoryOS VS Code extension foundation"
  VERBATIM
)

add_custom_target(
  memoryos_vscode_build
  COMMAND "${MEMORYOS_VSCODE_NPM_EXECUTABLE}" run build
  WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
  COMMENT "Building the MemoryOS VS Code extension foundation"
  VERBATIM
)

if(BUILD_TESTING AND CCA_BUILD_TESTS)
  add_test(
    NAME memoryos.vscode.shell
    COMMAND "${MEMORYOS_VSCODE_NODE_EXECUTABLE}" --test
            "${CMAKE_CURRENT_SOURCE_DIR}/tests/extension_shell_contract.test.mjs"
    WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
  )
  set_tests_properties(
    memoryos.vscode.shell
    PROPERTIES LABELS "memoryos;vscode;automation"
  )
  add_test(
    NAME memoryos.vscode.runtime
    COMMAND "${MEMORYOS_VSCODE_NODE_EXECUTABLE}" --test
            "${CMAKE_CURRENT_SOURCE_DIR}/tests/runtime_foundation.test.mjs"
    WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
  )
  set_tests_properties(
    memoryos.vscode.runtime
    PROPERTIES LABELS "memoryos;vscode;automation;runtime;security"
  )
  add_test(
    NAME memoryos.vscode.product
    COMMAND "${MEMORYOS_VSCODE_NODE_EXECUTABLE}" --test
            "${CMAKE_CURRENT_SOURCE_DIR}/tests/phase2_product_ux.test.mjs"
    WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
  )
  set_tests_properties(
    memoryos.vscode.product
    PROPERTIES LABELS "memoryos;vscode;automation;product;security;phase2"
  )
endif()

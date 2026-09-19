cmake_minimum_required(VERSION 3.28)

if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
  project(memoryos_vscode VERSION 0.1.0 LANGUAGES NONE)
  include(CTest)
  option(CCA_BUILD_TESTS "Build MemoryOS VS Code extension tests" "${BUILD_TESTING}")
endif()

option(
  MEMORYOS_VSCODE_ENABLE_EXTENSION_HOST_TESTS
  "Enable pinned VS Code 1.137.0 Extension Host tests (may acquire the test host)"
  OFF
)

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

add_custom_target(
  memoryos_vscode_package
  COMMAND "${MEMORYOS_VSCODE_NPM_EXECUTABLE}" run package:vsix
  COMMAND "${MEMORYOS_VSCODE_NPM_EXECUTABLE}" run verify:vsix
  WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
  COMMENT "Packaging and verifying the MemoryOS VSIX"
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
  add_test(
    NAME memoryos.vscode.package.validation
    COMMAND "${MEMORYOS_VSCODE_NPM_EXECUTABLE}" run test:package
    WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
  )
  set_tests_properties(
    memoryos.vscode.package.validation
    PROPERTIES LABELS "memoryos;vscode;automation;package;vsix;security;phase3"
  )

  if(MEMORYOS_VSCODE_ENABLE_EXTENSION_HOST_TESTS)
    add_test(
      NAME memoryos.vscode.vsix.build
      COMMAND "${MEMORYOS_VSCODE_NPM_EXECUTABLE}" run package:vsix
      WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
    )
    set_tests_properties(
      memoryos.vscode.vsix.build
      PROPERTIES LABELS "memoryos;vscode;automation;package;vsix;phase3"
    )
    add_test(
      NAME memoryos.vscode.vsix.verify
      COMMAND "${MEMORYOS_VSCODE_NPM_EXECUTABLE}" run verify:vsix
      WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
    )
    set_tests_properties(
      memoryos.vscode.vsix.verify
      PROPERTIES
        DEPENDS memoryos.vscode.vsix.build
        LABELS "memoryos;vscode;automation;package;vsix;security;phase3"
    )
    add_test(
      NAME memoryos.vscode.extension-host
      COMMAND "${MEMORYOS_VSCODE_NPM_EXECUTABLE}" run test:host
      WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
    )
    set_tests_properties(
      memoryos.vscode.extension-host
      PROPERTIES
        DEPENDS memoryos.vscode.vsix.verify
        LABELS "memoryos;vscode;automation;extension-host;installed-vsix;security;phase3"
    )
    add_test(
      NAME memoryos.vscode.extension-host.offline
      COMMAND "${MEMORYOS_VSCODE_NPM_EXECUTABLE}" run test:host:offline
      WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
    )
    set_tests_properties(
      memoryos.vscode.extension-host.offline
      PROPERTIES
        DEPENDS memoryos.vscode.extension-host
        LABELS "memoryos;vscode;automation;extension-host;installed-vsix;offline;phase3"
    )
  endif()
endif()

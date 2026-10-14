cmake_minimum_required(VERSION 3.28)

if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
  project(memoryos_cli VERSION 1.0.0 LANGUAGES NONE)
  include(CTest)
  option(CCA_BUILD_TESTS "Build MemoryOS CLI tests" "${BUILD_TESTING}")
endif()

if(NOT DEFINED CMAKE_INSTALL_DATADIR)
  set(CMAKE_INSTALL_DATADIR "share")
endif()

find_program(MEMORYOS_CLI_NODE_EXECUTABLE NAMES node node.exe REQUIRED)

add_custom_target(
  memoryos_cli_check
  COMMAND "${MEMORYOS_CLI_NODE_EXECUTABLE}" --check
          "${CMAKE_CURRENT_SOURCE_DIR}/bin/memoryos.js"
  COMMAND "${MEMORYOS_CLI_NODE_EXECUTABLE}" --check
          "${CMAKE_CURRENT_SOURCE_DIR}/src/main.js"
  COMMENT "Checking the MemoryOS CLI entry points"
  VERBATIM
)

if(BUILD_TESTING AND CCA_BUILD_TESTS)
  add_test(
    NAME memoryos.cli.unit
    COMMAND "${MEMORYOS_CLI_NODE_EXECUTABLE}" --test
    WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
  )
  add_test(
    NAME memoryos.cli.examples
    COMMAND
      "${MEMORYOS_CLI_NODE_EXECUTABLE}"
      "${CMAKE_CURRENT_SOURCE_DIR}/examples/run-cli-examples.mjs"
  )
  set_tests_properties(
    memoryos.cli.unit
    memoryos.cli.examples
    PROPERTIES LABELS "memoryos;cli;automation"
  )
endif()

install(
  DIRECTORY bin src docs examples
  DESTINATION "${CMAKE_INSTALL_DATADIR}/memoryos-cli"
)
install(
  FILES package.json README.md
  DESTINATION "${CMAKE_INSTALL_DATADIR}/memoryos-cli"
)

cmake_minimum_required(VERSION 3.28)
if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
  project(memoryos_mcp VERSION 0.1.0 LANGUAGES NONE)
  include(CTest)
  option(CCA_BUILD_TESTS "Build MemoryOS MCP tests" "${BUILD_TESTING}")
endif()
find_program(MEMORYOS_MCP_NODE_EXECUTABLE NAMES node node.exe REQUIRED)
add_custom_target(memoryos_mcp_verify
  COMMAND "${MEMORYOS_MCP_NODE_EXECUTABLE}" scripts/verify.mjs
  WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}" VERBATIM)
if(BUILD_TESTING AND CCA_BUILD_TESTS)
  add_test(NAME memoryos.mcp.foundation
    COMMAND "${MEMORYOS_MCP_NODE_EXECUTABLE}" --test --test-concurrency=1 "tests/*.test.mjs")
  set_tests_properties(memoryos.mcp.foundation PROPERTIES
    WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
    LABELS "memoryos;memoryos-1.3;mo1304;phase1;mcp;adapter")
endif()

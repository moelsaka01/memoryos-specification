cmake_minimum_required(VERSION 3.28)

if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
  project(memoryos_sdk VERSION 1.0.0 LANGUAGES CXX)
  include(CTest)
  include(GNUInstallDirs)
  set(CMAKE_CXX_SCAN_FOR_MODULES OFF)
  option(CCA_BUILD_TESTS "Build MemoryOS SDK unit tests" "${BUILD_TESTING}")
endif()

option(
  MEMORYOS_BUILD_CPP_EXAMPLES
  "Build the native MemoryOS SDK examples"
  "${BUILD_TESTING}"
)

find_program(MEMORYOS_NODE_EXECUTABLE NAMES node node.exe REQUIRED)
set(
  MEMORYOS_CORE_HOST
  "${CMAKE_CURRENT_SOURCE_DIR}/bridge/investigation-core-host.mjs"
)
if(NOT EXISTS "${MEMORYOS_CORE_HOST}")
  message(FATAL_ERROR
    "The MO-1204 private Investigation Core host is required: ${MEMORYOS_CORE_HOST}"
  )
endif()

file(TO_CMAKE_PATH "${MEMORYOS_NODE_EXECUTABLE}" MEMORYOS_NODE_EXECUTABLE_DEFINE)
file(TO_CMAKE_PATH "${MEMORYOS_CORE_HOST}" MEMORYOS_CORE_HOST_DEFINE)
file(
  TO_CMAKE_PATH
  "${CMAKE_INSTALL_FULL_DATADIR}/memoryos-sdk/bridge/investigation-core-host.mjs"
  MEMORYOS_INSTALL_CORE_HOST_DEFINE
)

add_library(
  memoryos_sdk
  STATIC
    src/client.cpp
    src/core_process.cpp
    src/memoryos.cpp
)
add_library(memoryos::sdk ALIAS memoryos_sdk)
add_library(cca::sdk ALIAS memoryos_sdk)
set_target_properties(memoryos_sdk PROPERTIES OUTPUT_NAME "memoryos-sdk")
target_compile_features(memoryos_sdk PUBLIC cxx_std_23)
target_include_directories(
  memoryos_sdk
  PUBLIC
    "$<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>"
    "$<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}>"
)
target_compile_definitions(
  memoryos_sdk
  PRIVATE
    "MEMORYOS_SDK_DEFAULT_NODE_EXECUTABLE=\"${MEMORYOS_NODE_EXECUTABLE_DEFINE}\""
    "MEMORYOS_SDK_DEFAULT_CORE_HOST=\"${MEMORYOS_CORE_HOST_DEFINE}\""
    "MEMORYOS_SDK_INSTALL_CORE_HOST=\"${MEMORYOS_INSTALL_CORE_HOST_DEFINE}\""
)

if(COMMAND cca_configure_target)
  cca_configure_target(memoryos_sdk)
elseif(MSVC)
  target_compile_options(memoryos_sdk PRIVATE /W4 /WX /permissive-)
else()
  target_compile_options(
    memoryos_sdk
    PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion -Werror
  )
endif()

set(MEMORYOS_SDK_GENERATED_DIR "${CMAKE_CURRENT_BINARY_DIR}/generated")
set(
  MEMORYOS_SDK_REFERENCE_SNAPSHOT
  "${MEMORYOS_SDK_GENERATED_DIR}/reference-snapshot.json"
)
set(
  MEMORYOS_SDK_CHANGED_SNAPSHOT
  "${MEMORYOS_SDK_GENERATED_DIR}/changed-snapshot.json"
)
add_custom_command(
  OUTPUT
    "${MEMORYOS_SDK_REFERENCE_SNAPSHOT}"
    "${MEMORYOS_SDK_CHANGED_SNAPSHOT}"
  COMMAND "${CMAKE_COMMAND}" -E make_directory "${MEMORYOS_SDK_GENERATED_DIR}"
  COMMAND
    "${MEMORYOS_NODE_EXECUTABLE}"
    "${CMAKE_CURRENT_SOURCE_DIR}/tests/generate-reference-snapshot.mjs"
    "${MEMORYOS_SDK_REFERENCE_SNAPSHOT}"
    "${MEMORYOS_SDK_CHANGED_SNAPSHOT}"
  DEPENDS
    tests/generate-reference-snapshot.mjs
    "${CMAKE_CURRENT_SOURCE_DIR}/../cca-studio/web/data/studio-snapshot.js"
  VERBATIM
)
add_custom_target(
  memoryos_sdk_test_fixture
  DEPENDS
    "${MEMORYOS_SDK_REFERENCE_SNAPSHOT}"
    "${MEMORYOS_SDK_CHANGED_SNAPSHOT}"
)

if(MEMORYOS_BUILD_CPP_EXAMPLES)
  add_executable(
    memoryos_sdk_cpp_quickstart
    examples/cpp_quickstart.cpp
  )
  add_executable(
    memoryos_sdk_cpp_regression
    examples/cpp_regression.cpp
  )
  add_executable(
    memoryos_sdk_cpp_investigate
    examples/cpp_investigate.cpp
  )
  target_compile_features(memoryos_sdk_cpp_quickstart PRIVATE cxx_std_23)
  target_compile_features(memoryos_sdk_cpp_regression PRIVATE cxx_std_23)
  target_compile_features(memoryos_sdk_cpp_investigate PRIVATE cxx_std_23)
  target_link_libraries(memoryos_sdk_cpp_quickstart PRIVATE memoryos::sdk)
  target_link_libraries(memoryos_sdk_cpp_regression PRIVATE memoryos::sdk)
  target_link_libraries(memoryos_sdk_cpp_investigate PRIVATE memoryos::sdk)
  add_dependencies(memoryos_sdk_cpp_quickstart memoryos_sdk_test_fixture)
  add_dependencies(memoryos_sdk_cpp_regression memoryos_sdk_test_fixture)
  add_dependencies(memoryos_sdk_cpp_investigate memoryos_sdk_test_fixture)
  target_compile_definitions(
    memoryos_sdk_cpp_quickstart
    PRIVATE
      "MEMORYOS_SDK_REFERENCE_SNAPSHOT=\"${MEMORYOS_SDK_REFERENCE_SNAPSHOT}\""
  )
  target_compile_definitions(
    memoryos_sdk_cpp_regression
    PRIVATE
      "MEMORYOS_SDK_REFERENCE_SNAPSHOT=\"${MEMORYOS_SDK_REFERENCE_SNAPSHOT}\""
      "MEMORYOS_SDK_CHANGED_SNAPSHOT=\"${MEMORYOS_SDK_CHANGED_SNAPSHOT}\""
  )
  target_compile_definitions(
    memoryos_sdk_cpp_investigate
    PRIVATE
      "MEMORYOS_SDK_REFERENCE_SNAPSHOT=\"${MEMORYOS_SDK_REFERENCE_SNAPSHOT}\""
      "MEMORYOS_SDK_CHANGED_SNAPSHOT=\"${MEMORYOS_SDK_CHANGED_SNAPSHOT}\""
  )
  if(COMMAND cca_configure_target)
    cca_configure_target(memoryos_sdk_cpp_quickstart)
    cca_configure_target(memoryos_sdk_cpp_regression)
    cca_configure_target(memoryos_sdk_cpp_investigate)
  elseif(MSVC)
    target_compile_options(
      memoryos_sdk_cpp_quickstart PRIVATE /W4 /WX /permissive-
    )
    target_compile_options(
      memoryos_sdk_cpp_regression PRIVATE /W4 /WX /permissive-
    )
    target_compile_options(
      memoryos_sdk_cpp_investigate PRIVATE /W4 /WX /permissive-
    )
  else()
    target_compile_options(
      memoryos_sdk_cpp_quickstart
      PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion -Werror
    )
    target_compile_options(
      memoryos_sdk_cpp_regression
      PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion -Werror
    )
    target_compile_options(
      memoryos_sdk_cpp_investigate
      PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion -Werror
    )
  endif()
  if(BUILD_TESTING)
    add_test(NAME memoryos.sdk.cpp.example COMMAND memoryos_sdk_cpp_quickstart)
    add_test(NAME memoryos.sdk.cpp.regression.example COMMAND memoryos_sdk_cpp_regression)
    add_test(NAME memoryos.sdk.cpp.investigate.example COMMAND memoryos_sdk_cpp_investigate)
    set_tests_properties(
      memoryos.sdk.cpp.example
      memoryos.sdk.cpp.regression.example
      memoryos.sdk.cpp.investigate.example
      PROPERTIES LABELS "memoryos;sdk;cpp;example"
    )
  endif()
endif()

if(BUILD_TESTING AND CCA_BUILD_TESTS)
  if(COMMAND cca_add_google_test)
    cca_add_google_test(
      TARGET memoryos_sdk_cpp_tests
      SOURCES tests/memoryos_sdk_test.cpp
      LIBRARIES memoryos::sdk
      LABELS "memoryos;sdk;cpp;unit"
    )
  else()
    find_package(GTest CONFIG REQUIRED)
    add_executable(memoryos_sdk_cpp_tests tests/memoryos_sdk_test.cpp)
    target_compile_features(memoryos_sdk_cpp_tests PRIVATE cxx_std_23)
    target_link_libraries(
      memoryos_sdk_cpp_tests PRIVATE GTest::gtest_main memoryos::sdk
    )
    if(MSVC)
      target_compile_options(
        memoryos_sdk_cpp_tests PRIVATE /W4 /WX /permissive-
      )
    else()
      target_compile_options(
        memoryos_sdk_cpp_tests
        PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion -Werror
      )
    endif()
    include(GoogleTest)
    gtest_discover_tests(
      memoryos_sdk_cpp_tests
      DISCOVERY_MODE PRE_TEST
      PROPERTIES LABELS "memoryos;sdk;cpp;unit"
    )
  endif()
  add_dependencies(memoryos_sdk_cpp_tests memoryos_sdk_test_fixture)
  target_compile_definitions(
    memoryos_sdk_cpp_tests
    PRIVATE
      "MEMORYOS_SDK_REFERENCE_SNAPSHOT=\"${MEMORYOS_SDK_REFERENCE_SNAPSHOT}\""
      "MEMORYOS_SDK_CHANGED_SNAPSHOT=\"${MEMORYOS_SDK_CHANGED_SNAPSHOT}\""
      "MEMORYOS_SDK_COMPLETE_MIP_B64=\"${CMAKE_CURRENT_SOURCE_DIR}/../cca-studio/tests/fixtures/mip/complete-investigation.mip.b64\""
      "MEMORYOS_SDK_EXTENSION_MIP_B64=\"${CMAKE_CURRENT_SOURCE_DIR}/../cca-studio/tests/fixtures/mip/noncritical-extension.mip.b64\""
  )

  find_package(Python3 3.12 COMPONENTS Interpreter QUIET)
  if(Python3_Interpreter_FOUND)
    add_test(
      NAME memoryos.sdk.python.unit
      COMMAND
        "${Python3_EXECUTABLE}"
        "${CMAKE_CURRENT_SOURCE_DIR}/python/tests/test_memoryos_sdk.py"
    )
    add_test(
      NAME memoryos.sdk.python.examples
      COMMAND
        "${Python3_EXECUTABLE}"
        "${CMAKE_CURRENT_SOURCE_DIR}/python/tests/test_examples.py"
    )
    set_tests_properties(
      memoryos.sdk.python.unit
      memoryos.sdk.python.examples
      PROPERTIES
        ENVIRONMENT
          "PYTHONPATH=${CMAKE_CURRENT_SOURCE_DIR}/python/src;MEMORYOS_NODE=${MEMORYOS_NODE_EXECUTABLE}"
        LABELS "memoryos;sdk;python"
    )
  endif()
endif()

install(
  TARGETS memoryos_sdk
  ARCHIVE DESTINATION "${CMAKE_INSTALL_LIBDIR}"
  LIBRARY DESTINATION "${CMAKE_INSTALL_LIBDIR}"
  RUNTIME DESTINATION "${CMAKE_INSTALL_BINDIR}"
)
install(
  DIRECTORY include/
  DESTINATION "${CMAKE_INSTALL_INCLUDEDIR}"
)
install(
  FILES bridge/investigation-core-host.mjs
  DESTINATION "${CMAKE_INSTALL_DATADIR}/memoryos-sdk/bridge"
)

# The binding imports the frozen Investigation Core directly. Install that
# exact ESM dependency closure beside the binding so an installed SDK does not
# depend on the source checkout and does not duplicate Core behavior.
set(
  MEMORYOS_SDK_CORE_MODULES
  ../cca-studio/web/js/cognitive-investigation-explorer.js
  ../cca-studio/web/js/cognitive-regression.js
  ../cca-studio/web/js/cognitive-comparative-reconstruction.js
  ../cca-studio/web/js/cognitive-comparative-replay.js
  ../cca-studio/web/js/cognitive-evolution.js
  ../cca-studio/web/js/cognitive-evolution-controller.js
  ../cca-studio/web/js/cognitive-replay.js
  ../cca-studio/web/js/cognitive-trace.js
  ../cca-studio/web/js/deterministic-sequence-alignment.js
  ../cca-studio/web/js/investigation-core.js
  ../cca-studio/web/js/memory-investigation-package.js
  ../cca-studio/web/js/mip-canonical.js
  ../cca-studio/web/js/observation-timeline.js
  ../cca-studio/web/js/semantic-world.js
  ../cca-studio/web/js/studio-model.js
)
install(
  FILES ${MEMORYOS_SDK_CORE_MODULES}
  DESTINATION "${CMAKE_INSTALL_DATADIR}/cca-studio/web/js"
)
install(
  FILES ../cca-studio/web/data/studio-snapshot.js
  DESTINATION "${CMAKE_INSTALL_DATADIR}/cca-studio/web/data"
)
install(
  FILES ../cca-studio/package.json
  DESTINATION "${CMAKE_INSTALL_DATADIR}/cca-studio"
)

cmake_minimum_required(VERSION 3.28)

if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
  project(cca_studio VERSION 1.0.0 LANGUAGES CXX)
  include(CTest)
  include(GNUInstallDirs)
  set(CMAKE_CXX_SCAN_FOR_MODULES OFF)
  option(CCA_BUILD_TESTS "Build CCA repository unit tests" "${BUILD_TESTING}")

  if(NOT TARGET cca::memory)
    add_subdirectory(
      "${CMAKE_CURRENT_SOURCE_DIR}/../cca-core"
      "${CMAKE_CURRENT_BINARY_DIR}/cca-core"
    )
  endif()
endif()

option(
  CCA_BUILD_STUDIO_EXAMPLE
  "Build the headless Memory Studio C++ example"
  "${BUILD_TESTING}"
)
option(
  CCA_ENABLE_STUDIO_WEB_TESTS
  "Run dependency-free Memory Studio presentation tests when Node.js is available"
  ON
)

add_library(cca_studio STATIC src/memory_studio.cpp)
add_library(cca::studio ALIAS cca_studio)
set_target_properties(cca_studio PROPERTIES OUTPUT_NAME "cca-studio")
target_compile_features(cca_studio PUBLIC cxx_std_23)
target_include_directories(
  cca_studio
  PUBLIC
    "$<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>"
    "$<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}>"
)
target_link_libraries(cca_studio PUBLIC cca::memory)

if(COMMAND cca_configure_target)
  cca_configure_target(cca_studio)
elseif(MSVC)
  target_compile_options(cca_studio PRIVATE /W4 /permissive-)
else()
  target_compile_options(
    cca_studio
    PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion
  )
endif()

add_custom_target(
  cca_studio_web
  SOURCES
    package.json
    scripts/serve.mjs
    web/index.html
    web/styles.css
    web/assets/cca-mark.svg
    web/data/studio-snapshot.js
    web/js/app.js
    web/js/graph.js
    web/js/graph-view-state.js
    web/js/cognitive-trace.js
    web/js/cognitive-replay.js
    web/js/cognitive-evolution.js
    web/js/cognitive-evolution-controller.js
    web/js/cognitive-comparative-reconstruction.js
    web/js/cognitive-comparative-replay.js
    web/js/host-adapter.js
    web/js/observation-timeline.js
    web/js/semantic-world.js
    web/js/studio-model.js
)

if(CCA_BUILD_STUDIO_EXAMPLE)
  add_executable(cca_memory_studio_example examples/memory_studio_usage.cpp)
  target_compile_features(cca_memory_studio_example PRIVATE cxx_std_23)
  target_link_libraries(cca_memory_studio_example PRIVATE cca::studio)
  if(COMMAND cca_configure_target)
    cca_configure_target(cca_memory_studio_example)
  elseif(MSVC)
    target_compile_options(cca_memory_studio_example PRIVATE /W4 /permissive-)
  else()
    target_compile_options(
      cca_memory_studio_example
      PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion
    )
  endif()
  if(BUILD_TESTING)
    add_test(NAME cca.memory_studio.example COMMAND cca_memory_studio_example)
    set_tests_properties(
      cca.memory_studio.example
      PROPERTIES LABELS "example;memory;studio"
    )
  endif()
endif()

if(BUILD_TESTING AND CCA_BUILD_TESTS)
  if(COMMAND cca_add_google_test)
    cca_add_google_test(
      TARGET cca_memory_studio_tests
      SOURCES tests/memory_studio_test.cpp
      LIBRARIES cca::studio
      LABELS "studio;memory;unit"
    )
    cca_add_google_test(
      TARGET cca_memory_studio_allocation_tests
      SOURCES tests/memory_studio_allocation_failure_test.cpp
      LIBRARIES cca::studio
      LABELS "studio;memory;allocation;unit"
    )
  else()
    find_package(GTest CONFIG REQUIRED)
    foreach(studio_test_target IN ITEMS
            cca_memory_studio_tests cca_memory_studio_allocation_tests)
      if(studio_test_target STREQUAL "cca_memory_studio_tests")
        set(studio_test_source tests/memory_studio_test.cpp)
      else()
        set(studio_test_source tests/memory_studio_allocation_failure_test.cpp)
      endif()
      add_executable("${studio_test_target}" "${studio_test_source}")
      target_compile_features("${studio_test_target}" PRIVATE cxx_std_23)
      target_link_libraries(
        "${studio_test_target}"
        PRIVATE GTest::gtest_main cca::studio
      )
      if(COMMAND cca_configure_target)
        cca_configure_target("${studio_test_target}")
      elseif(MSVC)
        target_compile_options("${studio_test_target}" PRIVATE /W4 /permissive-)
      else()
        target_compile_options(
          "${studio_test_target}"
          PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion
        )
      endif()
      include(GoogleTest)
      gtest_discover_tests(
        "${studio_test_target}"
        DISCOVERY_MODE PRE_TEST
        PROPERTIES LABELS "studio;memory;unit"
      )
    endforeach()
  endif()

  add_test(
    NAME cca.memory_studio.architecture
    COMMAND
      "${CMAKE_COMMAND}"
      "-DCCA_STUDIO_SOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}"
      "-DCCA_CORE_SOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}/../cca-core"
      -P "${CMAKE_CURRENT_SOURCE_DIR}/tests/memory_studio_architecture_test.cmake"
  )
  set_tests_properties(
    cca.memory_studio.architecture
    PROPERTIES LABELS "architecture;studio;memory"
  )

  if(CCA_ENABLE_STUDIO_WEB_TESTS)
    find_program(CCA_NODE_EXECUTABLE NAMES node node.exe)
    if(CCA_NODE_EXECUTABLE)
      add_test(
        NAME cca.memory_studio.web
        COMMAND
          "${CCA_NODE_EXECUTABLE}" --test
          "${CMAKE_CURRENT_SOURCE_DIR}/tests/memory_studio_web_test.mjs"
      )
      set_tests_properties(
        cca.memory_studio.web
        PROPERTIES LABELS "studio;memory;web;unit"
      )
    else()
      message(STATUS "Node.js is unavailable; Memory Studio web tests are not registered")
    endif()
  endif()
endif()

install(
  TARGETS cca_studio
  ARCHIVE DESTINATION "${CMAKE_INSTALL_LIBDIR}"
  LIBRARY DESTINATION "${CMAKE_INSTALL_LIBDIR}"
  RUNTIME DESTINATION "${CMAKE_INSTALL_BINDIR}"
)
install(
  FILES include/cca/memory/memory_studio.hpp
  DESTINATION "${CMAKE_INSTALL_INCLUDEDIR}/cca/memory"
)
install(
  DIRECTORY web/
  DESTINATION "${CMAKE_INSTALL_DATADIR}/cca/memory-studio"
)

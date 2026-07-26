cmake_minimum_required(VERSION 3.25)

if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
    project(
        cca_compiler
        VERSION 0.2.0
        DESCRIPTION "Reference compiler framework for the Cognitive Computing Architecture"
        LANGUAGES CXX
    )
    include(CTest)
endif()

include(GNUInstallDirs)
include(CMakePackageConfigHelpers)
find_package(yaml-cpp CONFIG REQUIRED)

set(CCA_COMPILER_OWNS_VERSION_TARGET OFF)
if(NOT TARGET cca::version)
    set(CCA_COMPILER_OWNS_VERSION_TARGET ON)
    configure_file(
        "${CMAKE_CURRENT_SOURCE_DIR}/cmake/version.hpp.in"
        "${CMAKE_CURRENT_BINARY_DIR}/generated/cca/version.hpp"
        @ONLY
    )
    add_library(cca_compiler_version INTERFACE)
    add_library(cca::version ALIAS cca_compiler_version)
    target_include_directories(
        cca_compiler_version
        INTERFACE "$<BUILD_INTERFACE:${CMAKE_CURRENT_BINARY_DIR}/generated>"
    )
endif()

set(CCA_COMPILER_PUBLIC_HEADERS
    include/cca/compiler/analyzer.hpp
    include/cca/compiler/artifact_generator.hpp
    include/cca/compiler/canonical_value.hpp
    include/cca/compiler/cli.hpp
    include/cca/compiler/compiler_pipeline.hpp
    include/cca/compiler/compiler_service.hpp
    include/cca/compiler/configuration.hpp
    include/cca/compiler/conformance_generator.hpp
    include/cca/compiler/dependency_resolver.hpp
    include/cca/compiler/diagnostics.hpp
    include/cca/compiler/documentation_generator.hpp
    include/cca/compiler/internal_model.hpp
    include/cca/compiler/logging.hpp
    include/cca/compiler/model_builder.hpp
    include/cca/compiler/package_generator.hpp
    include/cca/compiler/parser.hpp
    include/cca/compiler/serialization.hpp
    include/cca/compiler/source_loader.hpp
    include/cca/compiler/validator.hpp
    include/cca/compiler/version.hpp
)

set(CCA_COMPILER_SOURCES
    src/analyzer.cpp
    src/artifact_generator.cpp
    src/canonical_value.cpp
    src/cli.cpp
    src/compiler_pipeline.cpp
    src/compiler_service.cpp
    src/configuration.cpp
    src/conformance_generator.cpp
    src/dependency_resolver.cpp
    src/diagnostics.cpp
    src/documentation_generator.cpp
    src/internal_model.cpp
    src/logging.cpp
    src/model_builder.cpp
    src/package_generator.cpp
    src/parser.cpp
    src/serialization.cpp
    src/source_loader.cpp
    src/validator.cpp
)

add_library(cca_compiler ${CCA_COMPILER_PUBLIC_HEADERS} ${CCA_COMPILER_SOURCES})
add_library(cca::compiler ALIAS cca_compiler)

target_compile_features(cca_compiler PUBLIC cxx_std_23)
target_link_libraries(
    cca_compiler
    PUBLIC "$<BUILD_INTERFACE:cca::version>"
    PRIVATE yaml-cpp::yaml-cpp
)
target_include_directories(
    cca_compiler
    PUBLIC
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
        $<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}>
)
set_target_properties(
    cca_compiler
    PROPERTIES
        CXX_EXTENSIONS OFF
        EXPORT_NAME compiler
        POSITION_INDEPENDENT_CODE ON
)

if(COMMAND cca_configure_target)
    cca_configure_target(cca_compiler)
endif()

add_executable(cca src/main.cpp)
target_compile_features(cca PRIVATE cxx_std_23)
target_link_libraries(cca PRIVATE cca::compiler)
set_target_properties(cca PROPERTIES CXX_EXTENSIONS OFF EXPORT_NAME cli)

if(COMMAND cca_configure_target)
    cca_configure_target(cca)
endif()

set(CCA_COMPILER_TEST_SOURCES
    tests/analyzer_test.cpp
    tests/artifact_generator_test.cpp
    tests/canonical_value_test.cpp
    tests/cli_test.cpp
    tests/compiler_pipeline_test.cpp
    tests/compiler_service_test.cpp
    tests/configuration_test.cpp
    tests/conformance_generator_test.cpp
    tests/dependency_resolver_test.cpp
    tests/diagnostics_test.cpp
    tests/documentation_generator_test.cpp
    tests/internal_model_test.cpp
    tests/logging_test.cpp
    tests/model_builder_test.cpp
    tests/package_generator_test.cpp
    tests/parser_test.cpp
    tests/serialization_test.cpp
    tests/source_loader_test.cpp
    tests/validator_test.cpp
)

if(BUILD_TESTING AND (NOT DEFINED CCA_BUILD_TESTS OR CCA_BUILD_TESTS))
    if(COMMAND cca_add_google_test)
        cca_add_google_test(
            TARGET cca_compiler_tests
            SOURCES ${CCA_COMPILER_TEST_SOURCES}
            LIBRARIES cca::compiler
            LABELS compiler unit
        )
    else()
        find_package(GTest CONFIG QUIET)
        if(TARGET GTest::gtest_main)
            include(GoogleTest)
            add_executable(cca_compiler_tests ${CCA_COMPILER_TEST_SOURCES})
            target_compile_features(cca_compiler_tests PRIVATE cxx_std_23)
            target_link_libraries(cca_compiler_tests PRIVATE cca::compiler GTest::gtest_main)
            set_target_properties(cca_compiler_tests PROPERTIES CXX_EXTENSIONS OFF)
            gtest_discover_tests(cca_compiler_tests PROPERTIES LABELS "compiler;unit")
        else()
            message(STATUS "GoogleTest was not found; cca-compiler tests are not built.")
        endif()
    endif()
endif()

install(
    TARGETS cca_compiler cca
    EXPORT ccaCompilerTargets
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
    ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR}
)
install(DIRECTORY include/ DESTINATION ${CMAKE_INSTALL_INCLUDEDIR})
if(CCA_COMPILER_OWNS_VERSION_TARGET)
    install(
        FILES "${CMAKE_CURRENT_BINARY_DIR}/generated/cca/version.hpp"
        DESTINATION "${CMAKE_INSTALL_INCLUDEDIR}/cca"
    )
endif()
install(
    EXPORT ccaCompilerTargets
    FILE ccaCompilerTargets.cmake
    NAMESPACE cca::
    DESTINATION ${CMAKE_INSTALL_LIBDIR}/cmake/ccaCompiler
)

configure_package_config_file(
    cmake/ccaCompilerConfig.cmake.in
    "${CMAKE_CURRENT_BINARY_DIR}/ccaCompilerConfig.cmake"
    INSTALL_DESTINATION ${CMAKE_INSTALL_LIBDIR}/cmake/ccaCompiler
)
write_basic_package_version_file(
    "${CMAKE_CURRENT_BINARY_DIR}/ccaCompilerConfigVersion.cmake"
    VERSION "${PROJECT_VERSION}"
    COMPATIBILITY SameMajorVersion
)
install(
    FILES
        "${CMAKE_CURRENT_BINARY_DIR}/ccaCompilerConfig.cmake"
        "${CMAKE_CURRENT_BINARY_DIR}/ccaCompilerConfigVersion.cmake"
    DESTINATION ${CMAKE_INSTALL_LIBDIR}/cmake/ccaCompiler
)

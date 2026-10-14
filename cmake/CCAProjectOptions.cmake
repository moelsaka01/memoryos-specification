include_guard(GLOBAL)

include(CCASanitizers)
include(CCAStaticAnalysis)
include(CCAWarnings)

option(CCA_WARNINGS_AS_ERRORS "Treat compiler warnings as errors" OFF)
option(CCA_ENABLE_CLANG_TIDY "Run clang-tidy while compiling C++ targets" OFF)
option(CCA_ENABLE_CPPCHECK "Run cppcheck while compiling C++ targets" OFF)
option(CCA_ENABLE_IPO "Enable interprocedural optimization where supported" OFF)
option(CCA_ENABLE_ADDRESS_SANITIZER "Enable AddressSanitizer" OFF)
option(CCA_ENABLE_UNDEFINED_SANITIZER "Enable UndefinedBehaviorSanitizer" OFF)
option(CCA_ENABLE_THREAD_SANITIZER "Enable ThreadSanitizer" OFF)
option(CCA_ENABLE_COVERAGE "Instrument targets and provide a gcovr report target" OFF)

function(cca_initialize_project_options)
  if(TARGET cca_project_options)
    return()
  endif()

  add_library(cca_project_options INTERFACE)
  add_library(cca::project_options ALIAS cca_project_options)
  target_compile_features(cca_project_options INTERFACE cxx_std_23)
  target_link_libraries(cca_project_options INTERFACE cca::version)

  cca_create_warnings_target()
  cca_create_sanitizers_target()

  add_library(cca_project_coverage INTERFACE)
  add_library(cca::project_coverage ALIAS cca_project_coverage)
  if(CCA_ENABLE_COVERAGE)
    if(MSVC)
      message(FATAL_ERROR "CCA_ENABLE_COVERAGE is supported with GCC or Clang, not MSVC")
    elseif(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
      target_compile_options(cca_project_coverage INTERFACE -O0 -g --coverage)
      target_link_options(cca_project_coverage INTERFACE --coverage)
    else()
      message(FATAL_ERROR "CCA_ENABLE_COVERAGE is unsupported by ${CMAKE_CXX_COMPILER_ID}")
    endif()
  endif()
endfunction()

function(cca_configure_target target_name)
  if(NOT TARGET "${target_name}")
    message(FATAL_ERROR "cca_configure_target: '${target_name}' is not a CMake target")
  endif()

  get_target_property(already_configured "${target_name}" CCA_TARGET_CONFIGURED)
  if(already_configured)
    return()
  endif()

  get_target_property(target_type "${target_name}" TYPE)
  if(target_type STREQUAL "INTERFACE_LIBRARY")
    target_link_libraries(
      "${target_name}"
      INTERFACE
        "$<BUILD_INTERFACE:cca::project_options>"
        "$<BUILD_INTERFACE:cca::project_warnings>"
        "$<BUILD_INTERFACE:cca::project_sanitizers>"
        "$<BUILD_INTERFACE:cca::project_coverage>"
    )
  else()
    target_link_libraries(
      "${target_name}"
      PRIVATE
        "$<BUILD_INTERFACE:cca::project_options>"
        "$<BUILD_INTERFACE:cca::project_warnings>"
        "$<BUILD_INTERFACE:cca::project_sanitizers>"
        "$<BUILD_INTERFACE:cca::project_coverage>"
    )
    set_target_properties("${target_name}" PROPERTIES CXX_EXTENSIONS OFF)
    cca_enable_static_analysis("${target_name}")

    if(CCA_ENABLE_IPO)
      include(CheckIPOSupported)
      check_ipo_supported(RESULT ipo_supported OUTPUT ipo_error LANGUAGES CXX)
      if(NOT ipo_supported)
        message(FATAL_ERROR "Interprocedural optimization is unavailable: ${ipo_error}")
      endif()
      set_property(TARGET "${target_name}" PROPERTY INTERPROCEDURAL_OPTIMIZATION TRUE)
    endif()
  endif()

  set_property(TARGET "${target_name}" PROPERTY CCA_TARGET_CONFIGURED TRUE)
endfunction()

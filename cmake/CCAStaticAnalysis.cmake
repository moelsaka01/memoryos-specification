include_guard(GLOBAL)

set(
  CCA_CLANG_TIDY_EXECUTABLE
  ""
  CACHE FILEPATH
  "Explicit path to clang-tidy (auto-detected when empty)"
)
set(
  CCA_CPPCHECK_EXECUTABLE
  ""
  CACHE FILEPATH
  "Explicit path to cppcheck (auto-detected when empty)"
)

function(cca_enable_static_analysis target_name)
  if(CCA_ENABLE_CLANG_TIDY)
    if(CCA_CLANG_TIDY_EXECUTABLE)
      set(clang_tidy_executable "${CCA_CLANG_TIDY_EXECUTABLE}")
    else()
      find_program(clang_tidy_executable NAMES clang-tidy REQUIRED)
    endif()
    set_property(
      TARGET "${target_name}"
      PROPERTY CXX_CLANG_TIDY
        "${clang_tidy_executable};--config-file=${CMAKE_SOURCE_DIR}/.clang-tidy"
    )
  endif()

  if(CCA_ENABLE_CPPCHECK)
    if(CCA_CPPCHECK_EXECUTABLE)
      set(cppcheck_executable "${CCA_CPPCHECK_EXECUTABLE}")
    else()
      find_program(cppcheck_executable NAMES cppcheck REQUIRED)
    endif()
    set_property(
      TARGET "${target_name}"
      PROPERTY CXX_CPPCHECK
        "${cppcheck_executable};--enable=warning,performance,portability;--inline-suppr;--suppress=missingIncludeSystem"
    )
  endif()
endfunction()

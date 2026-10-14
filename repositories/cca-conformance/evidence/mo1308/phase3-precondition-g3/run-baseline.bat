@echo off
set NB=C:\Users\melsa\Documents\Codex\cca-workspace\.cache\mo1305-phase3br\toolchain\node-v24.21.0-win-x64
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" > nul 2>&1
set PATH=%NB%;C:\Python314;C:\Python314\Scripts;C:\Program Files\CMake\bin;C:\Users\melsa\AppData\Local\Microsoft\WinGet\Links;%PATH%
cd /d C:\Users\melsa\Documents\Codex\g3b
echo start %date% %time% > C:\Users\melsa\Documents\Codex\g3-logs\baseline-times.txt
ctest --preset default -E "^(cca_core_tests_NOT_BUILT|cca_process_allocation_tests_NOT_BUILT|cca_episodic_memory_allocation_tests_NOT_BUILT|cca_memory_allocation_tests_NOT_BUILT|cca_working_memory_allocation_tests_NOT_BUILT|cca_long_term_memory_allocation_tests_NOT_BUILT|cca_semantic_memory_allocation_tests_NOT_BUILT|cca_procedural_memory_allocation_tests_NOT_BUILT|cca_knowledge_retrieval_allocation_tests_NOT_BUILT|cca_memory_consolidation_allocation_tests_NOT_BUILT|cca_memory_reflection_allocation_tests_NOT_BUILT|cca_memory_provider_allocation_tests_NOT_BUILT|cca_compiler_tests_NOT_BUILT|cca_memory_studio_tests_NOT_BUILT|cca_memory_studio_allocation_tests_NOT_BUILT|memoryos_sdk_cpp_tests_NOT_BUILT|cca\.persistence\.example|cca\.process\.example\.direct|cca\.process\.example\.runtime|cca\.memory\.example|cca\.long_term_memory\.example|cca\.memory_provider\.example|cca\.semantic_memory\.example|cca\.working_memory\.example|memoryos\.sdk\.cpp\.example|memoryos\.sdk\.cpp\.regression\.example|memoryos\.sdk\.cpp\.investigate\.example)$" --timeout 3600 > C:\Users\melsa\Documents\Codex\g3-logs\baseline-ctest-run.log 2>&1
echo exit=%errorlevel% >> C:\Users\melsa\Documents\Codex\g3-logs\baseline-times.txt
echo end %date% %time% >> C:\Users\melsa\Documents\Codex\g3-logs\baseline-times.txt
git status --porcelain > C:\Users\melsa\Documents\Codex\g3-logs\baseline-porcelain-after.txt

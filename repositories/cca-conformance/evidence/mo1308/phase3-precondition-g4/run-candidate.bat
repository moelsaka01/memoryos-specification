@echo off
set NB=C:\Users\melsa\Documents\Codex\cca-workspace\.cache\mo1305-phase3br\toolchain\node-v24.21.0-win-x64
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" > nul 2>&1
set PATH=%NB%;C:\Python314;C:\Python314\Scripts;C:\Program Files\CMake\bin;C:\Users\melsa\AppData\Local\Microsoft\WinGet\Links;%PATH%
cd /d C:\g4c
echo start %date% %time% > C:\g4-logs\candidate-times.txt
ctest --preset default -E "^(cca_core_tests_NOT_BUILT|cca_memory_allocation_tests_NOT_BUILT|cca_long_term_memory_allocation_tests_NOT_BUILT|cca_procedural_memory_allocation_tests_NOT_BUILT|cca\.procedural_memory\.example)$" --timeout 3600 > C:\g4-logs\candidate-ctest-run.log 2>&1
echo exit=%errorlevel% >> C:\g4-logs\candidate-times.txt
echo end %date% %time% >> C:\g4-logs\candidate-times.txt
git status --porcelain > C:\g4-logs\candidate-porcelain-after.txt

@echo off
set NB=C:\Users\melsa\Documents\Codex\cca-workspace\.cache\mo1305-phase3br\toolchain\node-v24.21.0-win-x64
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" > nul 2>&1
set PATH=%NB%;C:\Python314;C:\Python314\Scripts;C:\Program Files\CMake\bin;C:\Users\melsa\AppData\Local\Microsoft\WinGet\Links;%PATH%
cd /d C:\g5b
echo start %date% %time% > C:\g5-logs\baseline-times.txt
ctest --preset default -E "^(cca_core_tests_NOT_BUILT|cca_memory_studio_allocation_tests_NOT_BUILT|memoryos_sdk_cpp_tests_NOT_BUILT|cca\.memory_reflection\.example)$" --timeout 3600 > C:\g5-logs\baseline-ctest-run.log 2>&1
echo exit=%errorlevel% >> C:\g5-logs\baseline-times.txt
echo end %date% %time% >> C:\g5-logs\baseline-times.txt
git status --porcelain > C:\g5-logs\baseline-porcelain-after.txt

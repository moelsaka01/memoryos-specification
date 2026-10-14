@echo off
set NB=C:\Users\melsa\Documents\Codex\cca-workspace\.cache\mo1305-phase3br\toolchain\node-v24.21.0-win-x64
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" > nul 2>&1
set PATH=%NB%;C:\Python314;C:\Python314\Scripts;C:\Program Files\CMake\bin;C:\Users\melsa\AppData\Local\Microsoft\WinGet\Links;%PATH%
for %%T in (g5b g5c) do (
  cd /d C:\%%T
  ctest --preset default -N > C:\g5-logs\setup\ctest-N-final-%%T.log 2>&1
  ctest --preset default --show-only=json-v1 > C:\g5-logs\setup\ctest-tests-%%T.json 2> C:\g5-logs\setup\ctest-tests-%%T.err
)

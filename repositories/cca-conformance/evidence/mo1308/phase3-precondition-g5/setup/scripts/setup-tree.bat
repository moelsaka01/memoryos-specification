@echo off
rem usage: setup-tree.bat <tree-dir> <log-dir>   (npm ci first, so configure sees node_modules)
set T=%~1
set L=%~2
set NB=C:\Users\melsa\Documents\Codex\cca-workspace\.cache\mo1305-phase3br\toolchain\node-v24.21.0-win-x64
if not exist "%L%" mkdir "%L%"
echo start %date% %time% > "%L%\setup-done.txt"
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" > "%L%\vcvars.log" 2>&1
set PATH=%NB%;C:\Python314;C:\Python314\Scripts;C:\Program Files\CMake\bin;C:\Users\melsa\AppData\Local\Microsoft\WinGet\Links;%PATH%
cd /d "%T%"
call "%NB%\npm.cmd" --version > "%L%\npm-version.txt" 2>&1
echo npm ci > "%L%\npm-ci.log"
for %%D in (cca-studio memoryos-ci memoryos-mcp memoryos-rest memoryos-vscode) do (
  echo === %%D >> "%L%\npm-ci.log"
  pushd "%T%\repositories\%%D"
  call "%NB%\npm.cmd" ci --ignore-scripts >> "%L%\npm-ci.log" 2>&1
  popd
)
cd /d "%T%"
cmake --preset default -DMEMORYOS_VSCODE_NPM_EXECUTABLE=%NB%\npm.cmd > "%L%\configure.log" 2>&1
echo configure=%errorlevel% >> "%L%\setup-done.txt"
cmake --build --preset default -- -k 0 > "%L%\build.log" 2>&1
echo build=%errorlevel% >> "%L%\setup-done.txt"
echo end %date% %time% >> "%L%\setup-done.txt"
echo FINISHED >> "%L%\setup-done.txt"

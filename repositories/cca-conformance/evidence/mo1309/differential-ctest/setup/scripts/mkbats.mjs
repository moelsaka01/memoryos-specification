import fs from 'node:fs';
const cmd = fs.readFileSync('C:/g7-logs/ctest-command.txt', 'utf8').trim();
for (const [w, t] of [['baseline', 'g7b'], ['candidate', 'g7c']]) {
  const L = String.raw`@echo off
set NB=C:\Users\melsa\Documents\Codex\cca-workspace\.cache\mo1305-phase3br\toolchain\node-v24.21.0-win-x64
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" > nul 2>&1
set PATH=%NB%;C:\Python314;C:\Python314\Scripts;C:\Program Files\CMake\bin;C:\Users\melsa\AppData\Local\Microsoft\WinGet\Links;%PATH%
cd /d C:\@T@
echo start %date% %time% > C:\g7-logs\@W@-times.txt
@CMD@ > C:\g7-logs\@W@-ctest-run.log 2>&1
echo exit=%errorlevel% >> C:\g7-logs\@W@-times.txt
echo end %date% %time% >> C:\g7-logs\@W@-times.txt
git status --porcelain > C:\g7-logs\@W@-porcelain-after.txt
`.replaceAll('@T@', t).replaceAll('@W@', w).replace('@CMD@', () => cmd);
  fs.writeFileSync(`C:/g7-logs/run-${w}.bat`, L.replace(/\n/g, '\r\n'));
}
fs.writeFileSync('C:/g7-logs/run-both.bat', String.raw`@echo off
call C:\g7-logs\run-baseline.bat
call C:\g7-logs\run-candidate.bat
echo ALLDONE > C:\g7-logs\runs.flag
`.replace(/\n/g, '\r\n'));

@echo off
call C:\g4-logs\run-baseline.bat
call C:\g4-logs\run-candidate.bat
echo ALLDONE > C:\g4-logs\runs.flag

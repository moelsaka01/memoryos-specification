@echo off
call C:\g5-logs\run-baseline.bat
call C:\g5-logs\run-candidate.bat
echo ALLDONE > C:\g5-logs\runs.flag

@echo off
call C:\g6-logs\run-baseline.bat
call C:\g6-logs\run-candidate.bat
echo ALLDONE > C:\g6-logs\runs.flag

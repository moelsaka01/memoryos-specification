@echo off
call C:\g7-logs\run-baseline.bat
call C:\g7-logs\run-candidate.bat
echo ALLDONE > C:\g7-logs\runs.flag

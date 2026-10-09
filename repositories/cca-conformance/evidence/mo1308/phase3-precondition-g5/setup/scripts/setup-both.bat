@echo off
call "%~dp0setup-tree.bat" C:\g5b C:\g5-logs\setup\baseline-BF-g5b
call "%~dp0setup-tree.bat" C:\g5c C:\g5-logs\setup\candidate-g5c
echo ALLDONE > "%~dp0setup.flag"

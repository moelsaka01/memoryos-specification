@echo off
call "%~dp0setup-tree.bat" C:\g6b C:\g6-logs\setup\baseline-BF-g6b
call "%~dp0setup-tree.bat" C:\g6c C:\g6-logs\setup\candidate-g6c
echo ALLDONE > "%~dp0setup.flag"

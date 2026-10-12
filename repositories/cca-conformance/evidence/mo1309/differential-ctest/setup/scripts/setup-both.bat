@echo off
call "%~dp0setup-tree.bat" C:\g7b C:\g7-logs\setup\baseline-BF-g7b
call "%~dp0setup-tree.bat" C:\g7c C:\g7-logs\setup\candidate-g7c
echo ALLDONE > "%~dp0setup.flag"

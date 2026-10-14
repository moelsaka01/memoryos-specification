@echo off
call "%~dp0setup-tree.bat" C:\g4b C:\g4-logs\setup\baseline-BF-g4b
call "%~dp0setup-tree.bat" C:\g4c C:\g4-logs\setup\candidate-g4c
echo ALLDONE > "%~dp0setup.flag"

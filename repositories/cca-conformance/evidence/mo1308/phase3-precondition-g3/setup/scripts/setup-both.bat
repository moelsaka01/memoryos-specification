@echo off
call "%~dp0setup-tree.bat" C:\Users\melsa\Documents\Codex\g3b C:\Users\melsa\Documents\Codex\g3-logs\setup\baseline-BF-g3b
call "%~dp0setup-tree.bat" C:\Users\melsa\Documents\Codex\g3c C:\Users\melsa\Documents\Codex\g3-logs\setup\candidate-g3c
echo ALLDONE > "%~dp0setup.flag"

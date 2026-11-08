@echo off
chcp 65001 >nul
cd /d "%~dp0"

set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8

where python >nul 2>nul
if errorlevel 1 goto nopython

python "launcher.py"
goto end

:nopython
echo [ERROR] Python not found.
echo.
echo Please install Python 3.8 or newer from:
echo     https://www.python.org/downloads/
echo Remember to check "Add Python to PATH" during installation.
echo.

:end
echo.
pause

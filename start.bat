@echo off
rem Double-click to set up and start CareBridge. Extra options are passed through, e.g.:
rem   start.bat -SetupData
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
if errorlevel 1 pause

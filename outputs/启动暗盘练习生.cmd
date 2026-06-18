@echo off
setlocal
cd /d "%~dp0.."
where node.exe >nul 2>nul
if errorlevel 1 goto nonode
start "IPO Trainer Server" /min npm.cmd run dev -- --port 4173
powershell.exe -NoProfile -Command "Start-Sleep -Seconds 3"
start "" "http://127.0.0.1:4173"
exit /b 0

:nonode
echo Node.js was not found. Please install Node.js first.
pause
exit /b 1

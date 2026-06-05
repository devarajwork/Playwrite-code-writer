@echo off
cd /d "%~dp0"
echo Starting Playwright Test Builder...
echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:3001
echo.
call npm run dev

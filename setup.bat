@echo off
cd /d "%~dp0"
echo Installing dependencies...
call npm install
echo.
echo Installing Playwright browsers...
call npx playwright install chromium
echo.
echo Setup complete! Run 'npm run dev' to start.
pause

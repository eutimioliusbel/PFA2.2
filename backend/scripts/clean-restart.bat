@echo off
echo.
echo ========================================
echo  PFA Vanguard - Clean Backend Restart
echo ========================================
echo.

echo [1/4] Killing all Node.js processes...
taskkill /F /IM node.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/4] Cleaning node_modules cache...
cd /d "%~dp0"
if exist "node_modules\.cache" rmdir /s /q "node_modules\.cache"

echo [3/4] Regenerating Prisma client...
call npx prisma generate

echo [4/4] Starting backend server...
call npm run dev

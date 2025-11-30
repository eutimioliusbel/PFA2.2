@echo off
echo Killing all Node.js processes...
taskkill /F /IM node.exe /T >nul 2>&1

echo Waiting 2 seconds...
timeout /t 2 /nobreak >nul

echo Starting backend server...
cd backend
call npm run dev

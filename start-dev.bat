@echo off
cd /d %~dp0
echo [INFO] Preparing dev server on http://127.0.0.1:5173 ...

if not exist node_modules (
  echo [INFO] node_modules not found, installing dependencies...
  call npm install
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
  taskkill /PID %%a /F >nul 2>nul
)

echo [INFO] Starting Vite dev server (window will stay open)...
cmd /k "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"

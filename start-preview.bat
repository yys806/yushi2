@echo off
cd /d %~dp0
echo [INFO] Preparing preview server on http://127.0.0.1:4173 ...

if not exist node_modules (
  echo [INFO] node_modules not found, installing dependencies...
  call npm install
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4173 ^| findstr LISTENING') do (
  taskkill /PID %%a /F >nul 2>nul
)

echo [INFO] Building project then starting preview (window will stay open)...
cmd /k "npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort"

@echo off
rem Production build check: builds into dist\ and serves it like GitHub Pages will.
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  call npm install || goto :fail
)

rem A running dev server shares .astro\data-store.json with the build and is left
rem serving 500/404 until restarted, so stop it first (same match as dev.bat).
set "PROJECT_ROOT=%~dp0"
powershell -NoProfile -Command "$p = @(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like ('*' + $env:PROJECT_ROOT + 'node_modules*astro*dev*') }); $p | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; exit [int]($p.Count -gt 0)"
if errorlevel 1 (
  echo Stopped the running dev server: a build breaks it. Run dev.bat again afterwards.
  echo.
)
call npx astro dev stop >nul 2>&1

call npx astro build || goto :fail

echo.
echo Static preview: http://127.0.0.1:4330/   - no admin here.
echo Admin (Keystatic) runs only in dev.bat:  http://127.0.0.1:4321/keystatic
echo.
rem Own port, so a forgotten preview window never blocks dev.bat.
start "" http://127.0.0.1:4330/
call npx astro preview --host 127.0.0.1 --port 4330
goto :eof

:fail
echo.
echo Build failed. Read the errors above.
pause

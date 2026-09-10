@echo off
rem Local site + content editor (Keystatic) from one dev server.
rem Site: http://127.0.0.1:4321/  Editor: http://127.0.0.1:4321/keystatic
rem Edits are written straight into src/content. Closing this window stops it.
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  call npm install || goto :fail
)

rem Two dev servers share .astro\data-store.json and break each other's writes
rem (UnknownFilesystemError). `astro dev stop` only knows the last one started,
rem so stop every dev server of this project, including forgotten windows.
set "PROJECT_ROOT=%~dp0"
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like ('*' + $env:PROJECT_ROOT + 'node_modules*astro*dev*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
call npx astro dev stop >nul 2>&1

set KEYSTATIC=1
start "" http://127.0.0.1:4321/
start "" http://127.0.0.1:4321/keystatic
call npx astro dev --host 127.0.0.1 --port 4321
goto :eof

:fail
echo.
echo npm install failed.
pause

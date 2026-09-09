@echo off
rem Content editor (Keystatic) + live preview of the site.
rem Edits are written straight into src/content. Closing this window stops it.
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  call npm install || goto :fail
)

set KEYSTATIC=1
rem A stale background server would make this script exit at once.
call npx astro dev stop >nul 2>&1

start "" http://127.0.0.1:4321/keystatic
call npx astro dev --host 127.0.0.1 --port 4321
goto :eof

:fail
echo.
echo npm install failed.
pause

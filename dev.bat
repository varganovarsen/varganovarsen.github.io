@echo off
rem Local preview of the site. Closing this window stops the server.
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  call npm install || goto :fail
)

rem A stale background server would make this script exit at once.
call npx astro dev stop >nul 2>&1

start "" http://127.0.0.1:4321/
call npx astro dev --host 127.0.0.1 --port 4321
goto :eof

:fail
echo.
echo npm install failed.
pause

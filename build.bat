@echo off
rem Production build check: builds into dist\ and serves it like GitHub Pages will.
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  call npm install || goto :fail
)

call npx astro build || goto :fail
start "" http://127.0.0.1:4321/
call npx astro preview --host 127.0.0.1 --port 4321
goto :eof

:fail
echo.
echo Build failed. Read the errors above.
pause

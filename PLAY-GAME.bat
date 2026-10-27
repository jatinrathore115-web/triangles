@echo off
REM Double-click to play: starts the local game server and opens the browser.
cd /d "%~dp0"
if not exist node_modules call npm install
call npm start

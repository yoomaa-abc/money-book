@echo off
title Dalsseum Local Test
cd /d "%~dp0"
set "DALSSEUM_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%DALSSEUM_NODE%" (
 "%DALSSEUM_NODE%" "%~dp0server.cjs"
) else (
 node "%~dp0server.cjs"
)
pause

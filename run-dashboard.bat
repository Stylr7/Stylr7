@echo off
set PORT=%1
if "%PORT%"=="" set PORT=8080
echo Starting local dashboard on http://localhost:%PORT%
python -m http.server %PORT%

@echo off
title Space Roc Simulator - 1-Click EXE Builder
echo ========================================================
echo         SPACE ROC SIMULATOR - 1-CLICK EXE BUILDER
echo ========================================================
echo.
echo Building Vite bundle and packing Windows Executable (.exe)...
echo Please wait, this takes a few seconds...
echo.

call npm run build:exe

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Build failed! Check the output above.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================================
echo SUCCESS! Standalone executable generated in 'release' folder:
echo - release\Space Roc Simulator 1.0.0.exe
echo ========================================================
echo.
echo Opening release folder...
explorer release

pause

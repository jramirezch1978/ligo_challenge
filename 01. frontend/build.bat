@echo off
setlocal

rem =============================================================================
rem  Wallet Transaction Service - Frontend (React + TypeScript + Vite)
rem  build.bat: instala dependencias y compila el proyecto -> dist/
rem =============================================================================

cd /d "%~dp0"

echo [1/2] Instalando dependencias (npm install) ...
call npm install
if errorlevel 1 (
  echo [ERROR] Fallo "npm install".
  exit /b 1
)

echo [2/2] Compilando frontend (tsc + vite build) ...
call npm run build
if errorlevel 1 (
  echo [ERROR] Fallo la compilacion del frontend.
  exit /b 1
)

echo.
echo Build del frontend completado en ".\dist"
echo Ejecuta deploy.bat para construir la imagen Docker y levantar el contenedor.

endlocal

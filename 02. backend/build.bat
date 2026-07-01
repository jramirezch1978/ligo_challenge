@echo off
setlocal

rem =============================================================================
rem  Wallet Transaction Service - Backend (NestJS + TypeScript)
rem  build.bat: instala dependencias y compila TypeScript -> dist/
rem =============================================================================

cd /d "%~dp0"

echo [1/2] Instalando dependencias (npm install) ...
call npm install
if errorlevel 1 (
  echo [ERROR] Fallo "npm install".
  exit /b 1
)

echo [2/2] Compilando backend (nest build) ...
call npm run build
if errorlevel 1 (
  echo [ERROR] Fallo la compilacion del backend.
  exit /b 1
)

echo.
echo Build del backend completado en ".\dist"
echo Ejecuta deploy.bat para construir la imagen Docker y levantar el contenedor.

endlocal

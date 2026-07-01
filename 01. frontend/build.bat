@echo off
setlocal

rem =============================================================================
rem  Wallet Transaction Service - Frontend (React + TypeScript + Vite)
rem  build.bat: compila DENTRO de Docker (build multi-stage del Dockerfile:
rem  npm ci + tsc + vite build en la etapa "builder") y produce la imagen local
rem  "ligo-wallet-frontend:latest" (nginx sirviendo los estaticos) lista para
rem  desplegar.
rem
rem  La compilacion NO depende del Node/npm instalados en el host. La imagen
rem  final de produccion NO contiene codigo fuente (solo los estaticos
rem  compilados en dist/); unicamente build.bat construye imagenes, deploy.bat
rem  solo las despliega.
rem =============================================================================

set IMAGE_NAME=ligo-wallet-frontend:latest

cd /d "%~dp0"

echo Compilando frontend dentro de Docker (imagen %IMAGE_NAME%) ...
docker build -t %IMAGE_NAME% .
if errorlevel 1 (
  echo [ERROR] Fallo la compilacion del frontend dentro de Docker.
  exit /b 1
)

echo.
echo Build del frontend completado. Imagen lista: %IMAGE_NAME%
echo Ejecuta deploy.bat para desplegar el contenedor (no vuelve a compilar).

endlocal

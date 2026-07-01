@echo off
setlocal

rem =============================================================================
rem  Wallet Transaction Service - Backend (NestJS + TypeScript)
rem  build.bat: compila DENTRO de Docker (build multi-stage del Dockerfile:
rem  npm ci + nest build en la etapa "builder") y produce la imagen local
rem  "ligo-wallet-backend:latest" lista para desplegar.
rem
rem  La compilacion NO depende del Node/npm instalados en el host: se hace
rem  siempre con la misma imagen base (node:20-alpine) definida en el
rem  Dockerfile, evitando diferencias entre el entorno local y el de despliegue.
rem  La imagen final de produccion NO contiene codigo fuente (solo el
rem  artefacto compilado en dist/), unicamente build.bat construye imagenes;
rem  deploy.bat solo las despliega.
rem =============================================================================

set IMAGE_NAME=ligo-wallet-backend:latest

cd /d "%~dp0"

echo Compilando backend dentro de Docker (imagen %IMAGE_NAME%) ...
docker build -t %IMAGE_NAME% .
if errorlevel 1 (
  echo [ERROR] Fallo la compilacion del backend dentro de Docker.
  exit /b 1
)

echo.
echo Build del backend completado. Imagen lista: %IMAGE_NAME%
echo Ejecuta deploy.bat para desplegar el contenedor (no vuelve a compilar).

endlocal

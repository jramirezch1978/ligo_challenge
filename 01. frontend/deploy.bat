@echo off
setlocal

rem =============================================================================
rem  Wallet Transaction Service - Frontend (React + TypeScript + Vite + nginx)
rem  deploy.bat: SOLO despliega. No compila ni construye la imagen a partir del
rem  codigo fuente (eso lo hace build.bat, dentro de Docker); si la imagen
rem  "ligo-wallet-frontend:latest" no existe todavia, la construye una unica
rem  vez llamando a build.bat antes de desplegar.
rem
rem  Requisito: el contenedor "ligo-wallet-backend" debe estar corriendo
rem  (ejecutar antes 03. database\deploy.bat y 02. backend\deploy.bat).
rem =============================================================================

set NETWORK_NAME=ligo-network
set CONTAINER_NAME=ligo-wallet-frontend
set IMAGE_NAME=ligo-wallet-frontend:latest
set HOST_PORT=8080

cd /d "%~dp0"

echo [1/4] Verificando imagen local %IMAGE_NAME% ...
docker image inspect %IMAGE_NAME% >nul 2>&1
if errorlevel 1 (
  echo Imagen no encontrada, compilandola primero (build.bat) ...
  call build.bat
  if errorlevel 1 exit /b 1
)

echo [2/4] Verificando red Docker "%NETWORK_NAME%" ...
docker network inspect %NETWORK_NAME% >nul 2>&1
if errorlevel 1 (
  docker network create %NETWORK_NAME%
)

echo [3/4] Eliminando contenedor previo (si existe) ...
docker rm -f %CONTAINER_NAME% >nul 2>&1

echo [4/4] Creando contenedor %CONTAINER_NAME% ...
docker run -d ^
  --name %CONTAINER_NAME% ^
  --network %NETWORK_NAME% ^
  -p %HOST_PORT%:80 ^
  --restart unless-stopped ^
  %IMAGE_NAME%

if errorlevel 1 (
  echo [ERROR] No se pudo crear el contenedor del frontend.
  exit /b 1
)

echo.
echo Frontend disponible en http://localhost:%HOST_PORT%

endlocal

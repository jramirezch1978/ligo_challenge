@echo off
setlocal

rem =============================================================================
rem  Wallet Transaction Service - Backend (NestJS + TypeScript)
rem  deploy.bat: SOLO despliega. No compila ni construye la imagen a partir del
rem  codigo fuente (eso lo hace build.bat, dentro de Docker); si la imagen
rem  "ligo-wallet-backend:latest" no existe todavia, la construye una unica vez
rem  llamando a build.bat antes de desplegar.
rem
rem  Requisito: el contenedor "ligo-wallet-postgres" debe estar corriendo
rem  (ejecutar primero 03. database\deploy.bat).
rem =============================================================================

set NETWORK_NAME=ligo-network
set CONTAINER_NAME=ligo-wallet-backend
set IMAGE_NAME=ligo-wallet-backend:latest
set HOST_PORT=3000

set DATABASE_HOST=ligo-wallet-postgres
set DATABASE_PORT=5432
set DATABASE_USER=ligo
set DATABASE_PASSWORD=ligo_password
set DATABASE_NAME=wallet_service

set JWT_SECRET=change-this-super-secret-key-in-production
set JWT_EXPIRES_IN=3600
set AUTH_MOCK_USERNAME=senior.backend
set AUTH_MOCK_PASSWORD=Password123

cd /d "%~dp0"

echo [1/5] Verificando imagen local %IMAGE_NAME% ...
docker image inspect %IMAGE_NAME% >nul 2>&1
if errorlevel 1 (
  echo Imagen no encontrada, compilandola primero (build.bat) ...
  call build.bat
  if errorlevel 1 exit /b 1
)

echo [2/5] Verificando red Docker "%NETWORK_NAME%" ...
docker network inspect %NETWORK_NAME% >nul 2>&1
if errorlevel 1 (
  docker network create %NETWORK_NAME%
)

echo [3/5] Eliminando contenedor previo (si existe) ...
docker rm -f %CONTAINER_NAME% >nul 2>&1

echo [4/5] Creando contenedor %CONTAINER_NAME% ...
docker run -d ^
  --name %CONTAINER_NAME% ^
  --network %NETWORK_NAME% ^
  -e NODE_ENV=production ^
  -e PORT=3000 ^
  -e API_PREFIX=api ^
  -e CORS_ORIGIN=* ^
  -e DATABASE_HOST=%DATABASE_HOST% ^
  -e DATABASE_PORT=%DATABASE_PORT% ^
  -e DATABASE_USER=%DATABASE_USER% ^
  -e DATABASE_PASSWORD=%DATABASE_PASSWORD% ^
  -e DATABASE_NAME=%DATABASE_NAME% ^
  -e DATABASE_SSL=false ^
  -e JWT_SECRET=%JWT_SECRET% ^
  -e JWT_EXPIRES_IN=%JWT_EXPIRES_IN% ^
  -e AUTH_MOCK_USERNAME=%AUTH_MOCK_USERNAME% ^
  -e AUTH_MOCK_PASSWORD=%AUTH_MOCK_PASSWORD% ^
  -p %HOST_PORT%:3000 ^
  --restart unless-stopped ^
  %IMAGE_NAME%

if errorlevel 1 (
  echo [ERROR] No se pudo crear el contenedor del backend.
  exit /b 1
)

echo [5/5] Backend desplegado.
echo.
echo   API:    http://localhost:%HOST_PORT%/api
echo   Docs:   http://localhost:%HOST_PORT%/docs
echo   Health: http://localhost:%HOST_PORT%/health
echo.
echo Ver logs: docker logs -f %CONTAINER_NAME%

endlocal

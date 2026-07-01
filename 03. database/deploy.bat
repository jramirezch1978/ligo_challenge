@echo off
setlocal enabledelayedexpansion

rem =============================================================================
rem  Wallet Transaction Service - Base de datos (PostgreSQL 17)
rem  deploy.bat: script IDEMPOTENTE. En cada ejecucion elimina el contenedor y
rem  el volumen de datos existentes, y levanta uno nuevo desde la imagen local
rem  "ligo-wallet-postgres:17" (construida por build.bat), que ya trae el
rem  esquema y el seed horneados en /docker-entrypoint-initdb.d. El resultado
rem  es siempre el mismo: base de datos limpia con la data inicial cargada.
rem =============================================================================

set POSTGRES_USER=ligo
set POSTGRES_PASSWORD=ligo_password
set POSTGRES_DB=wallet_service
set HOST_PORT=5434
set NETWORK_NAME=ligo-network
set CONTAINER_NAME=ligo-wallet-postgres
set VOLUME_NAME=ligo-wallet-pgdata
set IMAGE_NAME=ligo-wallet-postgres:17

cd /d "%~dp0"

echo [1/6] Verificando imagen local %IMAGE_NAME% ...
docker image inspect %IMAGE_NAME% >nul 2>&1
if errorlevel 1 (
  echo Imagen no encontrada, construyendola primero...
  call build.bat
  if errorlevel 1 exit /b 1
)

echo [2/6] Verificando red Docker "%NETWORK_NAME%" ...
docker network inspect %NETWORK_NAME% >nul 2>&1
if errorlevel 1 (
  docker network create %NETWORK_NAME%
)

echo [3/6] Eliminando contenedor y volumen previos (idempotencia: siempre desde cero) ...
docker rm -f %CONTAINER_NAME% >nul 2>&1
docker volume rm %VOLUME_NAME% >nul 2>&1

echo [4/6] Creando contenedor %CONTAINER_NAME% (%IMAGE_NAME%) ...
docker run -d ^
  --name %CONTAINER_NAME% ^
  --network %NETWORK_NAME% ^
  -e POSTGRES_USER=%POSTGRES_USER% ^
  -e POSTGRES_PASSWORD=%POSTGRES_PASSWORD% ^
  -e POSTGRES_DB=%POSTGRES_DB% ^
  -p %HOST_PORT%:5432 ^
  -v %VOLUME_NAME%:/var/lib/postgresql/data ^
  --restart unless-stopped ^
  %IMAGE_NAME%

if errorlevel 1 (
  echo [ERROR] No se pudo crear el contenedor de PostgreSQL.
  exit /b 1
)

echo [5/6] Esperando a que PostgreSQL este listo y cargue el esquema + seed ...
set /a RETRIES=30
:wait_loop
docker exec %CONTAINER_NAME% pg_isready -U %POSTGRES_USER% -d %POSTGRES_DB% >nul 2>&1
if not errorlevel 1 goto ready
set /a RETRIES-=1
if %RETRIES% leq 0 (
  echo [ERROR] Tiempo de espera agotado esperando a PostgreSQL.
  exit /b 1
)
timeout /t 2 >nul
goto wait_loop

:ready
echo [6/6] PostgreSQL 17 listo, con esquema y datos semilla recien cargados.
echo.
echo   Host (desde tu maquina): localhost:%HOST_PORT%
echo   Host (desde otros contenedores en "%NETWORK_NAME%"): %CONTAINER_NAME%:5432
echo   Base de datos: %POSTGRES_DB%   Usuario: %POSTGRES_USER%
echo.
echo Contenedor: %CONTAINER_NAME%

endlocal

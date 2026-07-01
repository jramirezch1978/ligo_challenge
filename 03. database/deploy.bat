@echo off
setlocal enabledelayedexpansion

rem =============================================================================
rem  Wallet Transaction Service - Base de datos (PostgreSQL 17)
rem  deploy.bat: levanta un contenedor Docker de PostgreSQL 17 con el esquema
rem  y los datos semilla ya aplicados (via docker-entrypoint-initdb.d).
rem
rem  Uso:
rem    deploy.bat            -> crea/recrea el contenedor conservando el volumen
rem    deploy.bat --reset    -> ademas elimina el volumen (recrea la BD desde cero)
rem =============================================================================

set POSTGRES_USER=ligo
set POSTGRES_PASSWORD=ligo_password
set POSTGRES_DB=wallet_service
set HOST_PORT=5434
set NETWORK_NAME=ligo-network
set CONTAINER_NAME=ligo-wallet-postgres
set VOLUME_NAME=ligo-wallet-pgdata
set IMAGE_NAME=postgres:17

echo [1/5] Verificando red Docker "%NETWORK_NAME%" ...
docker network inspect %NETWORK_NAME% >nul 2>&1
if errorlevel 1 (
  docker network create %NETWORK_NAME%
)

echo [2/5] Eliminando contenedor previo (si existe) ...
docker rm -f %CONTAINER_NAME% >nul 2>&1

if /I "%~1"=="--reset" (
  echo [!] --reset indicado: eliminando volumen de datos "%VOLUME_NAME%" ...
  docker volume rm %VOLUME_NAME% >nul 2>&1
)

echo [3/5] Creando contenedor %CONTAINER_NAME% (%IMAGE_NAME%) ...
docker run -d ^
  --name %CONTAINER_NAME% ^
  --network %NETWORK_NAME% ^
  -e POSTGRES_USER=%POSTGRES_USER% ^
  -e POSTGRES_PASSWORD=%POSTGRES_PASSWORD% ^
  -e POSTGRES_DB=%POSTGRES_DB% ^
  -p %HOST_PORT%:5432 ^
  -v %VOLUME_NAME%:/var/lib/postgresql/data ^
  -v "%~dp0init:/docker-entrypoint-initdb.d" ^
  --restart unless-stopped ^
  %IMAGE_NAME%

if errorlevel 1 (
  echo [ERROR] No se pudo crear el contenedor de PostgreSQL.
  exit /b 1
)

echo [4/5] Esperando a que PostgreSQL este listo ...
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
echo [5/5] PostgreSQL 17 listo.
echo.
echo   Host (desde tu maquina): localhost:%HOST_PORT%
echo   Host (desde otros contenedores en "%NETWORK_NAME%"): %CONTAINER_NAME%:5432
echo   Base de datos: %POSTGRES_DB%   Usuario: %POSTGRES_USER%
echo.
echo Contenedor: %CONTAINER_NAME%

endlocal

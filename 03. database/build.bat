@echo off
setlocal

rem =============================================================================
rem  Wallet Transaction Service - Base de datos (PostgreSQL 17)
rem  build.bat: construye la imagen Docker local de la base de datos, con el
rem  esquema y el seed (init/*.sql) ya incluidos dentro de la imagen.
rem =============================================================================

set IMAGE_NAME=ligo-wallet-postgres:17

cd /d "%~dp0"

if not exist "init\001_schema.sql" (
  echo [ERROR] No se encuentra init\001_schema.sql
  exit /b 1
)
if not exist "init\002_seed.sql" (
  echo [ERROR] No se encuentra init\002_seed.sql
  exit /b 1
)

echo Construyendo imagen %IMAGE_NAME% (postgres:17 + esquema + seed) ...
docker build -t %IMAGE_NAME% .
if errorlevel 1 (
  echo [ERROR] Fallo la construccion de la imagen de base de datos.
  exit /b 1
)

echo.
echo Build de base de datos completado. Imagen lista: %IMAGE_NAME%
echo Ejecuta deploy.bat para levantar el contenedor (reconstruye la BD desde cero).

endlocal

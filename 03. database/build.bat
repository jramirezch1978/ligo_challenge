@echo off
setlocal

rem =============================================================================
rem  Wallet Transaction Service - Base de datos (PostgreSQL 17)
rem  build.bat: prepara/valida los artefactos de la capa de base de datos.
rem  No hay "compilacion" como tal para SQL; este script:
rem    1) descarga (pull) la imagen oficial postgres:17
rem    2) valida que existan los scripts de inicializacion esperados
rem =============================================================================

set IMAGE_NAME=postgres:17

echo [1/2] Descargando imagen %IMAGE_NAME% ...
docker pull %IMAGE_NAME%
if errorlevel 1 (
  echo [ERROR] No se pudo descargar la imagen %IMAGE_NAME%.
  exit /b 1
)

echo [2/2] Validando scripts de inicializacion en "%~dp0init" ...
if not exist "%~dp0init\001_schema.sql" (
  echo [ERROR] No se encuentra init\001_schema.sql
  exit /b 1
)
if not exist "%~dp0init\002_seed.sql" (
  echo [ERROR] No se encuentra init\002_seed.sql
  exit /b 1
)

echo.
echo Build de base de datos completado correctamente.
echo Imagen lista: %IMAGE_NAME%
echo Scripts listos: init\001_schema.sql, init\002_seed.sql
echo Ejecuta deploy.bat para levantar el contenedor.

endlocal

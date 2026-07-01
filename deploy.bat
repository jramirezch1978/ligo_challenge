@echo off
setlocal

rem =============================================================================
rem  Ligo - Wallet Transaction Service - deploy.bat unificado
rem
rem  Uso:
rem    deploy.bat database    Despliega PostgreSQL 17 (IDEMPOTENTE: elimina
rem                           contenedor + volumen previos y reconstruye todo
rem                           desde cero, cargando el esquema y el seed inicial)
rem    deploy.bat backend     Construye la imagen del backend y despliega el
rem                           contenedor (requiere que "database" ya este arriba)
rem    deploy.bat frontend    Construye la imagen del frontend y despliega el
rem                           contenedor (requiere que "backend" ya este arriba)
rem    deploy.bat all         Despliega los tres, en orden: database, backend,
rem                           frontend
rem
rem  Las tres capas crean su propia imagen Docker local y se conectan entre si
rem  mediante la red compartida "ligo-network".
rem =============================================================================

set ROOT=%~dp0
set TARGET=%~1

if "%TARGET%"=="" goto usage
if /I "%TARGET%"=="database" goto database
if /I "%TARGET%"=="backend" goto backend
if /I "%TARGET%"=="frontend" goto frontend
if /I "%TARGET%"=="all" goto all
goto usage

:database
call "%ROOT%03. database\deploy.bat"
exit /b %errorlevel%

:backend
call "%ROOT%02. backend\deploy.bat"
exit /b %errorlevel%

:frontend
call "%ROOT%01. frontend\deploy.bat"
exit /b %errorlevel%

:all
call "%ROOT%03. database\deploy.bat" && ^
call "%ROOT%02. backend\deploy.bat" && ^
call "%ROOT%01. frontend\deploy.bat"
exit /b %errorlevel%

:usage
echo Uso: deploy.bat [database^|backend^|frontend^|all]
exit /b 1

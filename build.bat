@echo off
setlocal

rem =============================================================================
rem  Ligo - Wallet Transaction Service - build.bat unificado
rem
rem  Uso:
rem    build.bat database    Construye la imagen local de PostgreSQL 17
rem                          (esquema + seed horneados en la imagen)
rem    build.bat backend     Instala dependencias y compila el backend (dist/)
rem    build.bat frontend    Instala dependencias y compila el frontend (dist/)
rem    build.bat all         Ejecuta los tres, en orden: database, backend, frontend
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
call "%ROOT%03. database\build.bat"
exit /b %errorlevel%

:backend
call "%ROOT%02. backend\build.bat"
exit /b %errorlevel%

:frontend
call "%ROOT%01. frontend\build.bat"
exit /b %errorlevel%

:all
call "%ROOT%03. database\build.bat" && ^
call "%ROOT%02. backend\build.bat" && ^
call "%ROOT%01. frontend\build.bat"
exit /b %errorlevel%

:usage
echo Uso: build.bat [database^|backend^|frontend^|all]
exit /b 1

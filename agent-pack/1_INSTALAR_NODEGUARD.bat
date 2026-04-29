@echo off
setlocal
title Instalador NodeGuardAgentSERVER

cd /d "%~dp0"

echo ========================================
echo  INSTALADOR NODEGUARD AGENT SERVER
echo ========================================
echo.

:: Validar administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Se necesitan permisos de administrador.
    echo Solicitando permisos...
    echo.

    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo Ejecutando como administrador...
echo.

:: Validar archivos principales
if not exist "%~dp0install-nodeguard.ps1" (
    echo ERROR: No se encontro install-nodeguard.ps1
    echo Verifica que el archivo este en la misma carpeta que este BAT.
    echo.
    pause
    exit /b
)

if not exist "%~dp0NodeGuardAgentSERVER.exe" (
    echo ERROR: No se encontro NodeGuardAgentSERVER.exe
    echo Verifica que el agente este en la misma carpeta que este BAT.
    echo.
    pause
    exit /b
)

if not exist "%~dp0tools\nssm.exe" (
    echo ERROR: No se encontro tools\nssm.exe
    echo El paquete debe incluir NSSM para instalar sin internet.
    echo.
    pause
    exit /b
)

echo Archivos encontrados correctamente.
echo.
echo Iniciando instalacion...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-nodeguard.ps1"

echo.
echo ========================================
echo  PROCESO FINALIZADO
echo ========================================
echo.

echo Validando servicio...
powershell.exe -NoProfile -Command "Get-Service NodeGuardAgentSERVER -ErrorAction SilentlyContinue"

echo.
echo Si el estado aparece como Running, la instalacion fue correcta.
echo.
pause
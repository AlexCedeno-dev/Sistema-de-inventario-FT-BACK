@echo off
title NodeGuard Agent - Instalador
color 0A

:: ── Verificar privilegios de administrador ──
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo  Solicitando permisos de administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo  ============================================
echo   NodeGuard Agent - Instalacion
echo  ============================================
echo.

:: ── Verificar que los archivos necesarios existen ──
if not exist "%~dp0NodeGuardAgent.exe" (
    echo  [ERROR] No se encontro NodeGuardAgent.exe
    echo  Asegurate de ejecutar INSTALAR.bat desde
    echo  la carpeta del instalador.
    pause
    exit /b 1
)

if not exist "%~dp0.env" (
    echo  [ERROR] No se encontro el archivo .env
    echo  Contacta al area de IT.
    pause
    exit /b 1
)

echo  Instalando NodeGuard Agent...
echo.

:: ── Crear carpeta destino ──
if not exist "C:\NodeGuard" mkdir "C:\NodeGuard"

:: ── Copiar archivos ──
copy /Y "%~dp0NodeGuardAgent.exe" "C:\NodeGuard\NodeGuardAgent.exe" >nul
copy /Y "%~dp0nodeguard.env"      "C:\NodeGuard\.env"               >nul
echo  [OK] Archivos copiados a C:\NodeGuard

:: ── Eliminar tarea previa si existe ──
schtasks /delete /tn "NodeGuardAgent" /f >nul 2>&1

:: ── Crear tarea programada via PowerShell ──
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$action    = New-ScheduledTaskAction -Execute 'C:\NodeGuard\NodeGuardAgent.exe' -WorkingDirectory 'C:\NodeGuard';" ^
  "$trigger   = New-ScheduledTaskTrigger -AtStartup;" ^
  "$settings  = New-ScheduledTaskSettingsSet -Hidden -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -Priority 7;" ^
  "$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest;" ^
  "Register-ScheduledTask -TaskName 'NodeGuardAgent' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null;" ^
  "Start-ScheduledTask -TaskName 'NodeGuardAgent';"

if %errorLevel% equ 0 (
    echo  [OK] Tarea programada creada
    echo  [OK] Agente iniciado en segundo plano
) else (
    echo  [ERROR] No se pudo crear la tarea programada
    pause
    exit /b 1
)

echo.
echo  ============================================
echo   Instalacion completada exitosamente
echo   El agente corre en segundo plano
echo   Directorio: C:\NodeGuard
echo   Logs:       C:\NodeGuard\logs\
echo  ============================================
echo.
echo  Puedes cerrar esta ventana.
echo.
pause

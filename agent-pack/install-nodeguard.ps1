$SERVICE = "NodeGuardAgentSERVER"
$AGENT_DIR = "C:\NodeGuard"
$TOOLS_DIR = "C:\Tools\nssm"
$NSSM_FINAL = "C:\Tools\nssm\nssm.exe"
$FINAL_AGENT = "C:\NodeGuard\NodeGuardAgentSERVER.exe"
$CURRENT_DIR = (Get-Location).Path

Write-Host "=== REPARANDO NODEGUARD ===" -ForegroundColor Cyan

# Validar administrador
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (!$isAdmin) {
    Write-Host "ERROR: Debes ejecutar PowerShell como administrador." -ForegroundColor Red
    Read-Host "Presiona ENTER para salir"
    exit
}

# Crear carpetas
New-Item -ItemType Directory -Path $AGENT_DIR -Force | Out-Null
New-Item -ItemType Directory -Path "$AGENT_DIR\logs" -Force | Out-Null
New-Item -ItemType Directory -Path $TOOLS_DIR -Force | Out-Null

# Buscar agente dentro del paquete
$LOCAL_AGENT = Get-ChildItem -Path $CURRENT_DIR -Filter "NodeGuard*.exe" -File -ErrorAction SilentlyContinue | Select-Object -First 1

if (!$LOCAL_AGENT) {
    Write-Host "ERROR: No se encontro NodeGuard*.exe en la carpeta actual." -ForegroundColor Red
    Write-Host "Asegurate de estar parado dentro de la carpeta descomprimida del ZIP." -ForegroundColor Yellow
    Read-Host "Presiona ENTER para salir"
    exit
}

# Copiar agente
Copy-Item $LOCAL_AGENT.FullName $FINAL_AGENT -Force
Unblock-File $FINAL_AGENT

# Buscar NSSM dentro del paquete o en C:\Tools
$LOCAL_NSSM = Get-ChildItem -Path $CURRENT_DIR -Recurse -Filter "nssm.exe" -File -ErrorAction SilentlyContinue |
Where-Object { $_.FullName -like "*win64*" -or $_.FullName -like "*tools*" } |
Select-Object -First 1

if (!$LOCAL_NSSM -and (Test-Path $NSSM_FINAL)) {
    $LOCAL_NSSM = Get-Item $NSSM_FINAL
}

if (!$LOCAL_NSSM) {
    Write-Host "ERROR: No se encontro nssm.exe dentro del paquete." -ForegroundColor Red
    Write-Host "Debe venir dentro de la carpeta tools o tools\nssm-2.24\win64." -ForegroundColor Yellow
    Read-Host "Presiona ENTER para salir"
    exit
}

Copy-Item $LOCAL_NSSM.FullName $NSSM_FINAL -Force
Unblock-File $NSSM_FINAL

# Dar permisos correctos
icacls "C:\NodeGuard" /grant "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" /T | Out-Null
icacls "C:\Tools" /grant "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" /T | Out-Null

# Eliminar servicio anterior si existe
$existing = Get-Service $SERVICE -ErrorAction SilentlyContinue

if ($existing) {
    Write-Host "Eliminando servicio anterior..." -ForegroundColor Yellow
    try { Stop-Service $SERVICE -Force -ErrorAction SilentlyContinue } catch {}
    try { & $NSSM_FINAL stop $SERVICE | Out-Null } catch {}
    try { & $NSSM_FINAL remove $SERVICE confirm | Out-Null } catch {}
    Start-Sleep -Seconds 2
}

# Crear servicio limpio
Write-Host "Creando servicio limpio..." -ForegroundColor Cyan

& $NSSM_FINAL install $SERVICE $FINAL_AGENT
& $NSSM_FINAL set $SERVICE Application $FINAL_AGENT
& $NSSM_FINAL set $SERVICE AppDirectory $AGENT_DIR
& $NSSM_FINAL reset $SERVICE AppParameters
& $NSSM_FINAL set $SERVICE AppStdout "$AGENT_DIR\logs\out.log"
& $NSSM_FINAL set $SERVICE AppStderr "$AGENT_DIR\logs\error.log"
& $NSSM_FINAL set $SERVICE Start SERVICE_AUTO_START
& $NSSM_FINAL set $SERVICE AppExit Default Restart

Write-Host "Iniciando servicio..." -ForegroundColor Cyan
& $NSSM_FINAL start $SERVICE

Start-Sleep -Seconds 4

Write-Host ""
Write-Host "=== ESTADO FINAL ===" -ForegroundColor Green
Get-Service $SERVICE

Write-Host ""
Write-Host "=== PROCESO ===" -ForegroundColor Green
Get-Process | Where-Object { $_.ProcessName -like "NodeGuard*" } | Select-Object ProcessName, Id

Write-Host ""
Write-Host "=== SERVICIO ===" -ForegroundColor Green
Get-CimInstance Win32_Service -Filter "Name='$SERVICE'" | Select-Object Name, State, StartName, PathName, ProcessId

Write-Host ""
Write-Host "Si sigue en Stopped, revisa este log:" -ForegroundColor Yellow
Write-Host "C:\NodeGuard\logs\error.log" -ForegroundColor Yellow

Read-Host "Presiona ENTER para cerrar"
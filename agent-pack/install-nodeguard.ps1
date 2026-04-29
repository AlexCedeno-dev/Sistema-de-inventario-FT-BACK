$SERVICE = "NodeGuardAgentSERVER"
$AGENT_DIR = "C:\NodeGuard"
$AGENT_EXE = "C:\NodeGuard\NodeGuardAgentSERVER.exe"
$TOOLS_DIR = "C:\Tools\nssm"
$NSSM = "C:\Tools\nssm\nssm.exe"

Write-Host "=== Instalador NodeGuardAgentSERVER ===" -ForegroundColor Cyan

# Crear carpetas necesarias
New-Item -ItemType Directory -Path $AGENT_DIR -Force | Out-Null
New-Item -ItemType Directory -Path "$AGENT_DIR\logs" -Force | Out-Null
New-Item -ItemType Directory -Path $TOOLS_DIR -Force | Out-Null

# Validar que exista el agente
if (!(Test-Path $AGENT_EXE)) {
    Write-Host "ERROR: No existe el agente en: $AGENT_EXE" -ForegroundColor Red
    Write-Host "Copia NodeGuardAgentSERVER.exe dentro de C:\NodeGuard y vuelve a ejecutar el script." -ForegroundColor Yellow
    exit
}

# Descargar NSSM si no existe
if (!(Test-Path $NSSM)) {
    Write-Host "Descargando NSSM..." -ForegroundColor Cyan

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile "$TOOLS_DIR\nssm.zip"
    Expand-Archive -Path "$TOOLS_DIR\nssm.zip" -DestinationPath $TOOLS_DIR -Force
    Copy-Item "$TOOLS_DIR\nssm-2.24\win64\nssm.exe" $NSSM -Force
    Unblock-File $NSSM
}

# Validar NSSM
if (!(Test-Path $NSSM)) {
    Write-Host "ERROR: No se encontró NSSM en: $NSSM" -ForegroundColor Red
    exit
}

# Revisar si ya existe el servicio
$existing = Get-Service $SERVICE -ErrorAction SilentlyContinue

if ($existing) {
    Write-Host "El servicio ya existe. Se detendrá para reconfigurarlo..." -ForegroundColor Yellow
    & $NSSM stop $SERVICE | Out-Null
} else {
    Write-Host "Creando servicio $SERVICE..." -ForegroundColor Cyan
    & $NSSM install $SERVICE $AGENT_EXE
}

# Configurar servicio
& $NSSM set $SERVICE Application $AGENT_EXE
& $NSSM set $SERVICE AppDirectory $AGENT_DIR
& $NSSM reset $SERVICE AppParameters
& $NSSM set $SERVICE AppStdout "$AGENT_DIR\logs\out.log"
& $NSSM set $SERVICE AppStderr "$AGENT_DIR\logs\error.log"
& $NSSM set $SERVICE Start SERVICE_AUTO_START
& $NSSM set $SERVICE AppExit Default Restart

# Iniciar servicio
Write-Host "Iniciando servicio..." -ForegroundColor Cyan
& $NSSM start $SERVICE

Start-Sleep -Seconds 2

# Mostrar estado final
Write-Host "=== Estado del servicio ===" -ForegroundColor Green
Get-Service $SERVICE

Write-Host "=== Proceso asociado ===" -ForegroundColor Green
Get-CimInstance Win32_Service -Filter "Name='$SERVICE'" | Select-Object Name, State, ProcessId

Write-Host "=== Instalación finalizada ===" -ForegroundColor Green
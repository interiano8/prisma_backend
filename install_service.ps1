# PowerShell Service Installer script for Windows using NSSM
# This script must be run as Administrator

# 1. Run as Administrator validation
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "Este script requiere privilegios de Administrador. Por favor ejecute PowerShell como Administrador."
    Exit
}

# 2. Check for NSSM in current directory
$NssmPath = Join-Path $PSScriptRoot "nssm.exe"
if (-not (Test-Path $NssmPath)) {
    Write-Warning "No se encontro 'nssm.exe' en el directorio actual. Buscando en la variable de entorno PATH..."
    $NssmPath = Get-Command nssm -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
    if (-not $NssmPath) {
        Write-Error "No se pudo encontrar nssm.exe. Asegurese de colocar 'nssm.exe' en la carpeta actual junto a este script."
        Exit
    }
}

Write-Host "--- Instalador de Servicio de Windows BCPOS Backend ---" -ForegroundColor Cyan

# 3. Resolve Node.exe path
$NodePath = Get-Command node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $NodePath) {
    # Check common installation directories
    $CommonPaths = @(
        "$env:ProgramFiles\nodejs\node.exe",
        "$env:ProgramFiles(x86)\nodejs\node.exe"
    )
    foreach ($Path in $CommonPaths) {
        if (Test-Path $Path) {
            $NodePath = $Path
            break
        }
    }
}

if (-not $NodePath) {
    Write-Error "No se encontro node.exe en el sistema. Por favor instale Node.js y asegurese de agregarlo al PATH."
    Exit
}

# 4. Define service configuration
$ServiceName = "backend-bcpos-app"
$AppDirectory = $PSScriptRoot
$AppScript = Join-Path $AppDirectory "dist\src\main.js"

if (-not (Test-Path $AppScript)) {
    Write-Warning "Advertencia: No se encontro el archivo compilado '$AppScript'. Asegurese de compilar el backend ejecutando 'pnpm run build' antes de iniciar el servicio."
}

# 5. Service Installation
Write-Host "Instalando servicio '$ServiceName'..." -ForegroundColor Green
& $NssmPath install $ServiceName $NodePath $AppScript
& $NssmPath set $ServiceName AppDirectory $AppDirectory
& $NssmPath set $ServiceName Description "Servicio de Windows para el Backend del POS Roatan (BCPOS)"

# Configure stdout and stderr logs for troubleshooting
& $NssmPath set $ServiceName AppStdout (Join-Path $AppDirectory "service_stdout.log")
& $NssmPath set $ServiceName AppStderr (Join-Path $AppDirectory "service_stderr.log")

# 6. Start Service
Write-Host "Iniciando servicio..." -ForegroundColor Green
& $NssmPath start $ServiceName

Write-Host "================================================================" -ForegroundColor Green
Write-Host "¡El servicio '$ServiceName' ha sido instalado e iniciado!" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green

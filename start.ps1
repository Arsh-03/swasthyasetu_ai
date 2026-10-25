<#
.SYNOPSIS
  Set up and start CareBridge (SwasthyaSetu AI): backend + Doctor portal + Patient app (web).

.DESCRIPTION
  First run: creates a Python virtual environment in backend\.venv, installs the backend
  requirements into it, installs the packages of both apps, creates .env, then starts the
  backend (port 8000), the Doctor portal (port 5173) and the Patient app's web version
  (port 8081) in their own windows and opens the browser.
  Later runs only reinstall when requirements.txt / package-lock.json change.

.EXAMPLE
  .\start.ps1                 # set up if needed, then start everything
  .\start.ps1 -SetupData      # also download + import ICD-11, RxNorm and DDInter (~95 MB, once)
  .\start.ps1 -Reinstall      # rebuild the virtual environment from scratch
  .\start.ps1 -NoBrowser      # don't open the browser
  .\stop.ps1                  # stop all servers
#>
param(
    [switch]$SetupData,
    [switch]$Reinstall,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$Root      = $PSScriptRoot
$Backend   = Join-Path $Root 'backend'
$DoctorApp  = Join-Path $Root 'frontend Doctor'
$PatientApp = Join-Path $Root 'frontend Patient'
$Venv      = Join-Path $Backend '.venv'
$VenvPy    = Join-Path $Venv 'Scripts\python.exe'
$BackendPort  = 8000
$DoctorPort   = 5173
$PatientPort  = 8081

function Step([string]$msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Info([string]$msg) { Write-Host "    $msg" -ForegroundColor Gray }
function Fail([string]$msg) { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }

function Get-FileSha([string]$path) { (Get-FileHash -Algorithm SHA256 -Path $path).Hash }

function Find-Python {
    # Python 3.11+ is required (the backend uses asyncio.timeout).
    $candidates = @(@('py', '-3.12'), @('py', '-3.11'), @('py', '-3'), @('python'), @('python3'))
    foreach ($c in $candidates) {
        $exe = $c[0]; $extra = @($c | Select-Object -Skip 1)
        if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) { continue }
        try {
            $ver = & $exe @extra -c "import sys; print('%d.%d' % sys.version_info[:2])" 2>$null
        } catch { continue }
        if ($LASTEXITCODE -ne 0 -or -not $ver) { continue }
        $parts = "$ver".Trim().Split('.')
        if ([int]$parts[0] -eq 3 -and [int]$parts[1] -ge 11) {
            # Leading comma: return the array as one value (PowerShell would unroll a 1-item array).
            return ,(@($exe) + $extra)
        }
    }
    return $null
}

function Test-PortInUse([int]$port) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $conn) { return $null }
    $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
    if ($proc) { return "$($proc.ProcessName) (PID $($proc.Id))" } else { return "PID $($conn.OwningProcess)" }
}

Write-Host ""
Write-Host "CareBridge India (SwasthyaSetu AI)" -ForegroundColor Green
Write-Host ""

# ---------------------------------------------------------------------------
# 1. Python virtual environment + backend dependencies
# ---------------------------------------------------------------------------
Step "Python virtual environment (backend\.venv)"
if ($Reinstall -and (Test-Path $Venv)) {
    Info "Removing the old virtual environment"
    Remove-Item -Recurse -Force $Venv
}
if (-not (Test-Path $VenvPy)) {
    $py = Find-Python
    if (-not $py) { Fail "Python 3.11 or newer is required. Install it from https://www.python.org/downloads/ and run again." }
    $pyExe = $py[0]; $pyArgs = @($py | Select-Object -Skip 1)
    Info "Creating with: $($py -join ' ')"
    & $pyExe @pyArgs -m venv $Venv
    if ($LASTEXITCODE -ne 0) { Fail "Could not create the virtual environment." }
}

$req = Join-Path $Backend 'requirements.txt'
$reqStamp = Join-Path $Venv '.requirements.sha256'
$reqHash = Get-FileSha $req
$haveHash = if (Test-Path $reqStamp) { (Get-Content $reqStamp -Raw).Trim() } else { '' }
if ($reqHash -ne $haveHash) {
    Step "Installing backend requirements into the virtual environment"
    & $VenvPy -m pip install --disable-pip-version-check --quiet --upgrade pip
    & $VenvPy -m pip install --disable-pip-version-check -r $req
    if ($LASTEXITCODE -ne 0) { Fail "pip install failed (see messages above)." }
    Set-Content -Path $reqStamp -Value $reqHash -Encoding ascii
} else {
    Info "Backend requirements already installed"
}

# ---------------------------------------------------------------------------
# 2. Packages for the Doctor portal and the Patient app
# ---------------------------------------------------------------------------
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Fail "Node.js (with npm) is required. Install the LTS version from https://nodejs.org/ and run again."
}
foreach ($app in @($DoctorApp, $PatientApp)) {
    $name = Split-Path $app -Leaf
    Step "Packages ($name\node_modules)"
    $lock = Join-Path $app 'package-lock.json'
    $pkgStamp = Join-Path $app 'node_modules\.install.sha256'
    $pkgHash = Get-FileSha (Join-Path $app 'package.json')
    if (Test-Path $lock) { $pkgHash += Get-FileSha $lock }
    $havePkg = if (Test-Path $pkgStamp) { (Get-Content $pkgStamp -Raw).Trim() } else { '' }
    if ($pkgHash -ne $havePkg) {
        Info "Running npm install (first run takes a few minutes)"
        Push-Location $app
        try { npm install --no-fund --no-audit } finally { Pop-Location }
        if ($LASTEXITCODE -ne 0) { Fail "npm install failed in $name (see messages above)." }
        Set-Content -Path $pkgStamp -Value $pkgHash -Encoding ascii
    } else {
        Info "Packages already installed"
    }
}

# ---------------------------------------------------------------------------
# 3. Configuration (.env)
# ---------------------------------------------------------------------------
Step "Configuration (.env)"
$envFile = Join-Path $Root '.env'
if (-not (Test-Path $envFile)) {
    $example = Get-Content (Join-Path $Root '.env.example') -Raw
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $secret = -join ($bytes | ForEach-Object { $_.ToString('x2') })
    $example = $example -replace '(?m)^SECRET_KEY=.*$', "SECRET_KEY=$secret"
    Set-Content -Path $envFile -Value $example -Encoding utf8
    Info "Created .env with a new random SECRET_KEY"
} else {
    Info ".env present"
}

# ---------------------------------------------------------------------------
# 4. Clinical terminology data (optional download)
# ---------------------------------------------------------------------------
Step "Clinical terminology data"
$termDb = Join-Path $Backend 'data\terminology.db'
if ($SetupData) {
    Push-Location $Backend
    try { & $VenvPy scripts\fetch_open_datasets.py } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { Write-Host "    Some datasets failed to import; the app still starts." -ForegroundColor Yellow }
} elseif (Test-Path $termDb) {
    Info "terminology.db present"
} else {
    Write-Host "    Not set up yet: the notepad works, but without official codes or interaction checks." -ForegroundColor Yellow
    Write-Host "    Run .\start.ps1 -SetupData once to download and import ICD-11, RxNorm and DDInter." -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# 5. Start servers
# ---------------------------------------------------------------------------
Step "Starting servers"
foreach ($p in @($BackendPort, $DoctorPort, $PatientPort)) {
    $owner = Test-PortInUse $p
    if ($owner) { Fail "Port $p is already in use by $owner. Run .\stop.ps1 (or close the old server window) and try again." }
}

# --timeout-graceful-shutdown lets auto-reload restart even while the notepad's WebSocket is open.
$backendCmd = "`$Host.UI.RawUI.WindowTitle = 'CareBridge backend :$BackendPort'; Set-Location '$Backend'; " +
              "& '$VenvPy' -m uvicorn app.main:app --reload --port $BackendPort --timeout-graceful-shutdown 3"
# not 'npm run dev --': PowerShell drops the '--'
$doctorCmd = "`$Host.UI.RawUI.WindowTitle = 'CareBridge Doctor portal :$DoctorPort'; Set-Location '$DoctorApp'; " +
             "npx vite --port $DoctorPort --strictPort"
$patientCmd = "`$Host.UI.RawUI.WindowTitle = 'CareBridge Patient app (web) :$PatientPort'; Set-Location '$PatientApp'; " +
              "`$env:BROWSER = 'none'; npx expo start --web --port $PatientPort"
Start-Process powershell -ArgumentList @('-NoExit', '-NoProfile', '-Command', $backendCmd) | Out-Null
Start-Process powershell -ArgumentList @('-NoExit', '-NoProfile', '-Command', $doctorCmd) | Out-Null
Start-Process powershell -ArgumentList @('-NoExit', '-NoProfile', '-Command', $patientCmd) | Out-Null

Info "Waiting for the backend to come up ..."
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    try {
        $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://127.0.0.1:$BackendPort/health"
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
}
if (-not $ready) {
    Write-Host "    Backend didn't answer within 60 s; check the 'CareBridge backend' window for errors." -ForegroundColor Yellow
}

$doctorUrl = "http://localhost:$DoctorPort"
$patientUrl = "http://localhost:$PatientPort"
Write-Host ""
Write-Host "CareBridge is running:" -ForegroundColor Green
Write-Host "    Doctor portal:     $doctorUrl   (login NMC-KA-581920 / password123)"
Write-Host "    Patient app (web): $patientUrl   (tap the 'Demo 1-Click' login; first load bundles for ~30 s)"
Write-Host "    API docs:          http://localhost:$BackendPort/docs"
Write-Host "    Stop:              .\stop.ps1  (or close the three server windows)"
Write-Host ""
if (-not $NoBrowser) { Start-Process $doctorUrl; Start-Process $patientUrl }

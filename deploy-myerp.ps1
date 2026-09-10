# deploy-myerp.ps1
# Deploy MYERP (Frontend Production Build + Backend API + DB Migrations) to myerp.ideas.edu.vn

param(
    [string]$RemoteDir = "myerp.ideas.edu.vn",
    [switch]$BackendOnly = $false,
    [switch]$FrontendOnly = $false,
    [switch]$CloneDatabase = $false
)

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "   MYERP DEPLOYMENT PIPELINE -> https://myerp.ideas.edu.vn" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

$sshKey = "C:\Users\LENOVO\.ssh\id_ed25519"
$sshUser = "vhvxoigh"
$sshHost = "chiefaiofficer.vn"
$sshPort = "2210"

# 0. Generate Unique Deployment Version Timestamp
$deployVersion = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()
$deployTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$versionPayload = "{`"version`": `"$deployVersion`", `"buildTime`": `"$deployTime`"}"
try {
    [System.IO.File]::WriteAllText("$PSScriptRoot\public\version.json", $versionPayload, [System.Text.Encoding]::UTF8)
} catch {
    Set-Content -Path "public\version.json" -Value $versionPayload -Encoding UTF8 -Force -ErrorAction SilentlyContinue
}
try {
    [System.IO.File]::WriteAllText("$PSScriptRoot\backend\version.json", $versionPayload, [System.Text.Encoding]::UTF8)
} catch {
    Set-Content -Path "backend\version.json" -Value $versionPayload -Encoding UTF8 -Force -ErrorAction SilentlyContinue
}

# 1. Build Frontend if requested
if (-not $BackendOnly) {
    Write-Host "`n[1/4] Building Frontend UI Production Bundle..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Frontend build failed. Aborting deployment." -ForegroundColor Red
        exit $LASTEXITCODE
    }
    Write-Host "Frontend build completed successfully (dist/)." -ForegroundColor Green
}

# 2. Package Backend & Frontend
$backendArchive = "myerp_backend.tar.gz"
$distArchive = "myerp_dist.tar.gz"

Write-Host "`n[2/4] Packaging deployment archives..." -ForegroundColor Yellow
tar -czf "$backendArchive" -C backend .
if (Test-Path "dist") {
    tar -czf "$distArchive" -C dist .
}

# 3. Upload & Deploy to Remote Server
Write-Host "`n[3/4] Uploading archives to ${sshHost}:${RemoteDir} ..." -ForegroundColor Yellow

# Ensure remote directories exist
cmd /c "ssh -i $sshKey -4 -p $sshPort -o StrictHostKeyChecking=no ${sshUser}@${sshHost} ""mkdir -p ${RemoteDir}/backend ${RemoteDir}/backend/uploads"""

# Deploy Backend
if (-not $FrontendOnly) {
    Write-Host "  -> Extracting backend files..." -ForegroundColor Gray
    cmd /c "ssh -i $sshKey -4 -p $sshPort -o StrictHostKeyChecking=no ${sshUser}@${sshHost} ""tar -xzf - -C ${RemoteDir}/backend/"" < ""$backendArchive"""
    
    # Run migrations / database setup
    Write-Host "  -> Running database migrations on vhvxoigh_myerp..." -ForegroundColor Gray
    if ($CloneDatabase) {
        cmd /c "ssh -i $sshKey -4 -p $sshPort -o StrictHostKeyChecking=no ${sshUser}@${sshHost} ""/usr/local/bin/ea-php81 ${RemoteDir}/backend/clone_db_to_myerp.php; /usr/local/bin/ea-php81 ${RemoteDir}/backend/run_migrations.php --apply"""
    } else {
        cmd /c "ssh -i $sshKey -4 -p $sshPort -o StrictHostKeyChecking=no ${sshUser}@${sshHost} ""/usr/local/bin/ea-php81 ${RemoteDir}/backend/run_migrations.php --apply"""
    }
}

# Deploy Frontend
if ((-not $BackendOnly) -and (Test-Path "$distArchive")) {
    Write-Host "  -> Extracting frontend dist files to document root..." -ForegroundColor Gray
    cmd /c "ssh -i $sshKey -4 -p $sshPort -o StrictHostKeyChecking=no ${sshUser}@${sshHost} ""tar -xzf - -C ${RemoteDir}/"" < ""$distArchive"""
}

# Ensure version.json is present in both root and backend
cmd /c "ssh -i $sshKey -4 -p $sshPort -o StrictHostKeyChecking=no ${sshUser}@${sshHost} ""cp -f ${RemoteDir}/version.json ${RemoteDir}/backend/version.json 2>/dev/null || true"""

# 4. Clean up local temp archives
Remove-Item "$backendArchive" -ErrorAction SilentlyContinue
Remove-Item "$distArchive" -ErrorAction SilentlyContinue

Write-Host "`n[4/4] Deployment finished!" -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green
Write-Host "   MYERP is live at: https://myerp.ideas.edu.vn/" -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green

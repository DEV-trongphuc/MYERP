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
$sshHost = "103.110.87.26"
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

$archivesToUpload = @()
if (-not $FrontendOnly -and (Test-Path "$backendArchive")) {
    $archivesToUpload += "`"$backendArchive`""
}
if (-not $BackendOnly -and (Test-Path "$distArchive")) {
    $archivesToUpload += "`"$distArchive`""
}

if ($archivesToUpload.Count -gt 0) {
    $uploadFilesStr = $archivesToUpload -join " "
    Write-Host "  -> Uploading archives in single batch..." -ForegroundColor Gray
    cmd /c "scp -i $sshKey -P $sshPort -o StrictHostKeyChecking=no -o ConnectTimeout=15 $uploadFilesStr ${sshUser}@${sshHost}:${RemoteDir}/"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "    Retrying upload once..." -ForegroundColor DarkYellow
        Start-Sleep -Seconds 3
        cmd /c "scp -i $sshKey -P $sshPort -o StrictHostKeyChecking=no -o ConnectTimeout=15 $uploadFilesStr ${sshUser}@${sshHost}:${RemoteDir}/"
    }
}

Start-Sleep -Seconds 3

Write-Host "  -> Remote extraction, migrations and cleanup in single session..." -ForegroundColor Gray
$remoteScript = "mkdir -p ${RemoteDir}/backend ${RemoteDir}/backend/uploads && " +
    "tar -xzf ${RemoteDir}/${backendArchive} -C ${RemoteDir}/backend/ 2>/dev/null; " +
    "tar -xzf ${RemoteDir}/${distArchive} -C ${RemoteDir}/ 2>/dev/null; " +
    "rm -f ${RemoteDir}/${backendArchive} ${RemoteDir}/${distArchive}; " +
    "/usr/local/bin/ea-php81 ${RemoteDir}/backend/run_migrations.php --apply; " +
    "cp -f ${RemoteDir}/version.json ${RemoteDir}/backend/version.json 2>/dev/null || true"

cmd /c "ssh -i $sshKey -p $sshPort -o StrictHostKeyChecking=no -o ConnectTimeout=15 ${sshUser}@${sshHost} ""$remoteScript"""
if ($LASTEXITCODE -ne 0) {
    Write-Host "    Retrying remote commands once..." -ForegroundColor DarkYellow
    Start-Sleep -Seconds 4
    cmd /c "ssh -i $sshKey -p $sshPort -o StrictHostKeyChecking=no -o ConnectTimeout=15 ${sshUser}@${sshHost} ""$remoteScript"""
}

# 4. Clean up local temp archives
Remove-Item "$backendArchive" -ErrorAction SilentlyContinue
Remove-Item "$distArchive" -ErrorAction SilentlyContinue

Write-Host "`n[4/4] Deployment finished successfully!" -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green
Write-Host "   MYERP is live at: https://myerp.ideas.edu.vn/" -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green

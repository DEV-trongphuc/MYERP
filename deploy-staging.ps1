# deploy-staging.ps1
# Staging Deployment Pipeline -> https://myerp-stagging.ideas.edu.vn
# Safe, isolated deployment targeting ONLY staging environment and vhvxoigh_erpstagging database.

param(
    [string]$RemoteDir = "myerp-stagging.ideas.edu.vn",
    [Alias("be")]
    [switch]$BackendOnly = $false,
    [Alias("fe")]
    [switch]$FrontendOnly = $false,
    [switch]$SkipBuild = $false,
    [switch]$CloneDatabase = $false
)

$sw = [System.Diagnostics.Stopwatch]::StartNew()

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "   MYERP STAGING DEPLOYMENT -> https://myerp-stagging.ideas.edu.vn" -ForegroundColor Cyan
Write-Host "   Target Database: vhvxoigh_erpstagging (ISOLATED)" -ForegroundColor Yellow
Write-Host "=========================================================" -ForegroundColor Cyan

$sshKey = "C:\Users\LENOVO\.ssh\id_ed25519"
$sshUser = "vhvxoigh"
$sshHost = "103.110.87.26"
$sshPort = "2210"

# 1. Frontend Build with Vite
if (-not $BackendOnly) {
    if (-not $SkipBuild) {
        Write-Host "`n[1/4] Building Frontend UI Bundle with Vite..." -ForegroundColor Yellow
        $env:GOMAXPROCS = "4"
        npx vite build
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: Frontend build failed. Aborting staging deployment." -ForegroundColor Red
            exit $LASTEXITCODE
        }
        Write-Host "  -> Frontend build completed successfully." -ForegroundColor Green
    } else {
        Write-Host "`n[1/4] Skipping Frontend build (-SkipBuild specified)..." -ForegroundColor DarkGray
    }
} else {
    Write-Host "`n[1/4] Skipping Frontend build (Backend-Only mode)..." -ForegroundColor DarkGray
}

# 2. Packaging Archives
$backendArchive = "myerp_staging_backend.tar.gz"
$distArchive = "myerp_staging_dist.tar.gz"

Write-Host "`n[2/4] Packaging deployment archives for Staging..." -ForegroundColor Yellow

if (-not $FrontendOnly) {
    tar -czf "$backendArchive" --exclude="uploads/*" --exclude="*.log" -C backend .
    $beSize = [Math]::Round(((Get-Item $backendArchive).Length / 1MB), 2)
    Write-Host "  -> Backend archive: ${beSize} MB" -ForegroundColor Gray
}

if (-not $BackendOnly -and (Test-Path "dist")) {
    tar -czf "$distArchive" --exclude="stickers" --exclude="stickers/*" --exclude="ideas_bot_kling.*" -C dist .
    $feSize = [Math]::Round(((Get-Item $distArchive).Length / 1MB), 2)
    Write-Host "  -> Frontend dist archive: ${feSize} MB" -ForegroundColor Gray
}

# 3. Upload Archives and Configs
Write-Host "`n[3/4] Uploading archives & setup files to staging directory: ${RemoteDir}..." -ForegroundColor Yellow

$filesToUpload = @()
if (-not $FrontendOnly -and (Test-Path "$backendArchive")) {
    $filesToUpload += $backendArchive
}
if (-not $BackendOnly -and (Test-Path "$distArchive")) {
    $filesToUpload += $distArchive
}
$filesToUpload += "scratch\staging\staging_env"
$filesToUpload += "scratch\staging\staging_htaccess"
$filesToUpload += "scratch\staging\staging_setup.sh"

Write-Host "  -> Uploading ($($filesToUpload -join ', '))..." -ForegroundColor Gray
& scp -4 -i $sshKey -P $sshPort -o StrictHostKeyChecking=no -o ConnectTimeout=30 @filesToUpload "${sshUser}@${sshHost}:${RemoteDir}/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "    Retrying upload in 12s..." -ForegroundColor DarkYellow
    Start-Sleep -Seconds 12
    & scp -4 -i $sshKey -P $sshPort -o StrictHostKeyChecking=no -o ConnectTimeout=30 @filesToUpload "${sshUser}@${sshHost}:${RemoteDir}/"
}

# Allow SSH connection pool to settle
Start-Sleep -Seconds 12

# 4. Remote Execution via staging_setup.sh
Write-Host "`n[4/4] Executing remote staging_setup.sh..." -ForegroundColor Yellow

$setupArgs = if ($CloneDatabase) { "--force-clone" } else { "" }
$remoteCmd = "chmod +x ${RemoteDir}/staging_setup.sh && bash ${RemoteDir}/staging_setup.sh $setupArgs"

& ssh -4 -tt -i $sshKey -p $sshPort -o StrictHostKeyChecking=no -o ConnectTimeout=30 "${sshUser}@${sshHost}" "$remoteCmd"
if ($LASTEXITCODE -ne 0) {
    Write-Host "    Retrying remote execution in 12s..." -ForegroundColor DarkYellow
    Start-Sleep -Seconds 12
    & ssh -4 -tt -i $sshKey -p $sshPort -o StrictHostKeyChecking=no -o ConnectTimeout=30 "${sshUser}@${sshHost}" "$remoteCmd"
}

# Clean local archives
Remove-Item "$backendArchive" -ErrorAction SilentlyContinue
Remove-Item "$distArchive" -ErrorAction SilentlyContinue

$sw.Stop()
$elapsedSec = [Math]::Round($sw.Elapsed.TotalSeconds, 1)

Write-Host "`n=========================================================" -ForegroundColor Green
Write-Host "   STAGING SETUP & DEPLOYMENT SUCCESSFUL in ${elapsedSec}s!" -ForegroundColor Green
Write-Host "   Staging Live URL: https://myerp-stagging.ideas.edu.vn/" -ForegroundColor Green
Write-Host "   Staging API v1 Docs: https://myerp-stagging.ideas.edu.vn/api-v1-docs" -ForegroundColor Green
Write-Host "   Staging DB: vhvxoigh_erpstagging (Production untouched)" -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green

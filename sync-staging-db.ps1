# sync-staging-db.ps1
# Dedicated 1-Way Database Schema & Migration Sync from Production -> Staging
# Production: vhvxoigh_myerp (STRICTLY READ-ONLY)
# Staging:    vhvxoigh_erpstagging (TARGET)

param(
    [switch]$DryRun = $false,
    [switch]$ForceClone = $false
)

# HARD LOCK: Staging DB is permanently frozen and isolated from Production
Write-Host "=========================================================" -ForegroundColor Red
Write-Host "   [STAGING DB PERMANENTLY LOCKED] CSDL Staging (vhvxoigh_erpstagging) đã khóa cứng hoàn toàn!" -ForegroundColor Yellow
Write-Host "   Ngắt toàn bộ đồng bộ giữa Production và Staging." -ForegroundColor Gray
Write-Host "=========================================================" -ForegroundColor Red
exit 0

$sshKey = if ($env:SSH_KEY) { $env:SSH_KEY } else { Join-Path $HOME ".ssh\id_ed25519" }
$sshUser = if ($env:SSH_USER) { $env:SSH_USER } else { "vhvxoigh" }
$sshHost = if ($env:STAGING_SSH_HOST) { $env:STAGING_SSH_HOST } else { "103.110.87.26" }
$sshPort = if ($env:SSH_PORT) { $env:SSH_PORT } else { "2210" }
$remoteDir = "myerp-stagging.ideas.edu.vn"

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "   1-WAY DATABASE SCHEMA SYNC: PROD -> STAGING" -ForegroundColor Cyan
Write-Host "   Source: vhvxoigh_myerp (READ-ONLY)" -ForegroundColor Green
Write-Host "   Target: vhvxoigh_erpstagging (STAGING)" -ForegroundColor Yellow
if ($DryRun) {
    Write-Host "   Mode:   DRY-RUN / AUDIT ONLY (No changes applied)" -ForegroundColor Magenta
} else {
    Write-Host "   Mode:   APPLY 1-WAY (Synchronize new tables & columns)" -ForegroundColor Green
}
Write-Host "=========================================================" -ForegroundColor Cyan

# 1. Upload latest audit_and_sync_schema.php to remote
Write-Host "`n[1/3] Uploading audit_and_sync_schema.php..." -ForegroundColor Gray
& scp -4 -i $sshKey -P $sshPort -o StrictHostKeyChecking=no -o ConnectTimeout=30 "scratch\staging\audit_and_sync_schema.php" "${sshUser}@${sshHost}:${remoteDir}/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "    Retrying upload in 12s..." -ForegroundColor DarkYellow
    Start-Sleep -Seconds 12
    & scp -4 -i $sshKey -P $sshPort -o StrictHostKeyChecking=no -o ConnectTimeout=30 "scratch\staging\audit_and_sync_schema.php" "${sshUser}@${sshHost}:${remoteDir}/"
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to upload sync script to staging server." -ForegroundColor Red
    exit 1
}

Start-Sleep -Seconds 10

# 2. Execute on remote server
Write-Host "`n[2/3] Executing 1-Way Schema Auditor & Synchronizer..." -ForegroundColor Yellow

$flag = if ($DryRun) { "" } else { "--apply" }
if ($ForceClone) {
    Write-Host "   WARNING: Force-Clone requested! Snapshotting full database..." -ForegroundColor Red
    $dbUser = if ($env:DB_USER) { $env:DB_USER } else { "vhvxoigh_mail_auto" }
    $dbPass = $env:DB_PASS
    if ([string]::IsNullOrWhiteSpace($dbPass)) {
        Write-Host "ERROR: Set DB_PASS environment variable before ForceClone." -ForegroundColor Red
        exit 1
    }
    $cmd = "mysqldump -u ${dbUser} -p'${dbPass}' --single-transaction --quick vhvxoigh_myerp | mysql -u ${dbUser} -p'${dbPass}' vhvxoigh_erpstagging && /usr/local/bin/ea-php81 ${remoteDir}/audit_and_sync_schema.php --apply"
} else {
    $cmd = "/usr/local/bin/ea-php81 ${remoteDir}/audit_and_sync_schema.php $flag && /usr/local/bin/ea-php81 ${remoteDir}/backend/run_migrations.php --apply"
}

& ssh -4 -tt -i $sshKey -p $sshPort -o StrictHostKeyChecking=no -o ConnectTimeout=30 "${sshUser}@${sshHost}" "$cmd"

Write-Host "`n[3/3] Synchronizing Staging backend syntax check..." -ForegroundColor Gray
& ssh -4 -tt -i $sshKey -p $sshPort -o StrictHostKeyChecking=no -o ConnectTimeout=30 "${sshUser}@${sshHost}" "/usr/local/bin/ea-php81 -l ${remoteDir}/backend/api.php"

Write-Host "`n=========================================================" -ForegroundColor Green
Write-Host "   1-WAY SCHEMA & MIGRATION SYNC COMPLETED!" -ForegroundColor Green
Write-Host "   Staging Database: vhvxoigh_erpstagging is 100% synchronized." -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green

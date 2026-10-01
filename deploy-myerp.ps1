# deploy-myerp.ps1
# High-Speed MYERP Deployment Pipeline -> https://myerp.ideas.edu.vn

param(
    [string]$RemoteDir = "myerp.ideas.edu.vn",
    [Alias("be")]
    [switch]$BackendOnly = $false,
    [Alias("fe")]
    [switch]$FrontendOnly = $false,
    [Alias("full")]
    [switch]$SyncMedia = $false,
    [switch]$SkipBuild = $false,
    [switch]$CheckTypes = $false,
    [switch]$CloneDatabase = $false
)

$sw = [System.Diagnostics.Stopwatch]::StartNew()

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "   MYERP HIGH-SPEED DEPLOYMENT -> https://myerp.ideas.edu.vn" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

$sshKey = "C:\Users\LENOVO\.ssh\id_ed25519"
$sshUser = "vhvxoigh"
$sshHost = "103.110.87.26"
$sshPort = "2210"

# 0. Smart Change Detection if neither BackendOnly nor FrontendOnly specified
if (-not $BackendOnly -and -not $FrontendOnly) {
    try {
        $gitDiff = git diff --name-only origin/main 2>$null
        if (-not $gitDiff) { $gitDiff = git diff --name-only HEAD~5 2>$null }
        $gitStatus = git status --porcelain 2>$null
        $allChanges = @($gitDiff) + @($gitStatus)
        $hasBE = $false
        $hasFE = $false

        foreach ($line in $allChanges) {
            if ([string]::IsNullOrWhiteSpace($line)) { continue }
            $clean = $line.Trim() -replace '^[MADRCU?! ]+\s+', ''
            if ($clean -like "backend/*") { $hasBE = $true }
            if ($clean -like "src/*" -or $clean -like "public/*" -or $clean -like "index.html" -or $clean -like "package.json") { $hasFE = $true }
        }

        if ($hasBE -and -not $hasFE) {
            Write-Host "[Auto-Detect] Chỉ phát hiện thay đổi Backend. Tự động kích hoạt Backend-Only (bỏ qua build FE)!" -ForegroundColor Magenta
            $BackendOnly = $true
        } elseif ($hasFE -and -not $hasBE) {
            Write-Host "[Auto-Detect] Chỉ phát hiện thay đổi Frontend. Tự động kích hoạt Frontend-Only (bỏ qua upload BE)!" -ForegroundColor Magenta
            $FrontendOnly = $true
        }
    } catch {}
}

# 1. Generate Unique Deployment Version Timestamp
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
# Stamp SW_VERSION in public/sw.js
$swPath = "$PSScriptRoot\public\sw.js"
if (Test-Path $swPath) {
    try {
        $swCode = Get-Content $swPath -Raw
        $swCode = $swCode -replace "const SW_VERSION = ['`"][^'`"]*['`"]", "const SW_VERSION = 'myerp-sw-v$deployVersion'"
        [System.IO.File]::WriteAllText($swPath, $swCode, [System.Text.Encoding]::UTF8)
    } catch {}
}

# 2. Ultra-Fast Vite Build (Instant 1.5s vs 35s tsc)
if (-not $BackendOnly) {
    if (-not $SkipBuild) {
        Write-Host "`n[1/3] Building Frontend UI Bundle with Vite (Ultra-fast)..." -ForegroundColor Yellow
        if ($CheckTypes) {
            Write-Host "  -> Running full TypeScript type check (-CheckTypes)..." -ForegroundColor DarkGray
            npx tsc -b
            if ($LASTEXITCODE -ne 0) {
                Write-Host "ERROR: TypeScript check failed. Aborting deployment." -ForegroundColor Red
                exit $LASTEXITCODE
            }
        }
        $env:GOMAXPROCS = "4"
        npx vite build
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: Frontend build failed. Aborting deployment." -ForegroundColor Red
            exit $LASTEXITCODE
        }
        Write-Host "  -> Frontend build completed successfully." -ForegroundColor Green
    } else {
        Write-Host "`n[1/3] Skipping Frontend build (-SkipBuild specified)..." -ForegroundColor DarkGray
    }
} else {
    Write-Host "`n[1/3] Skipping Frontend build (Backend-Only mode)..." -ForegroundColor DarkGray
}

# 3. Fast Packaging (Exclude static media already on server by default)
$backendArchive = "myerp_backend.tar.gz"
$distArchive = "myerp_dist.tar.gz"

Write-Host "`n[2/3] Packaging deployment archives..." -ForegroundColor Yellow

if (-not $FrontendOnly) {
    tar -czf "$backendArchive" --exclude="uploads/*" --exclude="*.log" -C backend .
    $beSize = [Math]::Round(((Get-Item $backendArchive).Length / 1MB), 2)
    Write-Host "  -> Backend archive: ${beSize} MB" -ForegroundColor Gray
}

if (-not $BackendOnly -and (Test-Path "dist")) {
    if ($SyncMedia) {
        Write-Host "  -> Packaging FULL dist (including stickers & media)..." -ForegroundColor DarkYellow
        tar -czf "$distArchive" -C dist .
    } else {
        tar -czf "$distArchive" --exclude="stickers" --exclude="stickers/*" --exclude="ideas_bot_kling.*" -C dist .
    }
    $feSize = [Math]::Round(((Get-Item $distArchive).Length / 1MB), 2)
    Write-Host "  -> Frontend dist archive (optimized): ${feSize} MB" -ForegroundColor Gray
}

# 4. Upload & Remote Deploy
Write-Host "`n[3/3] Uploading & deploying to remote server..." -ForegroundColor Yellow

$archivesToUpload = @()
if (-not $FrontendOnly -and (Test-Path "$backendArchive")) {
    $archivesToUpload += $backendArchive
}
if (-not $BackendOnly -and (Test-Path "$distArchive")) {
    $archivesToUpload += $distArchive
}

if ($archivesToUpload.Count -gt 0) {
    Write-Host "  -> Uploading archives ($($archivesToUpload -join ', '))..." -ForegroundColor Gray
    & scp -4 -i $sshKey -P $sshPort -o StrictHostKeyChecking=no -o ConnectTimeout=30 @archivesToUpload "${sshUser}@${sshHost}:${RemoteDir}/"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "    Retrying upload in 12s..." -ForegroundColor DarkYellow
        Start-Sleep -Seconds 12
        & scp -4 -i $sshKey -P $sshPort -o StrictHostKeyChecking=no -o ConnectTimeout=30 @archivesToUpload "${sshUser}@${sshHost}:${RemoteDir}/"
    }
}

# Allow SSH connection pool to settle
Start-Sleep -Seconds 12

$remoteCommands = @()
$remoteCommands += "mkdir -p ${RemoteDir}/backend ${RemoteDir}/backend/uploads"

if ($archivesToUpload -contains $backendArchive) {
    $remoteCommands += "tar -xzf ${RemoteDir}/${backendArchive} -C ${RemoteDir}/backend/ 2>/dev/null"
    $remoteCommands += "rm -f ${RemoteDir}/${backendArchive}"
    $remoteCommands += "/usr/local/bin/ea-php81 ${RemoteDir}/backend/run_migrations.php --apply"
    $remoteCommands += "cp -f ${RemoteDir}/version.json ${RemoteDir}/backend/version.json 2>/dev/null || true"
}

if ($archivesToUpload -contains $distArchive) {
    $remoteCommands += "tar -xzf ${RemoteDir}/${distArchive} -C ${RemoteDir}/ 2>/dev/null"
    $remoteCommands += "rm -f ${RemoteDir}/${distArchive}"
}

$remoteScript = $remoteCommands -join " && "

& ssh -4 -tt -i $sshKey -p $sshPort -o StrictHostKeyChecking=no -o ConnectTimeout=30 "${sshUser}@${sshHost}" "$remoteScript"
if ($LASTEXITCODE -ne 0) {
    Write-Host "    Retrying remote commands in 12s..." -ForegroundColor DarkYellow
    Start-Sleep -Seconds 12
    & ssh -4 -tt -i $sshKey -p $sshPort -o StrictHostKeyChecking=no -o ConnectTimeout=30 "${sshUser}@${sshHost}" "$remoteScript"
}

# 5. Clean up local temp archives
Remove-Item "$backendArchive" -ErrorAction SilentlyContinue
Remove-Item "$distArchive" -ErrorAction SilentlyContinue

$sw.Stop()
$elapsedSec = [Math]::Round($sw.Elapsed.TotalSeconds, 1)

Write-Host "`n=========================================================" -ForegroundColor Green
Write-Host "   DEPLOYMENT SUCCESSFUL in ${elapsedSec}s!" -ForegroundColor Green
Write-Host "   Live URL: https://myerp.ideas.edu.vn/" -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green

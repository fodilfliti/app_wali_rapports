#Requires -Version 5.1
<#
.SYNOPSIS
  Build frontend and zip only what cPanel File Manager needs.

.DESCRIPTION
  Creates deploy-out/:
    - wali-frontend-public_html.zip  → extract INTO public_html/
    - wali-api.zip                   → extract INTO ~/wali-api/ (then npm install on server)

  Never overwrites server-managed files:
    - public_html/.htaccess (customized on cPanel — not in zip)
    - wali-api/.env (secrets stay on server — not in zip)

  Skips: node_modules, env files, demo/dev/test seed scripts,
         local storage, docs, tests, old archives.
  Includes prod cabinet seeds only: seed-prod-bootstrap, seed-prod-ensure,
         load-env, lib/prodCabinetUsers, data/prodBootstrapInventory.

.EXAMPLE
  .\scripts\package-deploy.ps1
  .\scripts\package-deploy.ps1 -SkipBuild
#>
param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$OutDir = Join-Path $Root "deploy-out"
$Stamp = Get-Date -Format "yyyyMMdd-HHmm"
$FrontendZip = Join-Path $OutDir "wali-frontend-public_html-$Stamp.zip"
$BackendZip = Join-Path $OutDir "wali-api-$Stamp.zip"
$FrontendLatest = Join-Path $OutDir "wali-frontend-public_html.zip"
$BackendLatest = Join-Path $OutDir "wali-api.zip"

$FrontendDir = Join-Path $Root "frontend"
$BackendDir = Join-Path $Root "backend"

function Write-Step($msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Assert-Path($path, $label) {
  if (-not (Test-Path $path)) {
    throw "Missing $label`: $path"
  }
}

Write-Step "Prepare output folder"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Get-ChildItem $OutDir -Filter "wali-*-*.zip" -ErrorAction SilentlyContinue | Remove-Item -Force
Remove-Item $FrontendLatest, $BackendLatest -ErrorAction SilentlyContinue

# --- Frontend ---
if (-not $SkipBuild) {
  Write-Step "Build frontend (npm run build)"
  Push-Location $FrontendDir
  try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "frontend build failed (exit $LASTEXITCODE)" }
  }
  finally {
    Pop-Location
  }
}
else {
  Write-Step "SkipBuild: using existing frontend/dist"
}

$DistDir = Join-Path $FrontendDir "dist"
Assert-Path $DistDir "frontend/dist"
Assert-Path (Join-Path $DistDir "index.html") "frontend/dist/index.html"

Write-Step "Zip frontend → public_html package (no .htaccess)"
$FrontendStage = Join-Path $OutDir "_stage-frontend"
if (Test-Path $FrontendStage) { Remove-Item $FrontendStage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $FrontendStage | Out-Null
Copy-Item -Path (Join-Path $DistDir "*") -Destination $FrontendStage -Recurse -Force
# Do NOT copy .htaccess — cPanel copy is customized and must stay.
Compress-Archive -Path (Join-Path $FrontendStage "*") -DestinationPath $FrontendZip -Force
Copy-Item $FrontendZip $FrontendLatest -Force
Remove-Item $FrontendStage -Recurse -Force

# --- Backend ---
Write-Step "Zip backend → wali-api package (no env; prod seeds whitelisted)"
$BackendStage = Join-Path $OutDir "_stage-backend"
if (Test-Path $BackendStage) { Remove-Item $BackendStage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $BackendStage | Out-Null

# Prod runtime + migrations. Demo/dev/test seeds stay out of the zip.
$IncludeDirs = @("config", "src", "assets")
foreach ($dir in $IncludeDirs) {
  $src = Join-Path $BackendDir $dir
  if ($dir -eq "assets" -and -not (Test-Path $src)) { continue }
  Assert-Path $src "backend/$dir"
  Copy-Item -Path $src -Destination (Join-Path $BackendStage $dir) -Recurse -Force
}

$IncludeFiles = @(
  "package.json",
  "package-lock.json",
  ".sequelizerc"
)
foreach ($file in $IncludeFiles) {
  $src = Join-Path $BackendDir $file
  Assert-Path $src "backend/$file"
  Copy-Item -Path $src -Destination (Join-Path $BackendStage $file) -Force
}

# Whitelist prod cabinet scripts only (wipe once + safe ensure).
$ProdScriptFiles = @(
  "scripts\load-env.js",
  "scripts\seed-prod-bootstrap.js",
  "scripts\seed-prod-ensure.js",
  "scripts\ensure-fiche-lecture-types.js",
  "scripts\regenerate-credentials-handout-pdf.js",
  "scripts\lib\prodCabinetUsers.js",
  "scripts\data\prodBootstrapInventory.js"
)
foreach ($rel in $ProdScriptFiles) {
  $src = Join-Path $BackendDir $rel
  Assert-Path $src "backend/$rel"
  $dest = Join-Path $BackendStage $rel
  $destDir = Split-Path $dest -Parent
  New-Item -ItemType Directory -Force -Path $destDir | Out-Null
  Copy-Item -Path $src -Destination $dest -Force
}

Get-ChildItem $BackendStage -Recurse -File -Include `
  "*.log", "*.rar", "*.zip", "tmp-*", ".DS_Store", "Thumbs.db" |
  Remove-Item -Force -ErrorAction SilentlyContinue

Compress-Archive -Path (Join-Path $BackendStage "*") -DestinationPath $BackendZip -Force

# Compress-Archive can miss dotfiles — ensure .sequelizerc is present
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($BackendZip, [System.IO.Compression.ZipArchiveMode]::Update)
try {
  $hasSequelize = $zip.Entries | Where-Object { $_.FullName -eq ".sequelizerc" }
  if (-not $hasSequelize) {
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $zip,
      (Join-Path $BackendStage ".sequelizerc"),
      ".sequelizerc"
    ) | Out-Null
  }
}
finally {
  $zip.Dispose()
}

Copy-Item $BackendZip $BackendLatest -Force
Remove-Item $BackendStage -Recurse -Force

Write-Step "Done"
Write-Host ""
Write-Host "Upload these (also copied without timestamp):" -ForegroundColor Green
Write-Host "  Frontend → public_html/ : $FrontendLatest"
Write-Host "  Backend  → wali-api/    : $BackendLatest"
Write-Host ""
Write-Host "Skipped on purpose (do not overwrite on server):"
Write-Host "  - public_html/.htaccess (your cPanel version)"
Write-Host "  - wali-api/.env and any env templates"
Write-Host "  - demo/dev/test seed scripts (prod bootstrap + ensure are included)"
Write-Host "  - node_modules (Run NPM Install on cPanel)"
Write-Host "  - local storage/, uploads, docs, frontend src"
Write-Host ""
Get-ChildItem $OutDir -Filter "wali-*.zip" | Format-Table Name, @{N = "MB"; E = { "{0:N1}" -f ($_.Length / 1MB) } }, LastWriteTime

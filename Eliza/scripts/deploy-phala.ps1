# Interactive Phala deploy via Docker Hub.
# Run from repo root:  .\scripts\deploy-phala.ps1
# Requires: Docker Desktop running, `phala` CLI on PATH, `.env` with model + KH_API_KEY (and optional Postgres).

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $Root

function Test-CommandExists {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Set-EnvFileDockerImage {
    param(
        [string]$EnvPath,
        [string]$ImageRef
    )
    $line = "DOCKER_IMAGE=$ImageRef"
    if (-not (Test-Path $EnvPath)) {
        Set-Content -Path $EnvPath -Value @($line, '') -Encoding utf8
        Write-Host "Created $EnvPath with DOCKER_IMAGE only. Merge other vars from .env.example if needed."
        return
    }
    $lines = Get-Content -Path $EnvPath
    $found = $false
    $out = foreach ($l in $lines) {
        if ($l -match '^\s*DOCKER_IMAGE=') {
            $found = $true
            $line
        }
        else {
            $l
        }
    }
    if (-not $found) {
        $out = @($out) + $line
    }
    Set-Content -Path $EnvPath -Value ($out -join "`n") -Encoding utf8
}

Write-Host "`n=== Phala + Docker Hub deploy ===`n"

if (-not (Test-CommandExists 'phala')) {
    Write-Error "Phala CLI not found. Install it (e.g. npm i -g phala) and ensure it is on PATH."
    exit 1
}

$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker does not appear to be running. Start Docker Desktop and retry."
    exit 1
}

if (-not $env:PHALA_CLOUD_API_KEY) {
    $env:PHALA_CLOUD_API_KEY = Read-Host 'Phala API key (dashboard → API Tokens)'
}
if (-not $env:PHALA_CLOUD_API_KEY) {
    Write-Error "PHALA_CLOUD_API_KEY is required."
    exit 1
}

Write-Host "`n--- Docker Hub (used by Phala for build/push) ---`n"
$hubUser = Read-Host 'Docker Hub username'
if (-not $hubUser) {
    Write-Error "Docker Hub username is required."
    exit 1
}
$securePass = Read-Host 'Docker Hub password or access token' -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass)
try {
    $hubPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}
finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
}

Write-Host "`nLogging in to Docker Hub via Phala..."
& phala docker login --api-key $env:PHALA_CLOUD_API_KEY -u $hubUser -p $hubPass
$loginExit = $LASTEXITCODE
$hubPass = $null
if ($loginExit -ne 0) {
    Write-Error "phala docker login failed."
    exit $loginExit
}

$repo = Read-Host 'Docker Hub repository name (image repo only, default: keepers-eliza)'
if (-not $repo) { $repo = 'keepers-eliza' }
$tag = Read-Host 'Image tag (default: v1.0.0)'
if (-not $tag) { $tag = 'v1.0.0' }

$imageForBuild = "$hubUser/$repo"
$imageFull = "${hubUser}/${repo}:${tag}"

Write-Host "`nBuilding image (monorepo; can take many minutes): $imageFull"
& phala docker build --api-key $env:PHALA_CLOUD_API_KEY --image $imageForBuild --tag $tag --file Dockerfile
if ($LASTEXITCODE -ne 0) {
    Write-Error "phala docker build failed."
    exit $LASTEXITCODE
}

Write-Host "`nPushing to Docker Hub: $imageFull"
& phala docker push --api-key $env:PHALA_CLOUD_API_KEY --image $imageFull
if ($LASTEXITCODE -ne 0) {
    Write-Error "phala docker push failed."
    exit $LASTEXITCODE
}

$envFile = Join-Path $Root '.env'
Set-EnvFileDockerImage -EnvPath $envFile -ImageRef $imageFull
Write-Host "`nSet DOCKER_IMAGE=$imageFull in .env"

$cvmName = Read-Host 'Phala CVM name (default: keepers-eliza)'
if (-not $cvmName) { $cvmName = 'keepers-eliza' }

$composeFile = Join-Path $Root 'docker-compose.phala.yaml'
Write-Host "`nDeploying to Phala (compose: docker-compose.phala.yaml, env: .env)..."
& phala deploy --api-key $env:PHALA_CLOUD_API_KEY --name $cvmName --compose $composeFile -e $envFile --wait
if ($LASTEXITCODE -ne 0) {
    Write-Error "phala deploy failed."
    exit $LASTEXITCODE
}

Write-Host "`nDone. In the Phala dashboard: Network → Endpoint #1 for the public URL.`n"

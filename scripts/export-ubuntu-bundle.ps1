$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$releaseRoot = Join-Path $root "release"
$bundleRoot = Join-Path $releaseRoot "opvm-ubuntu16-bundle"

Write-Host "Building frontend..."
Push-Location $root
try {
    npm.cmd run build
}
finally {
    Pop-Location
}

if (Test-Path $bundleRoot) {
    Remove-Item -LiteralPath $bundleRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $bundleRoot | Out-Null
$bundleSupabase = Join-Path $bundleRoot "supabase"
New-Item -ItemType Directory -Path $bundleSupabase | Out-Null

Write-Host "Copying deployment files..."
Copy-Item -Recurse -Force (Join-Path $root "dist") (Join-Path $bundleRoot "dist")
Copy-Item -Force (Join-Path $root "supabase/config.toml") (Join-Path $bundleSupabase "config.toml")
Copy-Item -Recurse -Force (Join-Path $root "supabase/migrations") (Join-Path $bundleSupabase "migrations")
Copy-Item -Recurse -Force (Join-Path $root "supabase/functions") (Join-Path $bundleSupabase "functions")
Copy-Item -Force (Join-Path $root ".env.example") (Join-Path $bundleRoot ".env.example")
Copy-Item -Recurse -Force (Join-Path $root "deployment/nginx") (Join-Path $bundleRoot "nginx")
Copy-Item -Force (Join-Path $root "deployment/ubuntu16/README.ar.md") (Join-Path $bundleRoot "README.ar.md")

$zipPath = Join-Path $releaseRoot "opvm-ubuntu16-bundle.zip"
if (Test-Path $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

Write-Host "Compressing bundle..."
Compress-Archive -Path (Join-Path $bundleRoot "*") -DestinationPath $zipPath

Write-Host ""
Write-Host "Bundle created successfully:"
Write-Host "Folder: $bundleRoot"
Write-Host "Zip   : $zipPath"

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifest = Get-Content (Join-Path $projectRoot "manifest.json") -Raw | ConvertFrom-Json
$distDirectory = Join-Path $projectRoot "dist"
$archive = Join-Path $distDirectory ("otnow-{0}.zip" -f $manifest.version)

New-Item -ItemType Directory -Force -Path $distDirectory | Out-Null

$releaseFiles = @(
  "manifest.json",
  "src",
  "panel",
  "options",
  "icons",
  "LICENSE",
  "README.md",
  "UPDATE_GUIDE.md",
  "PRIVACY.md",
  "THIRD_PARTY_NOTICES.md"
) | ForEach-Object { Join-Path $projectRoot $_ }

Compress-Archive -Path $releaseFiles -DestinationPath $archive -Force

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($archive)
try {
  $entryNames = @($zip.Entries | ForEach-Object { $_.FullName.Replace("\\", "/") })
  if ($entryNames -notcontains "manifest.json") {
    throw "The release ZIP is invalid: manifest.json is not at the archive root."
  }
  if ($entryNames | Where-Object { $_ -match "^[^/]+/manifest\.json$" }) {
    throw "The release ZIP is invalid: manifest.json is nested inside another folder."
  }
} finally {
  $zip.Dispose()
}

Write-Output $archive

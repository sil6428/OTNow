$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifest = Get-Content (Join-Path $projectRoot "manifest.firefox.json") -Raw | ConvertFrom-Json
$distDirectory = Join-Path $projectRoot "dist"
$archive = Join-Path $distDirectory ("otnow-firefox-source-{0}.zip" -f $manifest.version)
$stage = Join-Path $distDirectory ("firefox-source-stage-{0}" -f [guid]::NewGuid().ToString("N"))

New-Item -ItemType Directory -Force -Path $distDirectory | Out-Null
New-Item -ItemType Directory -Path $stage | Out-Null

$sourceItems = @(
  "src",
  "panel",
  "options",
  "icons",
  "scripts\package-firefox.ps1",
  "manifest.firefox.json",
  "FIREFOX_SOURCE_README.md",
  "LICENSE",
  "PRIVACY.md",
  "THIRD_PARTY_NOTICES.md"
)

try {
  foreach ($item in $sourceItems) {
    $source = Join-Path $projectRoot $item
    $destinationParent = Split-Path (Join-Path $stage $item) -Parent
    New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
    Copy-Item -LiteralPath $source -Destination (Join-Path $stage $item) -Recurse
  }

  Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $archive -Force

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::OpenRead($archive)
  try {
    $entryNames = @($zip.Entries | ForEach-Object { $_.FullName.Replace("\", "/") })
    foreach ($required in @("manifest.firefox.json", "FIREFOX_SOURCE_README.md", "scripts/package-firefox.ps1")) {
      if ($entryNames -notcontains $required) {
        throw "The Firefox source ZIP is missing $required."
      }
    }
    if ($entryNames | Where-Object { $_ -match "(^|/)(dist|node_modules|\.git)/" }) {
      throw "The Firefox source ZIP contains a generated or repository-only directory."
    }
  } finally {
    $zip.Dispose()
  }
} finally {
  $resolvedStage = [System.IO.Path]::GetFullPath($stage)
  $resolvedDist = [System.IO.Path]::GetFullPath($distDirectory) + [System.IO.Path]::DirectorySeparatorChar
  if (-not $resolvedStage.StartsWith($resolvedDist, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove a staging path outside the dist directory."
  }
  if (Test-Path -LiteralPath $resolvedStage) {
    Remove-Item -LiteralPath $resolvedStage -Recurse -Force
  }
}

Write-Output $archive

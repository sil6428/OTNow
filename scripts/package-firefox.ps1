$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifest = Get-Content (Join-Path $projectRoot "manifest.firefox.json") -Raw | ConvertFrom-Json
$distDirectory = Join-Path $projectRoot "dist"
$archive = Join-Path $distDirectory ("otnow-firefox-{0}.zip" -f $manifest.version)
$stage = Join-Path $distDirectory ("firefox-stage-{0}" -f [guid]::NewGuid().ToString("N"))

New-Item -ItemType Directory -Force -Path $distDirectory | Out-Null
New-Item -ItemType Directory -Path $stage | Out-Null

$releaseItems = @(
  "src",
  "panel",
  "options",
  "icons",
  "LICENSE",
  "PRIVACY.md",
  "THIRD_PARTY_NOTICES.md"
)

try {
  foreach ($item in $releaseItems) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $item) -Destination $stage -Recurse
  }

  Copy-Item -LiteralPath (Join-Path $projectRoot "manifest.firefox.json") -Destination (Join-Path $stage "manifest.json")

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  $constantsPath = Join-Path $stage "src\constants.js"
  $constants = Get-Content $constantsPath -Raw
  $constants = $constants.Replace("export const UPDATE_CHECK_ENABLED = true;", "export const UPDATE_CHECK_ENABLED = false;")
  $constants = $constants.Replace('export const UPDATE_MANIFEST_URL = "https://raw.githubusercontent.com/sil6428/OTNow/main/manifest.json";', 'export const UPDATE_MANIFEST_URL = "";')
  if ($constants -notmatch "UPDATE_CHECK_ENABLED = false" -or $constants -match "raw\.githubusercontent\.com") {
    throw "The Firefox package could not disable the manual update check."
  }
  [System.IO.File]::WriteAllText($constantsPath, $constants, $utf8NoBom)

  Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $archive -Force

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::OpenRead($archive)
  try {
    $entryNames = @($zip.Entries | ForEach-Object { $_.FullName.Replace("\", "/") })
    if ($entryNames -notcontains "manifest.json") {
      throw "The Firefox ZIP is invalid: manifest.json is not at the archive root."
    }
    if ($entryNames | Where-Object { $_ -match "^[^/]+/manifest\.json$" }) {
      throw "The Firefox ZIP is invalid: manifest.json is nested inside another folder."
    }
    if ($entryNames -contains "manifest.firefox.json") {
      throw "The Firefox ZIP unexpectedly contains its source manifest template."
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

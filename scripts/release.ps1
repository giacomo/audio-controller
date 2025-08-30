<#
.SYNOPSIS
Bump package.json version, commit, tag and create GitHub release.

USAGE
# Patch bump (default)
.\scripts\release.ps1

# Minor bump
.\scripts\release.ps1 -bump minor

# Explicit version
.\scripts\release.ps1 -version 1.2.3
#>
param(
  [ValidateSet('patch','minor','major')]
  [string]$bump = 'patch',
  [string]$version = '',
  [switch]$allowDirty,
  [switch]$stageAll
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Helpers
function Run-Git {
  param(
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$args
  )
  & git @args
}
function ExitWith($msg, $code=1) { Write-Error $msg; exit $code }

$repoRoot = (Resolve-Path -Path (Join-Path $PSScriptRoot '..')) | Select-Object -ExpandProperty Path
$pkgPath = Join-Path $repoRoot 'package.json'
if (-not (Test-Path $pkgPath)) { ExitWith "package.json not found at $pkgPath" }

# Read package.json
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
$current = $pkg.version
if (-not $current) { ExitWith "No version found in package.json" }

# Compute new version
if ($version -ne '') {
  $new = $version
} else {
  $parts = $current.Split('.')
  if ($parts.Count -lt 3) { ExitWith "Current version '$current' is not semver (x.y.z)" }
  [int]$major = [int]$parts[0]; [int]$minor = [int]$parts[1]; [int]$patch = [int]$parts[2]
  switch ($bump) {
    'patch' { $patch++ }
    'minor' { $minor++; $patch = 0 }
    'major' { $major++; $minor = 0; $patch = 0 }
  }
  $new = "$major.$minor.$patch"
}

Write-Host "Current version: $current -> New version: $new"

# Check working tree clean
# Capture git porcelain output safely (can be null if git returns nothing)
$porcelainObj = & git status --porcelain 2>$null
$porcelain = ''
if ($porcelainObj) { $porcelain = $porcelainObj -join "`n" }

if ($porcelain.ToString().Trim() -ne '') {
  if ($stageAll) {
  Write-Host "Staging all changes as requested by -stageAll..."
  Run-Git 'add' '-A'
    try {
      Run-Git commit -m "chore(release): include working-tree changes before bump"
    } catch {
      Write-Host "No staged changes to commit or commit skipped: $($_.Exception.Message)"
    }
  } elseif ($allowDirty) {
    Write-Warning "Working tree is not clean, but continuing because -allowDirty was provided."
  } else {
    ExitWith "Working tree is not clean. Commit or stash changes before running this script, or rerun with -allowDirty or -stageAll."
  }
}

# Update package.json
$pkg.version = $new
# Write with pretty formatting
$pkg | ConvertTo-Json -Depth 20 | Out-File -FilePath $pkgPath -Encoding UTF8

# Git commit & tag
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "On branch: $branch"

Run-Git 'add' 'package.json'
try {
  # Append [ci skip] to avoid triggering CI jobs for the automated release commit
  Run-Git 'commit' '-m' "chore(release): v$new [ci skip]"
} catch {
  # If commit fails because nothing changed, continue
  if ($_.Exception.Message -match 'nothing to commit') {
    Write-Host "No changes to commit (package.json unchanged)."
  } else {
    ExitWith "Git commit failed: $($_.Exception.Message)"
  }
}

# Create annotated tag (fail if exists)
$tagName = "v$new"
$existingTag = git tag --list $tagName
if ($existingTag) {
  ExitWith "Tag $tagName already exists. Aborting."
}
Run-Git 'tag' '-a' $tagName '-m' "Release $tagName"

# Push branch and tag
Run-Git 'push' 'origin' $branch
Run-Git 'push' 'origin' $tagName

# Create GitHub release with gh (if available)
if (Get-Command gh -ErrorAction SilentlyContinue) {
  Write-Host "Creating GitHub release $tagName..."
  gh release create $tagName --title $tagName --notes "Release $tagName"
  Write-Host "GitHub release created."
} else {
  $cmd = "gh release create $tagName --title $tagName --notes 'Release $tagName'"
  $msg = "gh CLI not found. Tag pushed, but GitHub release was not created. Install and run: $cmd"
  Write-Warning $msg
}

Write-Host "Done."
# UT-ECE Cache Purge Script (PowerShell Runner)
param(
  [string]$Target = "https://ut.medanaee.ir",
  [switch]$Local = $false,
  [string]$Secret = "ut-ece-purge-cache-secret-2026"
)

$argsList = @()
if ($Local) {
  $argsList += "--local"
} else {
  $argsList += "--target=$Target"
}

if ($Secret) {
  $argsList += "--secret=$Secret"
}

node "$PSScriptRoot/purge-cache.mjs" @argsList

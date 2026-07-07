# Deploy all Vanguard functions that require verify_jwt: false
# Usage: .\scripts\ops\deploy-no-jwt.ps1
#        .\scripts\ops\deploy-no-jwt.ps1 vanguard-telegram vanguard-oracle

$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot "..\.."))

$all = @(
  "vanguard-daily-reconciliation",
  "vanguard-weekly-synthesis",
  "vanguard-telegram",
  "vanguard-telegram-worker",
  "vanguard-oracle",
  "vanguard-auto-classify",
  "vanguard-architect",
  "vanguard-wiki-compiler",
  "ingest-vault-log",
  "vanguard-analyst",
  "vanguard-eval-runner",
  "vanguard-eval-interview",
  "vanguard-graph-embedder",
  "save-daily-aggregate",
  "sync-strava",
  "analyze-training-load",
  "vanguard-nutrition-coach",
  "vanguard-librarian",
  "compute-illness-signal",
  "rescore-workout-sessions",
  "vanguard-push-reminder",
  "vanguard-capture",
  "vanguard-search",
  "vanguard-keep-triage"
)

$targets = if ($args.Count -gt 0) { $args } else { $all }

Write-Host "Deploying $($targets.Count) function(s) with --no-verify-jwt ..." -ForegroundColor Cyan

foreach ($fn in $targets) {
  Write-Host "`n>> supabase functions deploy $fn --no-verify-jwt" -ForegroundColor Yellow
  supabase functions deploy $fn --no-verify-jwt
  if ($LASTEXITCODE -ne 0) {
    throw "Deploy failed: $fn"
  }
}

Write-Host "`nDone. Run smoke:" -ForegroundColor Green
Write-Host "  node scripts/ops/smoke-vanguard.mjs --with-service-role"

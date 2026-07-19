# Deploy all Vanguard functions that require verify_jwt: false
# Usage: .\scripts\ops\deploy-no-jwt.ps1
#        .\scripts\ops\deploy-no-jwt.ps1 vanguard-telegram vanguard-oracle

$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot "..\.."))

$all = @(
  "analyze-food-quality",
  "analyze-training-load",
  "calendar-write",
  "compute-behavior-effects",
  "parse-food-nl",
  "parse-workout-nl",
  "recap",
  "sync",
  "vanguard-analyst",
  "vanguard-architect",
  "vanguard-auto-classify",
  "vanguard-backtester",
  "vanguard-capture",
  "vanguard-eval-interview",
  "vanguard-eval-runner",
  "vanguard-graph-embedder",
  "vanguard-keep-triage",
  "vanguard-kpi-suggest",
  "vanguard-librarian",
  "vanguard-mcp-server",
  "vanguard-metabolism",
  "vanguard-nightly",
  "vanguard-nutrition-coach",
  "vanguard-oracle",
  "vanguard-outbox-sender",
  "vanguard-push-reminder",
  "vanguard-telegram",
  "vanguard-telegram-worker",
  "vanguard-wiki-compiler"
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

$url = "https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/vanguard-architect"
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkdnFrZ2ZzcXppcWxocHRhdGdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODQ0NzgsImV4cCI6MjA5Mjk2MDQ3OH0.vM69FS8w1K3N_eJjD7LLYxi59T2xCnMH1STEsAICyqU"

function Run-Batch($type, $count) {
    Write-Host "--- Processing $type ($count items) ---" -ForegroundColor Cyan
    for ($i=0; $i -lt $count; $i+=10) {
        $body = @{ type = $type; offset = $i; limit = 10 } | ConvertTo-Json
        Write-Host "Batch offset $i..." -NoNewline
        $res = Invoke-RestMethod -Uri $url -Method Post -Headers @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" } -Body $body
        Write-Host " Done. Triads created: $($res.triads_created)" -ForegroundColor Green
    }
}

Run-Batch "knowledge" 130
Run-Batch "stream" 130

Write-Host "ALL ARCHIVAL DATA PROCESSED! Refresh your Graph Dashboard now." -ForegroundColor Gold

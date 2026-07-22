import os, json, subprocess

# Load parsed report data
with open("tmp/report_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

summary = data.get("summary", {})
weather = data.get("weather", {})
zones = data.get("zones", [])

html_content = """<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<title>Raport Interwały — Jakub Soboń — 22.07.2026</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#1e293b;background:#f8fafc;line-height:1.4;}
  .page{max-width:840px;margin:0 auto;padding:24px 28px;background:#ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.05);}
  
  .header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #fc4c02;padding-bottom:12px;margin-bottom:16px;}
  .title{font-size:20px;font-weight:700;color:#0f172a;letter-spacing:-0.3px;}
  .subtitle{font-size:11px;color:#64748b;margin-top:3px;font-weight:500;}
  .header-right{text-align:right;font-size:11px;color:#64748b;line-height:1.5;}
  .badge-orange{background:#fff7ed;color:#ea580c;border:1px solid #ffedd5;padding:2px 8px;border-radius:12px;font-weight:600;font-size:10px;display:inline-block;}

  .section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;display:flex;align-items:center;gap:8px;margin:16px 0 10px;}
  .section-title::after{content:'';flex:1;height:1px;background:#e2e8f0;}

  .grid-metrics{display:grid;grid-template-columns:repeat(4, 1fr);gap:10px;margin-bottom:14px;}
  .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;}
  .card-highlight{background:#fff7ed;border-color:#ffedd5;}
  .card-green{background:#f0fdf4;border-color:#dcfce7;}
  .card-red{background:#fef2f2;border-color:#fee2e2;}
  .card-blue{background:#eff6ff;border-color:#dbeafe;}
  .card-purple{background:#faf5ff;border-color:#f3e8ff;}

  .card-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;margin-bottom:3px;}
  .card-value{font-size:22px;font-weight:800;color:#0f172a;line-height:1.1;}
  .card-sub{font-size:10px;color:#64748b;margin-top:3px;}

  .grid-structure{display:grid;grid-template-columns:1fr 2fr 1fr;gap:10px;margin-bottom:14px;}
  
  .table-container{margin-bottom:16px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;}
  table{width:100%;border-collapse:collapse;font-size:11px;}
  th{background:#f1f5f9;color:#475569;font-weight:700;text-align:left;padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;}
  td{padding:6px 10px;border-bottom:1px solid #f1f5f9;color:#334155;}
  tr:last-child td{border-bottom:none;}
  tr.row-fast{background:#fff7ed;}
  tr.row-slow{background:#ffffff;}
  tr.row-warmup{background:#f8fafc;}

  .tag{display:inline-block;padding:2px 6px;border-radius:4px;font-weight:700;font-size:10px;}
  .tag-fast{background:#ea580c;color:#ffffff;}
  .tag-slow{background:#22c55e;color:#ffffff;}
  .tag-warmup{background:#94a3b8;color:#ffffff;}

  .bar-bg{height:16px;background:#e2e8f0;border-radius:4px;overflow:hidden;position:relative;width:100%;}
  .bar-fill{height:100%;border-radius:4px;}

  .grid-insights{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;}
  .insight-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;}
  .insight-title{font-size:11px;font-weight:700;color:#0f172a;margin-bottom:4px;display:flex;align-items:center;gap:6px;}

  .footer{border-top:1px solid #e2e8f0;padding-top:10px;margin-top:16px;font-size:9px;color:#94a3b8;display:flex;justify-space-between;}

  @media print{
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
    body{background:#fff;padding:0;}
    .page{max-width:100%;padding:12mm 15mm;box-shadow:none;}
    @page{margin:0;size:A4 portrait;}
  }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div>
      <div class="title">🏃 Raport Treningowy — 6× 1 km Interwał</div>
      <div class="subtitle">Jakub Soboń · Krosno · Środa 22.07.2026 · 20:21 · Garmina Forerunner 45</div>
    </div>
    <div class="header-right">
      <span class="badge-orange">GARMIN CONNECT API</span>
      <div style="margin-top:4px;">Strefa HR: <strong>Z4 / Z5 (65.5 min)</strong></div>
    </div>
  </div>

  <!-- MAIN METRICS GRID -->
  <div class="grid-metrics">
    <div class="card card-green">
      <div class="card-label">Dystans total</div>
      <div class="card-value" style="color:#15803d;">12.12 <span style="font-size:14px;font-weight:600;">km</span></div>
      <div class="card-sub">Moving time: 72:24 (5:58/km)</div>
    </div>
    <div class="card card-red">
      <div class="card-label">Tętno (HR avg / max)</div>
      <div class="card-value" style="color:#dc2626;">172 <span style="font-size:14px;font-weight:600;">bpm</span></div>
      <div class="card-sub">Max HR: 190 bpm (Z5)</div>
    </div>
    <div class="card card-highlight">
      <div class="card-label">Najszybszy km</div>
      <div class="card-value" style="color:#c2410c;">4:42 <span style="font-size:14px;font-weight:600;">/km</span></div>
      <div class="card-sub">Interwał #6 (Km 12) · Kadencja 177</div>
    </div>
    <div class="card card-blue">
      <div class="card-label">Jakość Z4 + Z5</div>
      <div class="card-value" style="color:#1d4ed8;">65:48 <span style="font-size:14px;font-weight:600;">min</span></div>
      <div class="card-sub">Z4: 36:08 · Z5: 29:40</div>
    </div>
  </div>

  <!-- SECONDARY METRICS GRID -->
  <div class="grid-metrics" style="margin-bottom:16px;">
    <div class="card">
      <div class="card-label">Kadencja avg / max</div>
      <div class="card-value" style="font-size:18px;">162 / 185 <span style="font-size:12px;font-weight:500;">spm</span></div>
      <div class="card-sub">Długość kroku: 1.03 m</div>
    </div>
    <div class="card">
      <div class="card-label">Spalone Kalorie</div>
      <div class="card-value" style="font-size:18px;">866 <span style="font-size:12px;font-weight:500;">kcal</span></div>
      <div class="card-sub">Przewyższenie: +37 m</div>
    </div>
    <div class="card">
      <div class="card-label">Pogoda</div>
      <div class="card-value" style="font-size:18px;">18°C <span style="font-size:12px;font-weight:500;">Clear</span></div>
      <div class="card-sub">Wilgotność: 41% · Wiatr 2 m/s</div>
    </div>
    <div class="card card-purple">
      <div class="card-label">Wskaźnik VO2max</div>
      <div class="card-value" style="font-size:18px;color:#6b21a8;">43.0 <span style="font-size:12px;font-weight:500;">ml/kg</span></div>
      <div class="card-sub">Fitness Age: 29 lat</div>
    </div>
  </div>

  <!-- STRUCTURE -->
  <div class="section-title">Struktura Treningu</div>
  <div class="grid-structure">
    <div class="card">
      <div class="card-label">Rozgrzewka</div>
      <div style="font-size:16px;font-weight:700;color:#334155;">2.0 km</div>
      <div class="card-sub">1 km trucht (7:55) + 1 km akcent (4:55)</div>
    </div>
    <div class="card card-highlight">
      <div class="card-label">Seria Główna Interwałów</div>
      <div style="font-size:16px;font-weight:700;color:#c2410c;">6× 1 km Szybki + 5× 1 km Trucht</div>
      <div class="card-sub">Szybkie: 4:58 → 4:57 → 4:58 → 4:45 → 4:42/km · Truchty: ~6:40-7:28/km</div>
    </div>
    <div class="card">
      <div class="card-label">Schłodzenie</div>
      <div style="font-size:16px;font-weight:700;color:#334155;">113 m</div>
      <div class="card-sub">Marsz / Uspokojenie organizmu</div>
    </div>
  </div>

  <!-- KM BREAKDOWN TABLE -->
  <div class="section-title">Szczegółowy Podział na Kilometry (1 km Splits)</div>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th style="width:36px;">Km</th>
          <th style="width:130px;">Typ Odcinka</th>
          <th style="width:65px;">Czas</th>
          <th style="width:75px;">Tempo</th>
          <th style="width:110px;">Wykres Tempa</th>
          <th style="width:65px;text-align:right;">HR avg</th>
          <th style="width:65px;text-align:right;">HR max</th>
          <th style="width:75px;text-align:right;">Kadencja</th>
        </tr>
      </thead>
      <tbody>
        <tr class="row-warmup">
          <td><strong>1</strong></td>
          <td><span class="tag tag-warmup">Rozgrzewka #1</span></td>
          <td>7:58</td>
          <td><strong>7:55/km</strong></td>
          <td><div class="bar-bg"><div class="bar-fill" style="width:35%;background:#94a3b8;"></div></div></td>
          <td style="text-align:right;">153 bpm</td>
          <td style="text-align:right;">168 bpm</td>
          <td style="text-align:right;">163 spm</td>
        </tr>
        <tr class="row-fast">
          <td><strong>2</strong></td>
          <td><span class="tag tag-fast">Pobudzenie #0</span></td>
          <td>4:54</td>
          <td><strong style="color:#c2410c;">4:55/km</strong></td>
          <td><div class="bar-bg"><div class="bar-fill" style="width:82%;background:#ea580c;"></div></div></td>
          <td style="text-align:right;font-weight:700;color:#dc2626;">173 bpm</td>
          <td style="text-align:right;color:#dc2626;">186 bpm</td>
          <td style="text-align:right;">176 spm</td>
        </tr>
        <tr class="row-slow">
          <td><strong>3</strong></td>
          <td><span class="tag tag-slow">Odpoczynek</span></td>
          <td>7:07</td>
          <td><strong>6:59/km</strong></td>
          <td><div class="bar-bg"><div class="bar-fill" style="width:46%;background:#22c55e;"></div></div></td>
          <td style="text-align:right;">169 bpm</td>
          <td style="text-align:right;">186 bpm</td>
          <td style="text-align:right;">160 spm</td>
        </tr>
        <tr class="row-fast">
          <td><strong>4</strong></td>
          <td><span class="tag tag-fast">Interwał #1</span></td>
          <td>4:56</td>
          <td><strong style="color:#c2410c;">4:58/km</strong></td>
          <td><div class="bar-bg"><div class="bar-fill" style="width:80%;background:#ea580c;"></div></div></td>
          <td style="text-align:right;font-weight:700;color:#dc2626;">181 bpm</td>
          <td style="text-align:right;color:#dc2626;">188 bpm</td>
          <td style="text-align:right;">174 spm</td>
        </tr>
        <tr class="row-slow">
          <td><strong>5</strong></td>
          <td><span class="tag tag-slow">Trucht #1</span></td>
          <td>7:30</td>
          <td><strong>7:28/km</strong></td>
          <td><div class="bar-bg"><div class="bar-fill" style="width:40%;background:#22c55e;"></div></div></td>
          <td style="text-align:right;color:#166534;font-weight:600;">162 bpm</td>
          <td style="text-align:right;">183 bpm</td>
          <td style="text-align:right;">157 spm</td>
        </tr>
        <tr class="row-fast">
          <td><strong>6</strong></td>
          <td><span class="tag tag-fast">Interwał #2</span></td>
          <td>4:54</td>
          <td><strong style="color:#c2410c;">4:57/km</strong></td>
          <td><div class="bar-bg"><div class="bar-fill" style="width:81%;background:#ea580c;"></div></div></td>
          <td style="text-align:right;font-weight:700;color:#dc2626;">182 bpm</td>
          <td style="text-align:right;color:#dc2626;">185 bpm</td>
          <td style="text-align:right;">174 spm</td>
        </tr>
        <tr class="row-slow">
          <td><strong>7</strong></td>
          <td><span class="tag tag-slow">Trucht #2</span></td>
          <td>7:04</td>
          <td><strong>7:01/km</strong></td>
          <td><div class="bar-bg"><div class="bar-fill" style="width:45%;background:#22c55e;"></div></div></td>
          <td style="text-align:right;color:#166534;font-weight:600;">167 bpm</td>
          <td style="text-align:right;">185 bpm</td>
          <td style="text-align:right;">162 spm</td>
        </tr>
        <tr class="row-fast">
          <td><strong>8</strong></td>
          <td><span class="tag tag-fast">Interwał #3</span></td>
          <td>4:59</td>
          <td><strong style="color:#c2410c;">4:58/km</strong></td>
          <td><div class="bar-bg"><div class="bar-fill" style="width:80%;background:#ea580c;"></div></div></td>
          <td style="text-align:right;font-weight:700;color:#dc2626;">184 bpm</td>
          <td style="text-align:right;color:#dc2626;">189 bpm</td>
          <td style="text-align:right;">175 spm</td>
        </tr>
        <tr class="row-slow">
          <td><strong>9</strong></td>
          <td><span class="tag tag-slow">Trucht #3</span></td>
          <td>6:37</td>
          <td><strong>6:40/km</strong></td>
          <td><div class="bar-bg"><div class="bar-fill" style="width:50%;background:#22c55e;"></div></div></td>
          <td style="text-align:right;color:#166534;font-weight:600;">167 bpm</td>
          <td style="text-align:right;">182 bpm</td>
          <td style="text-align:right;">156 spm</td>
        </tr>
        <tr class="row-fast" style="background:#ffedd5;">
          <td><strong>10</strong></td>
          <td><span class="tag tag-fast" style="background:#c2410c;">Interwał #4 🔥</span></td>
          <td>4:48</td>
          <td><strong style="color:#b45309;">4:45/km</strong></td>
          <td><div class="bar-bg"><div class="bar-fill" style="width:90%;background:#c2410c;"></div></div></td>
          <td style="text-align:right;font-weight:700;color:#dc2626;">182 bpm</td>
          <td style="text-align:right;color:#dc2626;">188 bpm</td>
          <td style="text-align:right;">176 spm</td>
        </tr>
        <tr class="row-slow">
          <td><strong>11</strong></td>
          <td><span class="tag tag-slow">Trucht #4</span></td>
          <td>6:51</td>
          <td><strong>6:51/km</strong></td>
          <td><div class="bar-bg"><div class="bar-fill" style="width:48%;background:#22c55e;"></div></div></td>
          <td style="text-align:right;color:#166534;font-weight:600;">168 bpm</td>
          <td style="text-align:right;">187 bpm</td>
          <td style="text-align:right;">161 spm</td>
        </tr>
        <tr class="row-fast" style="background:#ffedd5;">
          <td><strong>12</strong></td>
          <td><span class="tag tag-fast" style="background:#b91c1c;">Interwał #5 ⚡</span></td>
          <td>4:42</td>
          <td><strong style="color:#b91c1c;font-size:12px;">4:42/km</strong></td>
          <td><div class="bar-bg"><div class="bar-fill" style="width:95%;background:#b91c1c;"></div></div></td>
          <td style="text-align:right;font-weight:700;color:#dc2626;">184 bpm</td>
          <td style="text-align:right;color:#dc2626;">189 bpm</td>
          <td style="text-align:right;font-weight:700;">177 spm</td>
        </tr>
        <tr class="row-warmup">
          <td><strong>13</strong></td>
          <td><span class="tag tag-warmup">Schłodzenie</span></td>
          <td>1:23</td>
          <td>12:14/km</td>
          <td><div class="bar-bg"><div class="bar-fill" style="width:15%;background:#cbd5e1;"></div></div></td>
          <td style="text-align:right;">172 bpm</td>
          <td style="text-align:right;">187 bpm</td>
          <td style="text-align:right;">134 spm</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- INSIGHTS & PHYSIOLOGY -->
  <div class="section-title">Co Widać w Ciele (Analiza Fizjologiczna)</div>
  <div class="grid-insights">
    <div class="insight-box" style="border-left:3.5px solid #ea580c;">
      <div class="insight-title"><span style="color:#ea580c;">⚡</span> Ujemne Splitowanie (Negative Split)</div>
      <div style="font-size:10.5px;color:#475569;line-height:1.45;">
        Pierwsza trójka interwałów wchodziła ze szwajcarską precyzją: <strong>4:58 → 4:57 → 4:58/km</strong>. Od 4. interwału tempo wzrosło do <strong>4:45/km</strong>, a finałowy 5. interwał zamknąłeś najszybciej w pełnym treningu: <strong>4:42/km</strong> przy kadencji 177 spm. Kapitalny zapas sił pod koniec!
      </div>
    </div>
    <div class="insight-box" style="border-left:3.5px solid #22c55e;">
      <div class="insight-title"><span style="color:#22c55e;">🫀</span> Responsywność Serca (HR Recovery)</div>
      <div style="font-size:10.5px;color:#475569;line-height:1.45;">
        Podczas szybkich powtórzeń średnie HR wynosiło <strong>181–184 bpm</strong> (piki do 189 bpm w Z5). W truchtach regeneracyjnych tętno płynnie zjeżdżało do <strong>162–169 bpm</strong> (spadek o blisko <strong>20 bpm</strong>), co potwierdza sprawną regenerację tlenową w biegu.
      </div>
    </div>
    <div class="insight-box" style="border-left:3.5px solid #3b82f6;">
      <div class="insight-title"><span style="color:#3b82f6;">🏃</span> Biomechanika i Kadencja</div>
      <div style="font-size:10.5px;color:#475569;line-height:1.45;">
        Na szybkich km kadencja utrzymywała bardzo stabilny poziom <strong>174–177 spm</strong> (z długością kroku >1.03 m). Podczas truchtu odpoczynkowego kadencja swobodnie spadała do <strong>156–162 spm</strong>, umożliwiając rozluźnienie mięśni.
      </div>
    </div>
    <div class="insight-box" style="border-left:3.5px solid #a855f7;">
      <div class="insight-title"><span style="color:#a855f7;">📊</span> Wysoki Bodziec Wydolnościowy</div>
      <div style="font-size:10.5px;color:#475569;line-height:1.45;">
        Aż <strong>65 minut i 48 sekund</strong> spędziłeś w strefach wysoce bodźcowych: Z4 (36:08) oraz Z5 (29:40). To potężny impuls przesuwający próg mleczanowy (LT) i podbijający wydolność VO2max (43.0).
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div>Vanguard OS · Wygenerowano z Garmin Connect API (Activity ID: 23695293004)</div>
    <div>Stream per-sekunda: 908 próbek · 22.07.2026</div>
  </div>

</div>
</body>
</html>
"""

os.makedirs("tmp", exist_ok=True)
html_file = "tmp/raport_interwal_2026-07-22.html"
pdf_file = "tmp/raport_interwal_2026-07-22.pdf"

with open(html_file, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"Saved HTML to {html_file}")

# Convert HTML to PDF using MS Edge headless
edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
cmd = [
    edge_path,
    "--headless",
    "--disable-gpu",
    "--no-pdf-header-footer",
    f"--print-to-pdf={os.path.abspath(pdf_file)}",
    os.path.abspath(html_file)
]

print("Converting HTML to PDF via Edge...")
res = subprocess.run(cmd, capture_output=True, text=True)
print("Edge stdout:", res.stdout)
print("Edge stderr:", res.stderr)

if os.path.exists(pdf_file):
    size_kb = os.path.getsize(pdf_file) / 1024
    print(f"SUCCESS: PDF created at {pdf_file} ({size_kb:.1f} KB)")
else:
    print("FAILED to create PDF")

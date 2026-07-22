import json, os

with open("tmp/garmin_today_summary.json", "r", encoding="utf-8") as f:
    summary = json.load(f)

with open("tmp/garmin_today_parsed_rows.json", "r", encoding="utf-8") as f:
    rows = json.load(f)

try:
    with open("tmp/garmin_today_zones.json", "r", encoding="utf-8") as f:
        zones = json.load(f)
except Exception:
    zones = None

try:
    with open("tmp/garmin_today_weather.json", "r", encoding="utf-8") as f:
        weather = json.load(f)
except Exception:
    weather = None

# Filter rows with valid distance and elapsed time
valid_rows = [r for r in rows if r.get("dist") is not None and r.get("el") is not None]
valid_rows.sort(key=lambda x: x["dist"])

print(f"Total valid stream samples: {len(valid_rows)}")
print(f"Start dist: {valid_rows[0]['dist']}m | End dist: {valid_rows[-1]['dist']}m")
print(f"Start elapsed: {valid_rows[0]['el']}s | End elapsed: {valid_rows[-1]['el']}s")

# Define segments based on cumulative distance (in meters)
segments_def = [
    ("Rozgrzewka", 0, 2000),
    ("Interwał 1", 2000, 3000),
    ("Trucht 1", 3000, 4000),
    ("Interwał 2", 4000, 5000),
    ("Trucht 2", 5000, 6000),
    ("Interwał 3", 6000, 7000),
    ("Trucht 3", 7000, 8000),
    ("Interwał 4", 8000, 9000),
    ("Trucht 4", 9000, 10000),
    ("Interwał 5", 10000, 11000),
    ("Trucht 5", 11000, 12000),
    ("Schłodzenie / Finisz", 12000, 999999),
]

parsed_segments = []

for name, start_m, end_m in segments_def:
    seg_rows = [r for r in valid_rows if start_m <= r["dist"] < end_m]
    if not seg_rows:
        # Check if last segment falls slightly over or under
        continue
    
    t_start = seg_rows[0]["el"]
    t_end = seg_rows[-1]["el"]
    dur_s = t_end - t_start
    if dur_s <= 0 and len(seg_rows) > 1:
        dur_s = len(seg_rows) # approximate sample count

    d_start = seg_rows[0]["dist"]
    d_end = seg_rows[-1]["dist"]
    dist_m = d_end - d_start

    hrs = [r["hr"] for r in seg_rows if r.get("hr")]
    cads = [r["cad"] for r in seg_rows if r.get("cad")]
    spds = [r["spd"] for r in seg_rows if r.get("spd") and r["spd"] > 0.5]

    avg_hr = sum(hrs)/len(hrs) if hrs else None
    max_hr = max(hrs) if hrs else None
    avg_cad = sum(cads)/len(cads) if cads else None
    
    # Calculate pace from distance and duration or average speed
    if dist_m > 50 and dur_s > 10:
        pace_sec_per_km = (dur_s / dist_m) * 1000
    elif spds:
        avg_spd = sum(spds)/len(spds)
        pace_sec_per_km = 1000 / avg_spd
    else:
        pace_sec_per_km = 0

    pm = int(pace_sec_per_km // 60)
    ps = int(pace_sec_per_km % 60)
    pace_str = f"{pm}:{ps:02d}/km" if pace_sec_per_km > 0 else "—"

    dm = int(dur_s // 60)
    ds = int(dur_s % 60)
    dur_str = f"{dm}:{ds:02d}"

    parsed_segments.append({
        "name": name,
        "dist_m": dist_m,
        "dur_s": dur_s,
        "dur_str": dur_str,
        "pace_str": pace_str,
        "avg_hr": round(avg_hr, 1) if avg_hr else "—",
        "max_hr": round(max_hr, 1) if max_hr else "—",
        "avg_cad": round(avg_cad, 1) if avg_cad else "—",
    })

print("\n=== PARSED SEGMENTS BREAKDOWN ===")
for s in parsed_segments:
    print(f"{s['name']:20} | {s['dist_m']:6.1f}m | Czas: {s['dur_str']:6} | Tempo: {s['pace_str']:7} | HR avg: {s['avg_hr']:5} | HR max: {s['max_hr']:5} | Kadencja: {s['avg_cad']}")

# Output full markdown report data to tmp/report_data.json
out_data = {
    "summary": summary,
    "weather": weather,
    "zones": zones,
    "segments": parsed_segments
}
with open("tmp/report_data.json", "w", encoding="utf-8") as f:
    json.dump(out_data, f, indent=2, ensure_ascii=False)

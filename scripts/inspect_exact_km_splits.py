import json

with open("tmp/garmin_today_parsed_rows.json", "r", encoding="utf-8") as f:
    rows = json.load(f)

valid_rows = [r for r in rows if r.get("dist") is not None and r.get("el") is not None]
valid_rows.sort(key=lambda x: x["dist"])

# Print every 1km milestone
total_dist = valid_rows[-1]["dist"]
print(f"Total distance: {total_dist:.1f} m")

km_milestones = []
curr_km = 1
for r in valid_rows:
    if r["dist"] >= curr_km * 1000:
        km_milestones.append((curr_km, r))
        curr_km += 1

print("\n=== 1KM SPLITS FROM STREAM ===")
prev_el = 0
prev_dist = 0

for km, r in km_milestones:
    el_delta = r["el"] - prev_el
    dist_delta = r["dist"] - prev_dist
    
    # Calculate pace for this km
    pace_sec = (el_delta / dist_delta) * 1000 if dist_delta > 0 else 0
    pm = int(pace_sec // 60)
    ps = int(pace_sec % 60)
    
    # Get rows in this km
    seg = [x for x in valid_rows if prev_dist <= x["dist"] < r["dist"]]
    hrs = [x["hr"] for x in seg if x.get("hr")]
    cads = [x["cad"] for x in seg if x.get("cad")]
    
    avg_hr = sum(hrs)/len(hrs) if hrs else 0
    max_hr = max(hrs) if hrs else 0
    avg_cad = sum(cads)/len(cads) if cads else 0

    print(f"Km {km:2d}: {dist_delta:5.1f}m | Czas: {int(el_delta)}s ({int(el_delta//60)}:{int(el_delta%60):02d}) | Tempo: {pm}:{ps:02d}/km | HR avg: {avg_hr:5.1f} | HR max: {max_hr:5.1f} | Kad: {avg_cad:5.1f}")
    
    prev_el = r["el"]
    prev_dist = r["dist"]

# Final fractional km
last_r = valid_rows[-1]
el_delta = last_r["el"] - prev_el
dist_delta = last_r["dist"] - prev_dist
if dist_delta > 20:
    pace_sec = (el_delta / dist_delta) * 1000
    pm = int(pace_sec // 60)
    ps = int(pace_sec % 60)
    seg = [x for x in valid_rows if prev_dist <= x["dist"]]
    hrs = [x["hr"] for x in seg if x.get("hr")]
    cads = [x["cad"] for x in seg if x.get("cad")]
    avg_hr = sum(hrs)/len(hrs) if hrs else 0
    max_hr = max(hrs) if hrs else 0
    avg_cad = sum(cads)/len(cads) if cads else 0
    print(f"Km {curr_km:2d} (finisz {dist_delta:.1f}m): Czas: {int(el_delta)}s | Tempo: {pm}:{ps:02d}/km | HR avg: {avg_hr:5.1f} | HR max: {max_hr:5.1f} | Kad: {avg_cad:5.1f}")

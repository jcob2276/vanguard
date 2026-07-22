import os, json, sys, shutil
from dotenv import load_dotenv
load_dotenv()
import garth
from garminconnect import Garmin

TOKENS = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".garmin_tokens")

api = None
if os.path.exists(TOKENS):
    try:
        garth.resume(TOKENS)
        api = Garmin()
        api.login()
    except Exception as e:
        print(f"Resume error ({e}), re-authenticating...")
        shutil.rmtree(TOKENS, ignore_errors=True)

if not api:
    email = os.getenv("GARMIN_EMAIL")
    password = os.getenv("GARMIN_PASSWORD")
    api = Garmin(email, password)
    api.login()
    os.makedirs(TOKENS, exist_ok=True)
    garth.save(TOKENS)

act_id = 23695293004
print(f"Fetching details for activity {act_id}...")

details = api.get_activity_details(act_id, 2000, 4000)
with open("tmp/garmin_today_details.json", "w", encoding="utf-8") as f:
    json.dump(details, f, indent=2, ensure_ascii=False)

descriptors = details.get("metricDescriptors", [])
desc_map = {}
for d in descriptors:
    idx = d.get("metricsIndex")
    key = d.get("key") or d.get("metricType")
    if idx is not None and key:
        desc_map[idx] = key

print("Metric Descriptors:", desc_map)

metrics = details.get("activityDetailMetrics", [])
print(f"Total second samples: {len(metrics)}")

speed_idx = next((i for i, k in desc_map.items() if "speed" in k.lower() and "vertical" not in k.lower()), None)
hr_idx    = next((i for i, k in desc_map.items() if "heartrate" in k.lower() or "heart_rate" in k.lower()), None)
cad_idx   = next((i for i, k in desc_map.items() if "doublecadence" in k.lower()), None)
if cad_idx is None:
    cad_idx = next((i for i, k in desc_map.items() if "runcadence" in k.lower()), None)
elapsed_idx = next((i for i, k in desc_map.items() if "elapsed" in k.lower()), None)
dist_idx    = next((i for i, k in desc_map.items() if "sumdistance" in k.lower()), None)

print(f"Indices: speed={speed_idx}, hr={hr_idx}, cad={cad_idx}, elapsed={elapsed_idx}, dist={dist_idx}")

rows = []
for m in metrics:
    vals = m.get("metrics", []) if isinstance(m, dict) else (m if isinstance(m, list) else [])
    def gv(i):
        return vals[i] if i is not None and i < len(vals) else None
    rows.append({
        "spd": gv(speed_idx),
        "hr":  gv(hr_idx),
        "cad": gv(cad_idx),
        "dist": gv(dist_idx),
        "el":  gv(elapsed_idx),
    })

with open("tmp/garmin_today_parsed_rows.json", "w", encoding="utf-8") as f:
    json.dump(rows, f, indent=2, ensure_ascii=False)

print(f"Saved {len(rows)} parsed rows to tmp/garmin_today_parsed_rows.json")

from garminconnect import Garmin
import json

GC_ID = 23366366604

api = Garmin('jakubsobon3@gmail.com', 'Czarek100!')
api.login()

details = api.get_activity_details(GC_ID, 2000, 4000)

# Build desc_map
descriptors = details.get('metricDescriptors', [])
desc_map = {}
for d in descriptors:
    idx = d.get('metricsIndex')
    key = d.get('key') or d.get('metricType')
    if idx is not None and key:
        desc_map[idx] = key

print('desc_map:', json.dumps(desc_map))

metrics = details.get('activityDetailMetrics', [])
print(f'Probki: {len(metrics)}')

# Find correct indices
speed_idx   = next((i for i, k in desc_map.items() if 'speed' in k.lower() and 'vertical' not in k.lower()), None)
hr_idx      = next((i for i, k in desc_map.items() if 'heartrate' in k.lower() or 'heart_rate' in k.lower()), None)
cad_idx     = next((i for i, k in desc_map.items() if 'doublecadence' in k.lower()), None)
if cad_idx is None:
    cad_idx = next((i for i, k in desc_map.items() if 'runcadence' in k.lower()), None)
elapsed_idx = next((i for i, k in desc_map.items() if 'elapsed' in k.lower()), None)
dist_idx    = next((i for i, k in desc_map.items() if 'sumdistance' in k.lower()), None)

print(f'Indeksy: speed={speed_idx}, hr={hr_idx}, cad={cad_idx}, elapsed={elapsed_idx}, dist={dist_idx}')

# Extract samples
rows = []
for m in metrics:
    vals = m.get('metrics', []) if isinstance(m, dict) else (m if isinstance(m, list) else [])
    def gv(i, v=vals):
        return v[i] if i is not None and i < len(v) else None
    rows.append({
        'spd': gv(speed_idx),
        'hr':  gv(hr_idx),
        'cad': gv(cad_idx),
        'dist': gv(dist_idx),
        'el':  gv(elapsed_idx),
    })

# Print every 15th sample
print('\nElapsed | Dist   | Speed  | Pace    | HR  | Cad')
for i, r in enumerate(rows):
    if i % 15 == 0 or i == len(rows) - 1:
        spd = r['spd'] or 0
        el  = r['el'] or 0
        dst = r['dist'] or 0
        hr  = r['hr'] or 0
        cad = r['cad'] or 0
        if spd > 0.5:
            ps_total = 1000 / spd
            pm = int(ps_total // 60)
            ps = int(ps_total % 60)
            pace_str = f'{pm}:{ps:02d}/km'
        else:
            pace_str = '---'
        print(f'{int(el):5}s | {int(dst):5}m | {spd:.2f} m/s | {pace_str:7} | {int(hr):3} | {int(cad)}')

# Per-minute segments
print('\n--- Per minuta ---')
for seg_s, seg_e in [(0,180),(180,360),(360,540),(540,723)]:
    label = f'Min {seg_s//60+1}-{seg_e//60}'
    seg = [r for r in rows
           if r['el'] is not None and seg_s <= r['el'] < seg_e
           and r['spd'] and r['spd'] > 0.5]
    if not seg:
        continue
    avg_spd = sum(r['spd'] for r in seg) / len(seg)
    avg_hr  = sum(r['hr'] for r in seg if r['hr']) / max(1, len([r for r in seg if r['hr']]))
    avg_cad = sum(r['cad'] for r in seg if r['cad']) / max(1, len([r for r in seg if r['cad']]))
    ps_total = 1000 / avg_spd
    pm = int(ps_total // 60); ps = int(ps_total % 60)
    print(f'{label}: {pm}:{ps:02d}/km | HR {avg_hr:.0f} | Cad {avg_cad:.0f} spm')

# Max HR per segment
print('\n--- Max HR per minuta ---')
for seg_s, seg_e in [(0,60),(60,120),(120,180),(180,240),(240,300),(300,360),(360,420),(420,480),(480,540),(540,600),(600,660),(660,723)]:
    seg = [r for r in rows if r['el'] is not None and seg_s <= r['el'] < seg_e and r['hr']]
    if seg:
        max_hr = max(r['hr'] for r in seg)
        avg_hr = sum(r['hr'] for r in seg) / len(seg)
        print(f'  {seg_s//60+1:2}min: avg HR {avg_hr:.0f} | max HR {max_hr:.0f}')

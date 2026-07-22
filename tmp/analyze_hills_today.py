"""Reconstruct ~20x (200m up + 200m down) hill cycles from today's Garmin run."""
import json
import os

from dotenv import load_dotenv
from garminconnect import Garmin
import garth

load_dotenv()

TOKENS = os.path.join("scripts", ".garmin_tokens")
EMAIL = os.getenv("GARMIN_EMAIL")
PASSWORD = os.getenv("GARMIN_PASSWORD")
GC_ID = 23668624368


def login():
    try:
        garth.resume(TOKENS)
        api = Garmin()
        api.login()
        return api
    except Exception:
        api = Garmin(EMAIL, PASSWORD)
        api.login()
        return api


def pace_str(sec_per_km: float | None) -> str:
    if not sec_per_km:
        return "—"
    return f"{int(sec_per_km // 60)}:{int(sec_per_km % 60):02d}"


def dur_str(sec: float | None) -> str:
    if sec is None:
        return "—"
    return f"{int(sec // 60)}:{int(sec % 60):02d}"


def main() -> None:
    api = login()
    details = api.get_activity_details(GC_ID, 2000, 4000)
    desc: dict[int, str] = {}
    for d in details["metricDescriptors"]:
        idx = d.get("metricsIndex")
        key = d.get("key") or d.get("metricType")
        if idx is not None and key:
            desc[idx] = key

    def find(*needles: str) -> int | None:
        for i, k in desc.items():
            kl = k.lower()
            if all(n in kl for n in needles):
                return i
        return None

    idx = {
        "dist": find("sumdistance"),
        "hr": find("heartrate"),
        "elev": find("directelevation"),
        "cad": find("doublecadence") or find("runcadence"),
        "spd": next(
            (
                i
                for i, k in desc.items()
                if "speed" in k.lower()
                and "vertical" not in k.lower()
                and "sum" not in k.lower()
            ),
            None,
        ),
        "mov": find("summoving"),
        "el": find("sumelapsed"),
    }
    print("idx", idx)

    rows = []
    for m in details["activityDetailMetrics"]:
        v = m.get("metrics", [])

        def gv(name: str, vals=v):
            i = idx[name]
            return vals[i] if i is not None and i < len(vals) else None

        rows.append({k: gv(k) for k in idx})

    elevs_all = [r["elev"] for r in rows if r["elev"] is not None]
    print(
        f"n={len(rows)} dist={rows[-1]['dist']:.0f} "
        f"elev={min(elevs_all):.0f}-{max(elevs_all):.0f}"
    )

    splits = api.get_activity_splits(GC_ID)
    laps = splits.get("lapDTOs", [])

    cum = 0.0
    lap_bounds = []
    for i, lap in enumerate(laps, 1):
        d = lap.get("distance") or 0
        start = cum
        cum += d
        lap_bounds.append((i, start, cum, lap))

    def samples_in(d0: float, d1: float):
        return [r for r in rows if r["dist"] is not None and d0 <= r["dist"] < d1]

    def stats(seg: list, label: str):
        if not seg:
            return None
        hrs = [r["hr"] for r in seg if r["hr"]]
        cads = [r["cad"] for r in seg if r["cad"]]
        spds = [r["spd"] for r in seg if r["spd"] and r["spd"] > 0.5]
        elevs = [r["elev"] for r in seg if r["elev"] is not None]
        movs = [r["mov"] for r in seg if r["mov"] is not None]
        d0 = seg[0]["dist"]
        d1 = seg[-1]["dist"]
        dur = (movs[-1] - movs[0]) if len(movs) >= 2 else None
        avg_spd = sum(spds) / len(spds) if spds else None
        pace = (1000 / avg_spd) if avg_spd else None
        return {
            "label": label,
            "dist": d1 - d0,
            "dur": dur,
            "pace": pace,
            "hr_avg": sum(hrs) / len(hrs) if hrs else None,
            "hr_max": max(hrs) if hrs else None,
            "hr_start": hrs[0] if hrs else None,
            "hr_end": hrs[-1] if hrs else None,
            "cad": sum(cads) / len(cads) if cads else None,
            "elev_min": min(elevs) if elevs else None,
            "elev_max": max(elevs) if elevs else None,
            "elev_range": (max(elevs) - min(elevs)) if elevs else None,
        }

    # Approach: laps 1-2 (~260m) — matches "od ~300m"
    # Work: lap3 (907m ≈ 2 cycles) + laps 4-21 (18) = 20
    # Cooldown: lap22 (~2km)
    work_laps = lap_bounds[2:21]  # 3..21
    lap3 = work_laps[0]
    half = (lap3[2] - lap3[1]) / 2
    cycles = [
        (1, lap3[1], lap3[1] + half, "lap3a"),
        (2, lap3[1] + half, lap3[2], "lap3b"),
    ]
    for n, (li, d0, d1, _lap) in enumerate(work_laps[1:], start=3):
        cycles.append((n, d0, d1, f"lap{li}"))

    print(f"\nReconstructed {len(cycles)} hill cycles")
    print(
        f"{'#':>3} {'dist':>5} {'mov':>5} {'pace':>6} "
        f"{'HRavg':>5} {'HRmax':>5} {'dHR':>5} {'cad':>4} {'elevR':>5} src"
    )

    cycle_stats = []
    for n, d0, d1, src in cycles:
        st = stats(samples_in(d0, d1), f"#{n:02d}")
        cycle_stats.append((n, d0, d1, src, st))
        if not st:
            continue
        dhr = (
            (st["hr_end"] - st["hr_start"])
            if st["hr_end"] and st["hr_start"]
            else 0
        )
        print(
            f"{n:3} {st['dist']:5.0f} {dur_str(st['dur']):>5} {pace_str(st['pace']):>6} "
            f"{st['hr_avg'] or 0:5.0f} {st['hr_max'] or 0:5.0f} {dhr:+5.0f} "
            f"{st['cad'] or 0:4.0f} {st['elev_range'] or 0:5.0f} {src}"
        )

    hrs = [st["hr_avg"] for *_, st in cycle_stats if st and st["hr_avg"]]
    paces = [st["pace"] for *_, st in cycle_stats if st and st["pace"]]
    print("\n--- BODY ---")
    print(
        f"HR first5 avg: {sum(hrs[:5])/5:.0f} | last5 avg: {sum(hrs[-5:])/5:.0f} | "
        f"drift {sum(hrs[-5:])/5 - sum(hrs[:5])/5:+.0f}"
    )
    print(
        f"Pace first5: {pace_str(sum(paces[:5])/5)} | "
        f"last5: {pace_str(sum(paces[-5:])/5)}"
    )
    by_pace = sorted(
        (st["pace"], n) for n, *_, st in cycle_stats if st and st["pace"]
    )
    print(
        f"Fastest: #{by_pace[0][1]} {pace_str(by_pace[0][0])} | "
        f"Slowest: #{by_pace[-1][1]} {pace_str(by_pace[-1][0])}"
    )

    app_d0, app_d1 = lap_bounds[0][1], lap_bounds[1][2]
    cd = lap_bounds[21]
    print(f"\nApproach {app_d1-app_d0:.0f}m | Cooldown {cd[2]-cd[1]:.0f}m")

    out = {
        "gc_id": GC_ID,
        "name": "Chorkówka — podbiegi 200↑/200↓",
        "approach_m": app_d1 - app_d0,
        "cooldown_m": cd[2] - cd[1],
        "cycles": [
            {
                "n": n,
                "src": src,
                "d0": d0,
                "d1": d1,
                **(
                    {
                        k: st[k]
                        for k in (
                            "dist",
                            "dur",
                            "pace",
                            "hr_avg",
                            "hr_max",
                            "hr_start",
                            "hr_end",
                            "cad",
                            "elev_min",
                            "elev_max",
                            "elev_range",
                        )
                    }
                    if st
                    else {}
                ),
            }
            for n, d0, d1, src, st in cycle_stats
        ],
        "laps_raw": [
            {
                "i": i,
                "distance": lap.get("distance"),
                "movingDuration": lap.get("movingDuration"),
                "averageHR": lap.get("averageHR"),
                "maxHR": lap.get("maxHR"),
                "elevationGain": lap.get("elevationGain"),
                "elevationLoss": lap.get("elevationLoss"),
                "averageMovingSpeed": lap.get("averageMovingSpeed"),
                "averageRunCadence": lap.get("averageRunCadence"),
            }
            for i, _a, _b, lap in lap_bounds
        ],
        "summary": {
            "distance_km": 10.41,
            "moving_s": 3734,
            "elapsed_s": 4307,
            "hr_avg": 169,
            "hr_max": 190,
            "elev_gain": 275,
            "weather_c": 22,
            "zones": {"z4_s": 2043, "z5_s": 1626},
        },
    }
    os.makedirs("tmp", exist_ok=True)
    path = "tmp/hill_cycles_2026-07-20.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    print(f"\nSaved {path}")


if __name__ == "__main__":
    main()

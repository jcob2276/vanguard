import os, json, sys, shutil
from dotenv import load_dotenv
load_dotenv()
import garth
from garminconnect import Garmin

TOKENS = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".garmin_tokens")

print("Logging in / resuming Garth session...")
api = None
if os.path.exists(TOKENS):
    try:
        garth.resume(TOKENS)
        api = Garmin()
        api.login()
        print("Session resumed successfully via garth!")
    except Exception as e:
        print(f"Token resume failed ({e}), clearing token dir and re-authenticating...")
        shutil.rmtree(TOKENS, ignore_errors=True)

if not api:
    email = os.getenv("GARMIN_EMAIL")
    password = os.getenv("GARMIN_PASSWORD")
    api = Garmin(email, password)
    api.login()
    os.makedirs(TOKENS, exist_ok=True)
    garth.save(TOKENS)
    print("New session logged in and tokens saved!")

# Get latest activities
print("\nFetching latest activities...")
acts = api.get_activities(0, 5)
print(f"Found {len(acts)} activities.")

for i, a in enumerate(acts):
    act_id = a.get("activityId")
    name = a.get("activityName")
    start = a.get("startTimeLocal")
    dist = a.get("distance", 0) / 1000
    dur = a.get("movingDuration") or a.get("duration", 0)
    hr = a.get("averageHR")
    print(f"[{i}] ID: {act_id} | Name: {name} | Date: {start} | Dist: {dist:.2f} km | Dur: {dur//60} min | HR: {hr}")

if acts:
    today_act = acts[0]
    act_id = today_act.get("activityId")
    print(f"\n==========================================")
    print(f"ANALYZING TODAY'S WORKOUT ID: {act_id}")
    print(f"==========================================")
    
    os.makedirs("tmp", exist_ok=True)

    # Save raw summary
    with open("tmp/garmin_today_summary.json", "w", encoding="utf-8") as f:
        json.dump(today_act, f, indent=2, ensure_ascii=False)
        
    # Get laps / splits
    try:
        splits = api.get_activity_splits(act_id)
        with open("tmp/garmin_today_laps.json", "w", encoding="utf-8") as f:
            json.dump(splits, f, indent=2, ensure_ascii=False)
        print("Saved laps to tmp/garmin_today_laps.json")
    except Exception as e:
        print(f"Error fetching splits: {e}")

    # Get exercise sets / workout steps if available
    try:
        wkt = api.get_workout_by_id(act_id)
        with open("tmp/garmin_today_workout.json", "w", encoding="utf-8") as f:
            json.dump(wkt, f, indent=2, ensure_ascii=False)
        print("Saved workout steps to tmp/garmin_today_workout.json")
    except Exception as e:
        print(f"Error fetching workout steps: {e}")

    # Get per-second details (streams)
    try:
        details = api.get_activity_details(act_id, 0, 5000)
        with open("tmp/garmin_today_details.json", "w", encoding="utf-8") as f:
            json.dump(details, f, indent=2, ensure_ascii=False)
        print("Saved per-second details to tmp/garmin_today_details.json")
    except Exception as e:
        print(f"Error fetching details: {e}")

    # Get HR zones
    try:
        zones = api.get_activity_hr_in_timezones(act_id)
        with open("tmp/garmin_today_zones.json", "w", encoding="utf-8") as f:
            json.dump(zones, f, indent=2, ensure_ascii=False)
        print("Saved HR zones to tmp/garmin_today_zones.json")
    except Exception as e:
        print(f"Error fetching zones: {e}")

    # Get weather
    try:
        weather = api.get_activity_weather(act_id)
        with open("tmp/garmin_today_weather.json", "w", encoding="utf-8") as f:
            json.dump(weather, f, indent=2, ensure_ascii=False)
        print("Saved weather to tmp/garmin_today_weather.json")
    except Exception as e:
        print(f"Error fetching weather: {e}")

print("\nDONE!")

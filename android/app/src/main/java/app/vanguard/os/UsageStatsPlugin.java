package app.vanguard.os;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Calendar;
import java.util.HashMap;
import java.util.Map;
import java.util.TimeZone;

@CapacitorPlugin(name = "UsageStats")
public class UsageStatsPlugin extends Plugin {

    private static final TimeZone WARSAW = TimeZone.getTimeZone("Europe/Warsaw");

    @PluginMethod
    public void hasAccess(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasUsageAccess());
        call.resolve(ret);
    }

    @PluginMethod
    public void openAccessSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void getDailySnapshot(PluginCall call) {
        if (!hasUsageAccess()) {
            call.reject("USAGE_ACCESS_DENIED");
            return;
        }

        Long beginMs = call.getLong("beginMs");
        Long endMs = call.getLong("endMs");
        if (beginMs == null || endMs == null || endMs <= beginMs) {
            call.reject("INVALID_RANGE");
            return;
        }

        UsageStatsManager manager = (UsageStatsManager) getContext()
            .getSystemService(Context.USAGE_STATS_SERVICE);
        if (manager == null) {
            call.reject("USAGE_STATS_UNAVAILABLE");
            return;
        }

        Map<String, Long> packageMs = new HashMap<>();
        long lateNightMs = 0;
        int unlocks = 0;

        UsageEvents events = manager.queryEvents(beginMs, endMs);
        UsageEvents.Event event = new UsageEvents.Event();
        String activePkg = null;
        long activeSince = 0L;

        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            int type = event.getEventType();
            long ts = event.getTimeStamp();

            if (type == UsageEvents.Event.KEYGUARD_HIDDEN) {
                unlocks++;
                continue;
            }

            if (type == UsageEvents.Event.ACTIVITY_RESUMED
                || type == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                if (activePkg != null && activeSince > 0L) {
                    long[] added = addSession(activePkg, activeSince, ts);
                    packageMs.put(activePkg, packageMs.getOrDefault(activePkg, 0L) + added[0]);
                    lateNightMs += added[1];
                }
                activePkg = event.getPackageName();
                activeSince = ts;
            } else if (type == UsageEvents.Event.ACTIVITY_PAUSED
                || type == UsageEvents.Event.MOVE_TO_BACKGROUND) {
                if (activePkg != null && activeSince > 0L) {
                    long[] added = addSession(activePkg, activeSince, ts);
                    packageMs.put(activePkg, packageMs.getOrDefault(activePkg, 0L) + added[0]);
                    lateNightMs += added[1];
                }
                activePkg = null;
                activeSince = 0L;
            }
        }

        if (activePkg != null && activeSince > 0L) {
            long[] added = addSession(activePkg, activeSince, endMs);
            packageMs.put(activePkg, packageMs.getOrDefault(activePkg, 0L) + added[0]);
            lateNightMs += added[1];
        }

        JSArray packages = new JSArray();
        for (Map.Entry<String, Long> entry : packageMs.entrySet()) {
            if (entry.getValue() <= 0L) continue;
            JSObject row = new JSObject();
            row.put("packageName", entry.getKey());
            row.put("foregroundMs", entry.getValue());
            packages.put(row);
        }

        JSObject ret = new JSObject();
        ret.put("packages", packages);
        ret.put("unlocks", unlocks);
        ret.put("lateNightMs", lateNightMs);
        call.resolve(ret);
    }

    private boolean hasUsageAccess() {
        AppOpsManager appOps = (AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
        if (appOps == null) return false;
        int mode = appOps.unsafeCheckOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            android.os.Process.myUid(),
            getContext().getPackageName()
        );
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    /** @return [totalMs, lateNightMs] */
    private long[] addSession(String pkg, long startMs, long endMs) {
        if (endMs <= startMs) return new long[] { 0L, 0L };
        long duration = endMs - startMs;
        long late = 0L;
        if (isLateNightWarsaw(startMs) || isLateNightWarsaw(endMs - 1)) {
            late = duration;
        }
        return new long[] { duration, late };
    }

    private boolean isLateNightWarsaw(long timestampMs) {
        Calendar cal = Calendar.getInstance(WARSAW);
        cal.setTimeInMillis(timestampMs);
        int hour = cal.get(Calendar.HOUR_OF_DAY);
        return hour >= 23 || hour < 4;
    }
}

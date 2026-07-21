package app.vanguard.os;

import android.content.Context;

import com.getcapacitor.JSObject;

/** Shared widget ↔ app state (separate process safe via SharedPreferences). */
public final class WidgetStateStore {

    static final String PREFS = "vanguard_widget";
    static final String KEY_MODE_INDEX = "demo_mode_index";
    static final String KEY_TAP_COUNT = "demo_tap_count";

    private static final String[] MODE_IDS = { "focus", "rest", "move" };
    private static final String[] MODE_LABELS = { "Focus", "Odpoczynek", "Ruch" };

    private WidgetStateStore() {}

    static JSObject readState(Context context) {
        int index = prefs(context).getInt(KEY_MODE_INDEX, 0);
        int taps = prefs(context).getInt(KEY_TAP_COUNT, 0);
        if (index < 0 || index >= MODE_IDS.length) index = 0;
        JSObject ret = new JSObject();
        ret.put("modeId", MODE_IDS[index]);
        ret.put("modeLabel", MODE_LABELS[index]);
        ret.put("modeIndex", index);
        ret.put("tapCount", taps);
        return ret;
    }

    static JSObject cycleMode(Context context, boolean fromWidgetTap) {
        int index = prefs(context).getInt(KEY_MODE_INDEX, 0);
        int taps = prefs(context).getInt(KEY_TAP_COUNT, 0);
        index = (index + 1) % MODE_IDS.length;
        if (fromWidgetTap) {
            taps += 1;
        }
        prefs(context).edit()
            .putInt(KEY_MODE_INDEX, index)
            .putInt(KEY_TAP_COUNT, taps)
            .apply();
        return readState(context);
    }

    static String modeLabel(int index) {
        if (index < 0 || index >= MODE_LABELS.length) return MODE_LABELS[0];
        return MODE_LABELS[index];
    }

    static int modeIndex(Context context) {
        return prefs(context).getInt(KEY_MODE_INDEX, 0);
    }

    static int tapCount(Context context) {
        return prefs(context).getInt(KEY_TAP_COUNT, 0);
    }

    private static android.content.SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}

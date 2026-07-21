package app.vanguard.os;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BackgroundSync")
public class BackgroundSyncPlugin extends Plugin {

    private static BackgroundSyncPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) {
            instance = null;
        }
        super.handleOnDestroy();
    }

    static void notifySyncTickFromService() {
        BackgroundSyncPlugin plugin = instance;
        if (plugin == null) return;
        plugin.notifyListeners("syncTick", new JSObject());
    }

    @PluginMethod
    public void isRunning(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("running", TelemetryForegroundServiceHolder.isRunning(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void start(PluginCall call) {
        Context ctx = getContext();
        Intent intent = new Intent(ctx, TelemetryForegroundService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(intent);
        } else {
            ctx.startService(intent);
        }
        TelemetryForegroundServiceHolder.setRunning(true);
        JSObject ret = new JSObject();
        ret.put("running", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Context ctx = getContext();
        ctx.stopService(new Intent(ctx, TelemetryForegroundService.class));
        TelemetryForegroundServiceHolder.setRunning(false);
        JSObject ret = new JSObject();
        ret.put("running", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        boolean ignored = pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        JSObject ret = new JSObject();
        ret.put("ignored", ignored);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            openBatteryOptimizationSettings(call);
        }
    }

    @PluginMethod
    public void openBatteryOptimizationSettings(PluginCall call) {
        openBatteryOptimizationSettingsInternal(call);
    }

    private void openBatteryOptimizationSettingsInternal(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("BATTERY_SETTINGS_UNAVAILABLE", e);
        }
    }

    @PluginMethod
    public void openAutostartSettings(PluginCall call) {
        String pkg = getContext().getPackageName();
        Intent[] attempts = new Intent[] {
            buildComponentIntent("com.miui.securitycenter",
                "com.miui.permcenter.autostart.AutoStartManagementActivity"),
            buildActionIntent("miui.intent.action.OP_AUTO_START"),
            buildComponentIntent("com.coloros.safecenter",
                "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
            buildComponentIntent("com.oppo.safe",
                "com.oppo.safe.permission.startup.StartupAppListActivity"),
            buildComponentIntent("com.vivo.permissionmanager",
                "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"),
            buildComponentIntent("com.huawei.systemmanager",
                "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
        };

        for (Intent intent : attempts) {
            if (intent == null) continue;
            intent.putExtra("packageName", pkg);
            intent.putExtra("package_name", pkg);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (intent.resolveActivity(getContext().getPackageManager()) != null) {
                getContext().startActivity(intent);
                call.resolve();
                return;
            }
        }

        // Fallback: app details where user can tweak battery + autostart on some OEM skins.
        try {
            Intent details = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            details.setData(Uri.parse("package:" + pkg));
            details.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(details);
            call.resolve();
        } catch (Exception e) {
            call.reject("AUTOSTART_SETTINGS_UNAVAILABLE", e);
        }
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("APP_SETTINGS_UNAVAILABLE", e);
        }
    }

    private Intent buildComponentIntent(String pkg, String cls) {
        Intent intent = new Intent();
        intent.setComponent(new ComponentName(pkg, cls));
        return intent;
    }

    private Intent buildActionIntent(String action) {
        Intent intent = new Intent(action);
        intent.addCategory(Intent.CATEGORY_DEFAULT);
        return intent;
    }
}

/** Tracks FGS state without querying ActivityManager (cheap UI hint). */
final class TelemetryForegroundServiceHolder {
    private static boolean running;

    static boolean isRunning(Context ctx) {
        return running;
    }

    static void setRunning(boolean value) {
        running = value;
    }
}

package app.vanguard.os;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    private static WidgetBridgePlugin instance;

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

    static void notifyDemoStateChanged(JSObject state) {
        WidgetBridgePlugin plugin = instance;
        if (plugin == null) return;
        plugin.notifyListeners("demoStateChanged", state);
    }

    @PluginMethod
    public void getDemoState(PluginCall call) {
        call.resolve(WidgetStateStore.readState(getContext()));
    }

    @PluginMethod
    public void cycleDemoMode(PluginCall call) {
        JSObject state = WidgetStateStore.cycleMode(getContext(), false);
        DemoWidgetProvider.updateAll(getContext());
        notifyDemoStateChanged(state);
        call.resolve(state);
    }

    @PluginMethod
    public void refreshDemoWidget(PluginCall call) {
        DemoWidgetProvider.updateAll(getContext());
        call.resolve(WidgetStateStore.readState(getContext()));
    }

    @PluginMethod
    public void requestPinDemoWidget(PluginCall call) {
        Context context = getContext();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.reject("PIN_WIDGET_REQUIRES_OREO");
            return;
        }
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (!manager.isRequestPinAppWidgetSupported()) {
            call.reject("PIN_WIDGET_NOT_SUPPORTED");
            return;
        }
        ComponentName provider = new ComponentName(context, DemoWidgetProvider.class);
        Intent success = new Intent(context, MainActivity.class);
        success.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        android.app.PendingIntent callback = android.app.PendingIntent.getActivity(
            context,
            9102,
            success,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE
        );
        manager.requestPinAppWidget(provider, null, callback);
        call.resolve();
    }
}

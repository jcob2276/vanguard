package app.vanguard.os;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import com.getcapacitor.JSObject;

public class WidgetTapReceiver extends BroadcastReceiver {

    static final String ACTION_WIDGET_DEMO_TAP = "app.vanguard.os.WIDGET_DEMO_TAP";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_WIDGET_DEMO_TAP.equals(intent.getAction())) return;
        JSObject state = WidgetStateStore.cycleMode(context, true);
        DemoWidgetProvider.updateAll(context);
        WidgetBridgePlugin.notifyDemoStateChanged(state);
    }
}

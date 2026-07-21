package app.vanguard.os;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public class DemoWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateWidget(context, manager, id);
        }
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName component = new ComponentName(context, DemoWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(component);
        for (int id : ids) {
            updateWidget(context, manager, id);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int appWidgetId) {
        int modeIndex = WidgetStateStore.modeIndex(context);
        int taps = WidgetStateStore.tapCount(context);
        String label = WidgetStateStore.modeLabel(modeIndex);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_demo);
        views.setTextViewText(R.id.widget_demo_mode, label);
        views.setTextViewText(R.id.widget_demo_taps, taps + " tapów");
        views.setTextViewText(R.id.widget_demo_hint, "Tap → zmienia w apce");

        Intent tapIntent = new Intent(context, WidgetTapReceiver.class);
        tapIntent.setAction(WidgetTapReceiver.ACTION_WIDGET_DEMO_TAP);
        PendingIntent pending = PendingIntent.getBroadcast(
            context,
            appWidgetId,
            tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_demo_root, pending);

        manager.updateAppWidget(appWidgetId, views);
    }
}

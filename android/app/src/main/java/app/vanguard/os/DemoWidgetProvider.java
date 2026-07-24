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
        views.setTextViewText(R.id.widget_demo_mode, "Oracle Czat");
        views.setTextViewText(R.id.widget_demo_taps, "Dotknij, aby rozmawiać");
        views.setTextViewText(R.id.widget_demo_hint, "Otwiera /czat w Vanguard OS");

        Intent chatIntent = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse("https://localhost/czat"));
        chatIntent.setPackage(context.getPackageName());
        chatIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
            context,
            appWidgetId,
            chatIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_demo_root, pending);

        manager.updateAppWidget(appWidgetId, views);
    }
}

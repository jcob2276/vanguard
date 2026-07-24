package app.vanguard.os;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

public class VanguardFoodWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateWidget(context, manager, id);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_food);

        // Food Button Intent (https://localhost/dzis?capture=food)
        Intent foodIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://localhost/dzis?capture=food"));
        foodIntent.setPackage(context.getPackageName());
        foodIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingFood = PendingIntent.getActivity(
            context,
            appWidgetId * 10 + 3,
            foodIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.btn_open_food, pendingFood);

        // Notes Button Intent (https://localhost/keep)
        Intent notesIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://localhost/keep"));
        notesIntent.setPackage(context.getPackageName());
        notesIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingNotes = PendingIntent.getActivity(
            context,
            appWidgetId * 10 + 4,
            notesIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.btn_open_notes, pendingNotes);

        manager.updateAppWidget(appWidgetId, views);
    }
}

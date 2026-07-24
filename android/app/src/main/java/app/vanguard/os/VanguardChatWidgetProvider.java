package app.vanguard.os;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

public class VanguardChatWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateWidget(context, manager, id);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_czat);

        // Chat Button Intent (https://localhost/czat)
        Intent chatIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://localhost/czat"));
        chatIntent.setPackage(context.getPackageName());
        chatIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingChat = PendingIntent.getActivity(
            context,
            appWidgetId * 10 + 1,
            chatIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.btn_open_chat, pendingChat);

        // Voice Button Intent (https://localhost/dzis?capture=voice)
        Intent voiceIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://localhost/dzis?capture=voice"));
        voiceIntent.setPackage(context.getPackageName());
        voiceIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingVoice = PendingIntent.getActivity(
            context,
            appWidgetId * 10 + 2,
            voiceIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.btn_open_voice, pendingVoice);

        manager.updateAppWidget(appWidgetId, views);
    }
}

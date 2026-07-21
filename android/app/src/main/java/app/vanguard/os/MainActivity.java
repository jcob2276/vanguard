package app.vanguard.os;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private ShareIntentPlugin shareIntentPlugin;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UsageStatsPlugin.class);
        registerPlugin(BackgroundSyncPlugin.class);
        registerPlugin(ShareIntentPlugin.class);
        registerPlugin(WidgetBridgePlugin.class);
        registerPlugin(BleProbePlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        ShareIntentPlugin plugin = getShareIntentPlugin();
        if (plugin != null) {
            plugin.handleNewIntent(intent);
        } else {
            ShareIntentPlugin.deferIntent(intent);
        }
    }

    private ShareIntentPlugin getShareIntentPlugin() {
        if (shareIntentPlugin == null && getBridge() != null) {
            shareIntentPlugin = (ShareIntentPlugin) getBridge().getPlugin("ShareIntent").getInstance();
        }
        return shareIntentPlugin;
    }
}

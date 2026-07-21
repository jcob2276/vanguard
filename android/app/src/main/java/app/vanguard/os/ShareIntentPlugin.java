package app.vanguard.os;

import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "ShareIntent")
public class ShareIntentPlugin extends Plugin {

    private static final Pattern URL_PATTERN = Pattern.compile("https?://[^\\s]+");

    private static Intent deferredIntent;
    private String pendingQuery;

    static void deferIntent(Intent intent) {
        deferredIntent = intent;
    }

    @Override
    public void load() {
        captureIntent(getActivity().getIntent());
        if (deferredIntent != null) {
            captureIntent(deferredIntent);
            deferredIntent = null;
        }
    }

    void handleNewIntent(Intent intent) {
        captureIntent(intent);
    }

    @PluginMethod
    public void consumePending(PluginCall call) {
        JSObject ret = new JSObject();
        if (pendingQuery != null) {
            ret.put("query", pendingQuery);
            pendingQuery = null;
        }
        call.resolve(ret);
    }

    private void captureIntent(Intent intent) {
        if (intent == null) return;

        if (Intent.ACTION_SEND.equals(intent.getAction()) && "text/plain".equals(intent.getType())) {
            String text = intent.getStringExtra(Intent.EXTRA_TEXT);
            String title = intent.getStringExtra(Intent.EXTRA_SUBJECT);
            pendingQuery = buildShareQuery(text, title);
            intent.setAction(Intent.ACTION_MAIN);
            intent.removeExtra(Intent.EXTRA_TEXT);
            intent.removeExtra(Intent.EXTRA_SUBJECT);
            return;
        }

        if (Intent.ACTION_VIEW.equals(intent.getAction())) {
            Uri data = intent.getData();
            if (data != null && "https".equals(data.getScheme()) && "localhost".equals(data.getHost())) {
                String path = data.getPath() != null ? data.getPath() : "/";
                String search = data.getQuery() != null ? "?" + data.getQuery() : "";
                pendingQuery = "__path__=" + Uri.encode(path + search);
            }
        }
    }

    private String buildShareQuery(String text, String title) {
        String safeText = text != null ? text : "";
        StringBuilder query = new StringBuilder();
        query.append("share_text=").append(Uri.encode(safeText));
        if (title != null && !title.isEmpty()) {
            query.append("&share_title=").append(Uri.encode(title));
        }
        Matcher matcher = URL_PATTERN.matcher(safeText);
        if (matcher.find()) {
            query.append("&share_url=").append(Uri.encode(matcher.group()));
        }
        return query.toString();
    }
}

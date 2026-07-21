package app.vanguard.os;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "BleProbe",
    permissions = {
        @Permission(
            alias = "bluetoothScan",
            strings = { Manifest.permission.BLUETOOTH_SCAN }
        ),
        @Permission(
            alias = "bluetoothConnect",
            strings = { Manifest.permission.BLUETOOTH_CONNECT }
        ),
        @Permission(
            alias = "location",
            strings = { Manifest.permission.ACCESS_FINE_LOCATION }
        )
    }
)
public class BleProbePlugin extends Plugin {

    private BleScanSession session;

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject ret = new JSObject();
        BluetoothAdapter adapter = getAdapter();
        ret.put("supported", getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE));
        ret.put("enabled", adapter != null && adapter.isEnabled());
        ret.put("scanning", session != null && session.isScanning());
        ret.put("permissionsGranted", hasScanPermission() && hasConnectPermission());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (hasScanPermission() && hasConnectPermission()) {
            call.resolve();
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            requestPermissionForAlias("bluetoothScan", call, "permissionsCallback");
        } else {
            requestPermissionForAlias("location", call, "permissionsCallback");
        }
    }

    @PermissionCallback
    private void permissionsCallback(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !hasConnectPermission()) {
            requestPermissionForAlias("bluetoothConnect", call, "connectPermissionsCallback");
            return;
        }
        if (hasScanPermission() && hasConnectPermission()) {
            call.resolve();
        } else {
            call.reject("BLE_PERMISSION_DENIED");
        }
    }

    @PermissionCallback
    private void connectPermissionsCallback(PluginCall call) {
        if (hasScanPermission() && hasConnectPermission()) {
            call.resolve();
        } else {
            call.reject("BLE_PERMISSION_DENIED");
        }
    }

    @PluginMethod
    public void openBluetoothSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("BLUETOOTH_SETTINGS_UNAVAILABLE", e);
        }
    }

    @PluginMethod
    public void startScan(PluginCall call) {
        if (!hasScanPermission() || !hasConnectPermission()) {
            call.reject("BLE_PERMISSION_DENIED");
            return;
        }
        BluetoothAdapter adapter = getAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            call.reject("BLUETOOTH_OFF");
            return;
        }

        Integer durationMs = call.getInt("durationMs");
        int duration = durationMs != null ? durationMs : 12000;

        if (session != null) {
            session.stop();
        }
        session = new BleScanSession(getContext(), new BleScanSession.Listener() {
            @Override
            public void onDeviceFound(JSObject device) {
                notifyListeners("deviceFound", device);
            }

            @Override
            public void onScanFinished(JSArray devices, boolean ouraSeen) {
                JSObject payload = new JSObject();
                payload.put("devices", devices);
                payload.put("ouraSeen", ouraSeen);
                payload.put("count", devices.length());
                notifyListeners("scanFinished", payload);
            }
        });

        try {
            session.start(duration);
            JSObject ret = new JSObject();
            ret.put("durationMs", duration);
            call.resolve(ret);
        } catch (IllegalStateException e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void stopScan(PluginCall call) {
        if (session != null) {
            session.stop();
        }
        call.resolve();
    }

    @PluginMethod
    public void getLastResults(PluginCall call) {
        JSArray devices = session != null ? session.snapshot() : new JSArray();
        JSObject ret = new JSObject();
        ret.put("devices", devices);
        ret.put("count", devices.length());
        call.resolve(ret);
    }

    @Override
    protected void handleOnDestroy() {
        if (session != null) {
            session.stop();
            session = null;
        }
        super.handleOnDestroy();
    }

    private BluetoothAdapter getAdapter() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return manager != null ? manager.getAdapter() : null;
    }

    private boolean hasScanPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_SCAN)
                == PackageManager.PERMISSION_GRANTED;
        }
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasConnectPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT)
                == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }
}

package app.vanguard.os;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import java.util.LinkedHashMap;
import java.util.Map;

final class BleScanSession {

    interface Listener {
        void onDeviceFound(JSObject device);
        void onScanFinished(JSArray devices, boolean ouraSeen);
    }

    private final Context context;
    private final Listener listener;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Map<String, JSObject> devices = new LinkedHashMap<>();
    private BluetoothLeScanner scanner;
    private ScanCallback callback;
    private Runnable stopRunnable;

    BleScanSession(Context context, Listener listener) {
        this.context = context.getApplicationContext();
        this.listener = listener;
    }

    boolean isScanning() {
        return callback != null;
    }

    void start(int durationMs) {
        stopInternal(false);
        BluetoothAdapter adapter = getAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            throw new IllegalStateException("BLUETOOTH_OFF");
        }
        if (!hasScanPermission()) {
            throw new IllegalStateException("BLE_PERMISSION_DENIED");
        }

        scanner = adapter.getBluetoothLeScanner();
        if (scanner == null) {
            throw new IllegalStateException("BLE_SCANNER_UNAVAILABLE");
        }

        devices.clear();
        callback = new ScanCallback() {
            @Override
            public void onScanResult(int callbackType, ScanResult result) {
                handleResult(result);
            }

            @Override
            public void onBatchScanResults(java.util.List<ScanResult> results) {
                for (ScanResult result : results) {
                    handleResult(result);
                }
            }

            @Override
            public void onScanFailed(int errorCode) {
                stopInternal(true);
            }
        };

        ScanSettings settings = new ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build();
        scanner.startScan(null, settings, callback);

        stopRunnable = () -> stopInternal(true);
        handler.postDelayed(stopRunnable, Math.max(3000, durationMs));
    }

    void stop() {
        stopInternal(true);
    }

    JSArray snapshot() {
        JSArray array = new JSArray();
        for (JSObject device : devices.values()) {
            array.put(device);
        }
        return array;
    }

    private void stopInternal(boolean notify) {
        if (stopRunnable != null) {
            handler.removeCallbacks(stopRunnable);
            stopRunnable = null;
        }
        if (scanner != null && callback != null) {
            try {
                scanner.stopScan(callback);
            } catch (Exception ignored) {
                /* scanner may already be stopped */
            }
        }
        callback = null;
        scanner = null;

        if (notify) {
            boolean ouraSeen = false;
            for (JSObject device : devices.values()) {
                if (device.getBoolean("ouraLike", false)) {
                    ouraSeen = true;
                    break;
                }
            }
            listener.onScanFinished(snapshot(), ouraSeen);
        }
    }

    private void handleResult(ScanResult result) {
        if (result == null || result.getDevice() == null) return;
        String address = result.getDevice().getAddress();
        if (address == null) return;

        String name = result.getDevice().getName();
        if (name == null && result.getScanRecord() != null) {
            name = result.getScanRecord().getDeviceName();
        }
        java.util.List<android.os.ParcelUuid> serviceUuids = result.getScanRecord() != null
            ? result.getScanRecord().getServiceUuids()
            : null;
        boolean ouraLike = OuraBleMarkers.isOuraLike(name, serviceUuids);

        JSObject device = new JSObject();
        device.put("address", address);
        device.put("name", name != null ? name : "(bez nazwy)");
        device.put("rssi", result.getRssi());
        device.put("ouraLike", ouraLike);

        devices.put(address, device);
        listener.onDeviceFound(device);
    }

    private BluetoothAdapter getAdapter() {
        BluetoothManager manager = (BluetoothManager) context.getSystemService(Context.BLUETOOTH_SERVICE);
        return manager != null ? manager.getAdapter() : null;
    }

    private boolean hasScanPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN)
                == PackageManager.PERMISSION_GRANTED;
        }
        return ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
    }
}

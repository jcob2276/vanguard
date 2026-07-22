package app.vanguard.os;

import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattService;
import android.util.Log;
import java.util.UUID;

/**
 * Foundation for Oura Ring Direct BLE GATT Connection.
 * Isolated from active production sync pipelines until user enables BLE mode.
 */
public class OuraBleDriver {
    private static final String TAG = "OuraBleDriver";

    public static final UUID SERVICE_UUID = UUID.fromString(OuraBleMarkers.SERVICE_UUID);
    public static final UUID WRITE_CHAR_UUID = UUID.fromString("98ED0002-A541-11E4-B6A0-0002A5D5C51B");
    public static final UUID NOTIFY_CHAR_UUID = UUID.fromString("98ED0003-A541-11E4-B6A0-0002A5D5C51B");

    public static final int MTU_GEN3 = 203;

    public interface ConnectionCallback {
        void onConnected();
        void onDisconnected();
        void onError(String message);
        void onNotificationReceived(byte[] data);
    }

    private final ConnectionCallback callback;
    private BluetoothGatt bluetoothGatt;

    public OuraBleDriver(ConnectionCallback callback) {
        this.callback = callback;
    }

    public void onServicesDiscovered(BluetoothGatt gatt, int status) {
        if (status != BluetoothGatt.GATT_SUCCESS) {
            Log.w(TAG, "Services discovery failed with status: " + status);
            if (callback != null) callback.onError("Service discovery failed");
            return;
        }

        BluetoothGattService service = gatt.getService(SERVICE_UUID);
        if (service == null) {
            Log.w(TAG, "Oura primary GATT service not found");
            if (callback != null) callback.onError("Oura GATT service missing");
            return;
        }

        Log.i(TAG, "Oura primary GATT service discovered successfully");
        this.bluetoothGatt = gatt;
        if (callback != null) callback.onConnected();
    }

    public boolean requestGen3Mtu() {
        if (bluetoothGatt == null) return false;
        Log.i(TAG, "Requesting Gen3 MTU clamp: " + MTU_GEN3);
        return bluetoothGatt.requestMtu(MTU_GEN3);
    }
}

package app.vanguard.os;

import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothProfile;
import android.util.Log;
import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.util.Arrays;
import java.util.UUID;

/**
 * Complete Oura Ring Direct BLE GATT Connection & Background Daemon Callback Engine.
 * Implements full BluetoothGattCallback lifecycle for background sync.
 */
public class OuraBleDriver {
    private static final String TAG = "OuraBleDriver";

    public static final UUID SERVICE_UUID = UUID.fromString(OuraBleMarkers.SERVICE_UUID);
    public static final UUID WRITE_CHAR_UUID = UUID.fromString("98ED0002-A541-11E4-B6A0-0002A5D5C51B");
    public static final UUID NOTIFY_CHAR_UUID = UUID.fromString("98ED0003-A541-11E4-B6A0-0002A5D5C51B");
    public static final UUID CCCD_UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

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

    public final BluetoothGattCallback gattCallback = new BluetoothGattCallback() {
        @Override
        public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                Log.i(TAG, "Oura BLE Connected in background. Discovering services...");
                bluetoothGatt = gatt;
                gatt.discoverServices();
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                Log.i(TAG, "Oura BLE Disconnected.");
                bluetoothGatt = null;
                if (callback != null) callback.onDisconnected();
            }
        }

        @Override
        public void onServicesDiscovered(BluetoothGatt gatt, int status) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                if (callback != null) callback.onError("Service discovery failed: " + status);
                return;
            }
            BluetoothGattService service = gatt.getService(SERVICE_UUID);
            if (service == null) {
                if (callback != null) callback.onError("Oura primary service missing");
                return;
            }
            Log.i(TAG, "Oura primary GATT service discovered. Requesting MTU " + MTU_GEN3);
            gatt.requestMtu(MTU_GEN3);
        }

        @Override
        public void onMtuChanged(BluetoothGatt gatt, int mtu, int status) {
            Log.i(TAG, "MTU changed to " + mtu + " (status " + status + "). Enabling notifications...");
            enableNotifications(gatt);
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic) {
            if (NOTIFY_CHAR_UUID.equals(characteristic.getUuid())) {
                byte[] value = characteristic.getValue();
                if (value != null && callback != null) {
                    callback.onNotificationReceived(value);
                }
            }
        }
    };

    private void enableNotifications(BluetoothGatt gatt) {
        BluetoothGattService service = gatt.getService(SERVICE_UUID);
        if (service == null) return;
        BluetoothGattCharacteristic notifyChar = service.getCharacteristic(NOTIFY_CHAR_UUID);
        if (notifyChar == null) return;

        gatt.setCharacteristicNotification(notifyChar, true);
        BluetoothGattDescriptor descriptor = notifyChar.getDescriptor(CCCD_UUID);
        if (descriptor != null) {
            descriptor.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
            gatt.writeDescriptor(descriptor);
            Log.i(TAG, "Oura BLE Notifications enabled on CCCD descriptor");
            if (callback != null) callback.onConnected();
        }
    }

    public static byte[] computeAuthProof(byte[] nonce15, byte[] authKey16) throws Exception {
        if (nonce15 == null || nonce15.length != 15) throw new IllegalArgumentException("Nonce must be 15 bytes");
        if (authKey16 == null || authKey16.length != 16) throw new IllegalArgumentException("Key must be 16 bytes");

        byte[] plaintext = new byte[32];
        System.arraycopy(nonce15, 0, plaintext, 0, 15);
        plaintext[15] = 0x01;
        for (int i = 16; i < 32; i++) {
            plaintext[i] = 0x10;
        }

        SecretKeySpec secretKey = new SecretKeySpec(authKey16, "AES");
        Cipher cipher = Cipher.getInstance("AES/ECB/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, secretKey);
        byte[] ciphertext = cipher.doFinal(plaintext);

        return Arrays.copyOfRange(ciphertext, 0, 16);
    }

    public boolean writeCommand(byte[] commandBytes) {
        if (bluetoothGatt == null) return false;
        BluetoothGattService service = bluetoothGatt.getService(SERVICE_UUID);
        if (service == null) return false;
        BluetoothGattCharacteristic writeChar = service.getCharacteristic(WRITE_CHAR_UUID);
        if (writeChar == null) return false;

        writeChar.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE);
        writeChar.setValue(commandBytes);
        return bluetoothGatt.writeCharacteristic(writeChar);
    }
}

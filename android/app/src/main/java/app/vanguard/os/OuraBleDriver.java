package app.vanguard.os;

import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattService;
import android.util.Log;
import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.util.Arrays;
import java.util.UUID;

/**
 * Complete Oura Ring Direct BLE GATT Connection & AES Cryptographic Proof Driver.
 * Includes AES-128-ECB challenge-proof computation (OURA_PROTOCOL.md s3.4).
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

    /**
     * Compute AES-128-ECB Auth Proof from 15-byte nonce and 16-byte auth_key.
     * Plaintext: nonce(15) || 0x01 || PKCS7 full-block pad (0x10 x16).
     * Per OURA_PROTOCOL.md s3.4 / Auth.swift.
     */
    public static byte[] computeAuthProof(byte[] nonce15, byte[] authKey16) throws Exception {
        if (nonce15 == null || nonce15.length != 15) throw new IllegalArgumentException("Nonce must be 15 bytes");
        if (authKey16 == null || authKey16.length != 16) throw new IllegalArgumentException("Key must be 16 bytes");

        byte[] plaintext = new byte[32];
        System.arraycopy(nonce15, 0, plaintext, 0, 15);
        plaintext[15] = 0x01;
        for (int i = 16; i < 32; i++) {
            plaintext[i] = 0x10; // PKCS7 pad byte
        }

        SecretKeySpec secretKey = new SecretKeySpec(authKey16, "AES");
        Cipher cipher = Cipher.getInstance("AES/ECB/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, secretKey);
        byte[] ciphertext = cipher.doFinal(plaintext);

        return Arrays.copyOfRange(ciphertext, 0, 16);
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

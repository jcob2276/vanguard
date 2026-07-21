package app.vanguard.os;

/** Oura base service UUID — detection only (noop/OURA_PROTOCOL.md). */
final class OuraBleMarkers {
    static final String SERVICE_UUID = "98ED0001-A541-11E4-B6A0-0002A5D5C51B";

    private OuraBleMarkers() {}

    static boolean isOuraLike(String name, java.util.List<android.os.ParcelUuid> serviceUuids) {
        if (name != null) {
            final String lower = name.toLowerCase();
            if (lower.contains("oura")) return true;
        }
        if (serviceUuids == null) return false;
        for (android.os.ParcelUuid uuid : serviceUuids) {
            if (uuid != null && SERVICE_UUID.equalsIgnoreCase(uuid.getUuid().toString())) {
                return true;
            }
        }
        return false;
    }
}

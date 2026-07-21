import { useCallback, useEffect, useState } from 'react';
import { Bluetooth, Radio } from 'lucide-react';
import Button from '../ui/Button';
import { Card } from '../ui/Card';
import { notify } from '../../lib/notify';
import {
  ensureBlePermissions,
  fetchBleProbeStatus,
  initBleScanListeners,
  mergeBleDevices,
  openBluetoothSettings,
  startBleScan,
  stopBleScan,
  type BleDeviceHit,
} from '../../lib/native/bleProbe';

export default function BleDemoCard() {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof fetchBleProbeStatus>> | null>(null);
  const [devices, setDevices] = useState<BleDeviceHit[]>([]);
  const [scanning, setScanning] = useState(false);
  const [ouraSeen, setOuraSeen] = useState<boolean | null>(null);

  const refreshStatus = useCallback(async () => {
    setStatus(await fetchBleProbeStatus());
  }, []);

  useEffect(() => {
     
    void fetchBleProbeStatus().then(setStatus);
    return initBleScanListeners({
      onDeviceFound: (device) => {
        setDevices((prev) => mergeBleDevices(prev, device));
      },
      onScanFinished: (payload) => {
        setScanning(false);
        setOuraSeen(payload.ouraSeen);
        setDevices(payload.devices ?? []);
        void refreshStatus();
        if (payload.ouraSeen) {
          notify('Wykryto urządzenie Oura-like w BLE — protokół na później', 'success');
        } else {
          notify(`Skan zakończony: ${payload.count} urządzeń`, 'info');
        }
      },
    });
  }, [refreshStatus]);

  const runScan = async () => {
    setDevices([]);
    setOuraSeen(null);
    const granted = await ensureBlePermissions();
    await refreshStatus();
    if (!granted) {
      notify('Zezwól na Bluetooth (i lokalizację na starszym Androidzie)', 'error');
      return;
    }
    const st = await fetchBleProbeStatus();
    if (!st.enabled) {
      notify('Włącz Bluetooth w ustawieniach telefonu', 'error');
      return;
    }
    setScanning(true);
    try {
      await startBleScan(12_000);
    } catch (err: unknown) {
      setScanning(false);
      notify(err instanceof Error ? err.message : 'Skan BLE nie wystartował', 'error');
    }
  };

  return (
    <Card padding="1rem" className="space-y-4">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-text-muted">
        <Bluetooth size={13} /> BLE probe (demo)
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
        <span>BLE: {status?.supported ? 'OK' : 'brak'}</span>
        <span>BT: {status?.enabled ? 'wł.' : 'wył.'}</span>
        <span>Uprawn.: {status?.permissionsGranted ? 'OK' : '?'}</span>
        {ouraSeen !== null && (
          <span className={ouraSeen ? 'text-success font-semibold' : ''}>
            Oura-like: {ouraSeen ? 'tak' : 'nie'}
          </span>
        )}
      </div>

      <p className="text-2xs text-text-muted">
        Skan ~12 s. Szukamy nazwy „Oura” lub service UUID z noop — bez łączenia i bez odczytu danych z pierścienia.
        Trzymaj pierścień blisko telefonu i miej go na palcu lub w ładowarce.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" loading={scanning} onClick={() => void runScan()} className="flex-1">
          Skanuj BLE
        </Button>
        <Button type="button" variant="outline" onClick={() => void stopBleScan()} disabled={!scanning} className="flex-1">
          Stop
        </Button>
        <Button type="button" variant="outline" onClick={() => openBluetoothSettings()} className="flex-1">
          Bluetooth
        </Button>
      </div>

      {devices.length > 0 && (
        <ul className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border-custom/30 bg-surface-solid/30 p-3 text-xs">
          {devices.map((d) => (
            <li key={d.address} className="flex items-start gap-2">
              <Radio size={12} className={d.ouraLike ? 'text-success mt-0.5 shrink-0' : 'text-text-muted mt-0.5 shrink-0'} />
              <div className="min-w-0">
                <p className="font-semibold text-text-primary truncate">
                  {d.name}
                  {d.ouraLike ? ' · Oura?' : ''}
                </p>
                <p className="text-text-muted tabular-nums">{d.rssi} dBm · {d.address}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

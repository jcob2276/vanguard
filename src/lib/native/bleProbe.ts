/**
 * BLE scan probe — proof that Android APK can see BLE devices (Oura detection only, no protocol).
 */
import { isNativePlatform } from './platform';
import {
  BleProbe,
  type BleDeviceHit,
  type BleProbeStatus,
  type BleScanFinishedEvent,
} from './bleProbePlugin';

export type { BleDeviceHit, BleProbeStatus, BleScanFinishedEvent };

export async function fetchBleProbeStatus(): Promise<BleProbeStatus> {
  if (!isNativePlatform()) {
    return { supported: false, enabled: false, scanning: false, permissionsGranted: false };
  }
  return BleProbe.getStatus();
}

export async function ensureBlePermissions(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    const status = await BleProbe.getStatus();
    if (status.permissionsGranted) return true;
    await BleProbe.requestPermissions();
    const after = await BleProbe.getStatus();
    return after.permissionsGranted;
  } catch {
    return false;
  }
}

export async function startBleScan(durationMs = 12_000): Promise<void> {
  if (!isNativePlatform()) return;
  await BleProbe.startScan({ durationMs });
}

export async function stopBleScan(): Promise<void> {
  if (!isNativePlatform()) return;
  await BleProbe.stopScan();
}

export async function openBluetoothSettings(): Promise<void> {
  if (!isNativePlatform()) return;
  await BleProbe.openBluetoothSettings();
}

export function initBleScanListeners(handlers: {
  onDeviceFound?: (device: BleDeviceHit) => void;
  onScanFinished?: (payload: BleScanFinishedEvent) => void;
}): () => void {
  if (!isNativePlatform()) return () => {};

  const subs: Array<Promise<{ remove: () => Promise<void> }>> = [];
  if (handlers.onDeviceFound) {
    subs.push(BleProbe.addListener('deviceFound', handlers.onDeviceFound));
  }
  if (handlers.onScanFinished) {
    subs.push(BleProbe.addListener('scanFinished', handlers.onScanFinished));
  }

  return () => {
    for (const sub of subs) {
      void sub.then((h) => h.remove());
    }
  };
}

export function mergeBleDevices(existing: BleDeviceHit[], incoming: BleDeviceHit): BleDeviceHit[] {
  const map = new Map(existing.map((d) => [d.address, d]));
  map.set(incoming.address, incoming);
  return [...map.values()].sort((a, b) => b.rssi - a.rssi);
}

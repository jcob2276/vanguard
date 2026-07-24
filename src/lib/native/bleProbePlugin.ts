import { registerPlugin } from '@capacitor/core';

export interface BleDeviceHit {
  address: string;
  name?: string;
  rssi: number;
  ouraLike: boolean;
}

export interface BleProbeStatus {
  available: boolean;
  adapterOn: boolean;
  permissionGranted: boolean;
  reason?: string;
}

export interface BleScanFinishedEvent {
  hitsCount: number;
  stoppedByTimeout: boolean;
}

export interface BleProbePlugin {
  getStatus(): Promise<BleProbeStatus>;
  requestPermissions(): Promise<{ granted: boolean }>;
  startScan(options?: { timeoutMs?: number; durationMs?: number }): Promise<{ scanning: boolean }>;
  stopScan(): Promise<{ scanning: boolean }>;
  addListener(
    eventName: 'deviceFound',
    listenerFunc: (device: BleDeviceHit) => void
  ): Promise<{ remove: () => void }>;
  addListener(
    eventName: 'scanFinished',
    listenerFunc: (event: BleScanFinishedEvent) => void
  ): Promise<{ remove: () => void }>;
}

export const BleProbe = registerPlugin<BleProbePlugin>('BleProbe');

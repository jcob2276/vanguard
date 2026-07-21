import { registerPlugin } from '@capacitor/core';

export interface BleDeviceHit {
  address: string;
  name: string;
  rssi: number;
  ouraLike: boolean;
}

export interface BleProbeStatus {
  supported: boolean;
  enabled: boolean;
  scanning: boolean;
  permissionsGranted: boolean;
}

export interface BleScanFinishedEvent {
  devices: BleDeviceHit[];
  ouraSeen: boolean;
  count: number;
}

export interface BleProbePlugin {
  getStatus(): Promise<BleProbeStatus>;
  requestPermissions(): Promise<void>;
  openBluetoothSettings(): Promise<void>;
  startScan(options?: { durationMs?: number }): Promise<{ durationMs: number }>;
  stopScan(): Promise<void>;
  getLastResults(): Promise<{ devices: BleDeviceHit[]; count: number }>;
  addListener(
    eventName: 'deviceFound',
    listenerFunc: (device: BleDeviceHit) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: 'scanFinished',
    listenerFunc: (payload: BleScanFinishedEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

export const BleProbe = registerPlugin<BleProbePlugin>('BleProbe');

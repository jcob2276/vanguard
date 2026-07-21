import { registerPlugin } from '@capacitor/core';



interface BackgroundSyncRunningResult {

  running: boolean;

}



interface BackgroundSyncIgnoredResult {

  ignored: boolean;

}



export interface BackgroundSyncPlugin {

  isRunning(): Promise<BackgroundSyncRunningResult>;

  start(): Promise<BackgroundSyncRunningResult>;

  stop(): Promise<BackgroundSyncRunningResult>;

  isIgnoringBatteryOptimizations(): Promise<BackgroundSyncIgnoredResult>;

  requestIgnoreBatteryOptimizations(): Promise<void>;

  openBatteryOptimizationSettings(): Promise<void>;

  openAutostartSettings(): Promise<void>;

  openAppSettings(): Promise<void>;

  addListener(

    eventName: 'syncTick',

    listenerFunc: () => void,

  ): Promise<{ remove: () => Promise<void> }>;

}



export const BackgroundSync = registerPlugin<BackgroundSyncPlugin>('BackgroundSync');


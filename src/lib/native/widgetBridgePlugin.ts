import { registerPlugin } from '@capacitor/core';

export interface WidgetDemoState {
  modeId: string;
  modeLabel: string;
  modeIndex: number;
  tapCount: number;
}

export interface WidgetBridgePlugin {
  getDemoState(): Promise<WidgetDemoState>;
  cycleDemoMode(): Promise<WidgetDemoState>;
  refreshDemoWidget(): Promise<WidgetDemoState>;
  requestPinDemoWidget(): Promise<void>;
  addListener(
    eventName: 'demoStateChanged',
    listenerFunc: (state: WidgetDemoState) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

export const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

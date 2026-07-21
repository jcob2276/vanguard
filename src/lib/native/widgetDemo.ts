/**
 * Demo widget ↔ app bridge (SharedPreferences + live listener).
 */
import { App } from '@capacitor/app';
import { isNativePlatform } from './platform';
import { WidgetBridge, type WidgetDemoState } from './widgetBridgePlugin';

const DEFAULT_STATE: WidgetDemoState = {
  modeId: 'focus',
  modeLabel: 'Focus',
  modeIndex: 0,
  tapCount: 0,
};

export async function fetchWidgetDemoState(): Promise<WidgetDemoState> {
  if (!isNativePlatform()) return DEFAULT_STATE;
  try {
    return await WidgetBridge.getDemoState();
  } catch {
    return DEFAULT_STATE;
  }
}

export async function cycleWidgetDemoFromApp(): Promise<WidgetDemoState> {
  if (!isNativePlatform()) return DEFAULT_STATE;
  return WidgetBridge.cycleDemoMode();
}

export async function requestPinDemoWidget(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    await WidgetBridge.requestPinDemoWidget();
    return true;
  } catch {
    return false;
  }
}

export function initWidgetDemoSync(onChange: (state: WidgetDemoState) => void): () => void {
  if (!isNativePlatform()) return () => {};

  void fetchWidgetDemoState().then(onChange);

  const listener = WidgetBridge.addListener('demoStateChanged', (state) => {
    onChange(state);
  });

  const resume = App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      void fetchWidgetDemoState().then(onChange);
    }
  });

  return () => {
    void listener.then((h) => h.remove());
    void resume.then((h) => h.remove());
  };
}

export const WIDGET_DEMO_MODE_COLORS: Record<string, string> = {
  focus: 'text-primary',
  rest: 'text-success',
  move: 'text-warning',
};

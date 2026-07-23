import {
  Haptics,
  ImpactStyle,
  NotificationType,
} from '@capacitor/haptics';
import { isNativePlatform } from '../lib/native/platform';

const vibrate = (pattern: number | number[]) => {
  try { navigator.vibrate?.(pattern); } catch { /* vibration unsupported/blocked */ }
};

const nativeOrWeb = (nativeFeedback: () => Promise<void>, webPattern: number | number[]) => {
  if (isNativePlatform()) {
    void nativeFeedback().catch(() => vibrate(webPattern));
    return;
  }
  vibrate(webPattern);
};

const haptics = {
  selection: () => nativeOrWeb(() => Haptics.selectionChanged(), 6),
  light: () => nativeOrWeb(() => Haptics.impact({ style: ImpactStyle.Light }), 10),
  medium: () => nativeOrWeb(() => Haptics.impact({ style: ImpactStyle.Medium }), 20),
  heavy: () => nativeOrWeb(() => Haptics.impact({ style: ImpactStyle.Heavy }), 30),
  success: () => nativeOrWeb(
    () => Haptics.notification({ type: NotificationType.Success }),
    [10, 50, 10],
  ),
  warning: () => nativeOrWeb(
    () => Haptics.notification({ type: NotificationType.Warning }),
    [15, 40, 15],
  ),
  error: () => nativeOrWeb(
    () => Haptics.notification({ type: NotificationType.Error }),
    [20, 30, 20],
  ),
  vibrate: (pattern: number | number[]) => vibrate(pattern),
};

export function useHaptics() {
  return haptics;
}

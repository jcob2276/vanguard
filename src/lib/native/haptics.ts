import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { isNativePlatform } from './platform';

export async function triggerHaptic(style: ImpactStyle = ImpactStyle.Light): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await Haptics.impact({ style });
  } catch {
    /* ignore on unsupported platforms */
  }
}

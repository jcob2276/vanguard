const vibrate = (pattern: number | number[]) => {
  try { navigator.vibrate?.(pattern); } catch { /* vibration unsupported/blocked */ }
};

const haptics = {
  light: () => vibrate(10),
  medium: () => vibrate(20),
  success: () => vibrate([10, 50, 10]),
  error: () => vibrate([20, 30, 20]),
};

export function useHaptics() {
  return haptics;
}

const vibrate = (pattern: number | number[]) => {
  try { navigator.vibrate?.(pattern); } catch {}
};

export function useHaptics() {
  return {
    light: () => vibrate(10),
    medium: () => vibrate(20),
    success: () => vibrate([10, 50, 10]),
    error: () => vibrate([20, 30, 20]),
  };
}

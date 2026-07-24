/**
 * Capacitor shell bootstrap — status bar + splash + back-button hygiene.
 * Safe no-op on PWA / browser (isNativePlatform guard).
 */
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { isNativePlatform } from './platform';

function cssColor(varName: string, fallback: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return raw || fallback;
}

export async function initNativeShell(): Promise<void> {
  if (!isNativePlatform()) return;

  document.documentElement.classList.add('capacitor-native');
  document.body.classList.add('capacitor-native');

  try {
    // Prefer design token; StatusBar API needs a concrete color string.
    const bg = cssColor('--background', cssColor('--bg-primary', 'transparent'));
    if (bg !== 'transparent') {
      await StatusBar.setBackgroundColor({ color: bg });
    }
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    /* StatusBar unsupported on some WebView builds */
  }

  try {
    await SplashScreen.hide();
  } catch {
    /* Splash already auto-hidden */
  }

  // Android hardware back: leave the WebView instead of blank history traps.
  await CapApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      void CapApp.exitApp();
    }
  });
}

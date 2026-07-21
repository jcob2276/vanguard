import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android shell for Vanguard.
 * PWA on Vercel is unchanged — this config only affects `npm run mobile:*` builds.
 * Web dir must match Vite `outDir` (default: dist).
 */
const config: CapacitorConfig = {
  appId: 'app.vanguard.os',
  appName: 'Vanguard',
  webDir: 'dist',
  server: {
    // Prefer HTTPS assets from the bundled dist; no live reload in production APK.
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      // Keep in sync with .dark --background in src/index.css (native splash can't read CSS vars).
      backgroundColor: '#1C1917',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1C1917',
    },
  },
};

export default config;

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App'
import { initOfflineSync } from './lib/offlineQueue'
import { queryClient } from './lib/queryClient'

// Flush anything queued while offline and retry automatically on reconnect.
initOfflineSync()

// Auto-unregister service workers in development mode to prevent stale cache issues on localhost
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().then((success) => {
        if (success) {
          console.log('Stale Service Worker unregistered successfully in DEV mode.');
          window.location.reload();
        }
      });
    }
  });
}

window.onerror = function(msg, _url, line) {
  const errorMsg = "ERR: " + msg + "\nLine: " + line;
  console.error(errorMsg);
};

try {
  const container = document.getElementById('root');
  if (!container) {
    throw new Error('Root container not found');
  }

  const root = createRoot(container);
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>
  );
} catch (e: unknown) {
      console.error('[App Critical] Root render failed:', e);
    }

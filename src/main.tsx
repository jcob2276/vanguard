import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

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
      <App />
    </StrictMode>
  );
} catch (e) {
  console.error("Vanguard: Mount Crash", e);
}

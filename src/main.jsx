import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

window.onerror = function(msg, url, line) {
  const errorMsg = "ERR: " + msg + "\nLine: " + line;
  console.error(errorMsg);
};

try {
  const container = document.getElementById('root');
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} catch (e) {
  console.error("Vanguard: Mount Crash", e);
}

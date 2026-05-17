import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

console.log("Vanguard: Initializing...");

window.onerror = function(msg, url, line) {
  const errorMsg = "ERR: " + msg + "\nLine: " + line;
  console.error(errorMsg);
  alert(errorMsg);
};

try {
  const container = document.getElementById('root');
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  console.log("Vanguard: Render called");
} catch (e) {
  console.error("Vanguard: Mount Crash", e);
  alert("Mount Crash: " + e.message);
}

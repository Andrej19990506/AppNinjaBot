import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App'

// --- Предотвращаем double-tap zoom на мобильных устройствах ---
let lastTouchEnd = 0;
document.addEventListener('touchend', function(event) {
  const now = (new Date()).getTime();
  if (now - lastTouchEnd <= 300) {
    event.preventDefault();
  }
  lastTouchEnd = now;
}, false);

createRoot(document.getElementById('root')!).render(
  <App />
)

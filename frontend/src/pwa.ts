import { registerSW } from 'virtual:pwa-register';

function ensureStyles() {
  if (document.getElementById('pwa-update-styles')) return;
  const style = document.createElement('style');
  style.id = 'pwa-update-styles';
  style.textContent = `
    .pwa-update-banner {
      position: fixed;
      left: 12px;
      right: 12px;
      bottom: calc(12px + env(safe-area-inset-bottom));
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(20, 20, 20, 0.92);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      box-shadow: 0 12px 30px rgba(0,0,0,0.35);
      font: 14px/1.25 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    }
    .pwa-update-banner__text { flex: 1; }
    .pwa-update-banner__btn {
      appearance: none;
      border: 0;
      border-radius: 10px;
      padding: 10px 12px;
      background: #2f80ff;
      color: #fff;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    .pwa-update-banner__close {
      appearance: none;
      border: 0;
      background: transparent;
      color: rgba(255,255,255,0.7);
      cursor: pointer;
      padding: 8px;
      margin: -4px -6px -4px 0;
      border-radius: 10px;
      font-size: 18px;
      line-height: 1;
    }
  `;
  document.head.appendChild(style);
}

function showUpdateBanner(onUpdate: () => void) {
  ensureStyles();

  const existing = document.getElementById('pwa-update-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'pwa-update-banner';
  banner.className = 'pwa-update-banner';

  const text = document.createElement('div');
  text.className = 'pwa-update-banner__text';
  text.textContent = 'Доступно обновление приложения.';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pwa-update-banner__btn';
  btn.textContent = 'Обновить';
  btn.addEventListener('click', () => onUpdate());

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'pwa-update-banner__close';
  close.setAttribute('aria-label', 'Закрыть');
  close.textContent = '×';
  close.addEventListener('click', () => banner.remove());

  banner.appendChild(text);
  banner.appendChild(btn);
  banner.appendChild(close);
  document.body.appendChild(banner);
}

export function setupPwaUpdatePrompt() {
  // Возвращает функцию updateSW, которая активирует новый SW
  const updateSW = registerSW({
    onNeedRefresh() {
      showUpdateBanner(() => updateSW(true));
    },
    // onOfflineReady() можно добавить, если захотите показывать "доступно оффлайн"
  });
}


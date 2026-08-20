import { registerSW } from 'virtual:pwa-register';

// Экран обновления намеренно во весь экран и без крестика.
// Раньше это была узкая плашка внизу: пользователи её просто не замечали и
// продолжали сидеть на старой версии — а старая версия ходит в изменившийся API.
// Поэтому теперь обновление нельзя пропустить: оно перекрывает интерфейс, пока
// человек не нажмёт кнопку, после чего страница перезагружается уже на новой
// версии и работа продолжается как обычно.
//
// Размытия фона здесь нет сознательно: на слабых телефонах оно стоит кадров
// (та же причина, по которой его убрали из шторки календаря).

const OVERLAY_ID = 'pwa-update-overlay';
const STYLE_ID = 'pwa-update-styles';

// Если обслуживающий воркер по какой-то причине не перезагрузит страницу,
// человек не должен остаться запертым под этим экраном.
const RELOAD_FALLBACK_MS = 8000;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .pwa-update-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      padding-bottom: calc(24px + env(safe-area-inset-bottom));
      background: rgba(0, 0, 0, 0.72);
      font: 15px/1.45 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      animation: pwa-update-fade 0.2s ease-out;
    }
    @keyframes pwa-update-fade { from { opacity: 0; } to { opacity: 1; } }

    .pwa-update-card {
      width: 100%;
      max-width: 360px;
      box-sizing: border-box;
      padding: 24px;
      border-radius: 18px;
      background: var(--card-background, #1c1c1e);
      color: var(--text-color, #fff);
      border: 1px solid var(--border-color, rgba(255,255,255,0.12));
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
      text-align: center;
    }
    .pwa-update-card__icon {
      display: flex;
      justify-content: center;
      margin-bottom: 14px;
      color: var(--primary-color, #2f80ff);
    }
    .pwa-update-card__icon svg { width: 44px; height: 44px; display: block; }
    .pwa-update-card__title {
      margin: 0 0 8px;
      font-size: 19px;
      font-weight: 700;
    }
    .pwa-update-card__text {
      margin: 0 0 20px;
      color: var(--text-secondary, rgba(255,255,255,0.7));
    }
    .pwa-update-card__btn {
      appearance: none;
      border: 0;
      width: 100%;
      border-radius: 12px;
      padding: 15px 16px;
      background: var(--primary-color, #2f80ff);
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
    }
    .pwa-update-card__btn:disabled { opacity: 0.6; cursor: default; }
    .pwa-update-card__hint {
      margin: 14px 0 0;
      font-size: 13px;
      color: var(--text-secondary, rgba(255,255,255,0.6));
    }
    .pwa-update-card__link {
      appearance: none;
      border: 0;
      background: transparent;
      padding: 0;
      color: var(--primary-color, #2f80ff);
      font: inherit;
      font-weight: 600;
      text-decoration: underline;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);
}

function showUpdateOverlay(onUpdate: () => void) {
  ensureStyles();

  document.getElementById(OVERLAY_ID)?.remove();

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'pwa-update-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const card = document.createElement('div');
  card.className = 'pwa-update-card';

  const icon = document.createElement('div');
  icon.className = 'pwa-update-card__icon';
  icon.setAttribute('aria-hidden', 'true');
  // Tabler «refresh» — та же система иконок, что и в Android-приложениях:
  // сетка 24, обводка 2, круглые концы, без заливки.
  icon.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
    ' stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" />' +
    '<path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />' +
    '</svg>';

  const title = document.createElement('h2');
  title.className = 'pwa-update-card__title';
  title.textContent = 'Вышла новая версия';

  const text = document.createElement('p');
  text.className = 'pwa-update-card__text';
  text.textContent =
    'Нужно обновиться, чтобы приложение работало правильно. Это займёт пару секунд — записи и смены не потеряются.';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pwa-update-card__btn';
  btn.textContent = 'Обновить';

  const hint = document.createElement('p');
  hint.className = 'pwa-update-card__hint';
  hint.hidden = true;

  btn.addEventListener('click', () => {
    btn.disabled = true;
    btn.textContent = 'Обновляем…';

    // Страховка: если воркер не перезагрузил страницу, даём это сделать руками,
    // иначе человек останется заперт под непропускаемым экраном.
    window.setTimeout(() => {
      hint.hidden = false;
      hint.textContent = 'Что-то затянулось. ';
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'pwa-update-card__link';
      link.textContent = 'Перезагрузить вручную';
      link.addEventListener('click', () => window.location.reload());
      hint.appendChild(link);
    }, RELOAD_FALLBACK_MS);

    onUpdate();
  });

  card.appendChild(icon);
  card.appendChild(title);
  card.appendChild(text);
  card.appendChild(btn);
  card.appendChild(hint);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // Под экраном обновления фон листаться не должен
  document.body.style.overflow = 'hidden';

  btn.focus();
}

export function setupPwaUpdatePrompt() {
  // Возвращает функцию updateSW, которая активирует новый SW и перезагружает страницу
  const updateSW = registerSW({
    onNeedRefresh() {
      showUpdateOverlay(() => updateSW(true));
    },
    // onOfflineReady() можно добавить, если захотите показывать "доступно оффлайн"
  });
}

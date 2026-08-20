// Стабильная нижняя безопасная зона.
//
// На iOS с viewport-fit=cover значение env(safe-area-inset-bottom) НЕ постоянно:
// пока видна нижняя панель браузера (или панель Telegram), контент до края экрана
// не достаёт и инсет равен нулю; стоит панели свернуться при скролле — инсет
// становится равен полосе домашней кнопки (34px и подобные). Футер приклеен к низу
// и добавляет этот инсет в padding-bottom, поэтому его высота скачет прямо под
// пальцем: появляется пустое место, кнопки уезжают, попасть в них тяжело.
//
// Стили футера уже рассчитаны на лечение — там стоит
// max(env(safe-area-inset-bottom), var(--device-bottom-inset)), — но саму
// переменную никто никогда не выставлял, поэтому max всегда брал живой env.
//
// Здесь эта переменная и выставляется: запоминаем НАИБОЛЬШИЙ инсет, который
// устройство когда-либо показывало, и держим его. Тогда max() перестаёт зависеть
// от того, свёрнута сейчас панель браузера или нет, и высота футера постоянна.
// Плата за это — при видимой панели браузера внизу остаётся зарезервированная
// полоса. Постоянный отступ лучше прыгающего: под панелью там всё равно нельзя
// ничего нажать.

const CSS_VAR = '--device-bottom-inset';

/** Реальное значение env(safe-area-inset-bottom) в пикселях. */
function readSafeAreaBottom(): number {
    const probe = document.createElement('div');
    probe.style.cssText = [
        'position:fixed',
        'left:-9999px',
        'bottom:0',
        'width:0',
        'height:0',
        'visibility:hidden',
        'pointer-events:none',
        'padding-bottom:env(safe-area-inset-bottom, 0px)',
    ].join(';');

    document.body.appendChild(probe);
    const value = parseFloat(window.getComputedStyle(probe).paddingBottom);
    probe.remove();

    return Number.isFinite(value) ? value : 0;
}

export function setupStableBottomInset(): void {
    let maxInset = 0;

    const apply = () => {
        const current = readSafeAreaBottom();
        if (current > maxInset) {
            maxInset = current;
            document.documentElement.style.setProperty(CSS_VAR, `${maxInset}px`);
        }
    };

    apply();

    // Первое измерение может прийтись на момент, когда панель браузера ещё
    // развёрнута и инсет равен нулю. Настоящее значение приходит при первом же
    // изменении вьюпорта — скролле, повороте, открытии клавиатуры.
    window.visualViewport?.addEventListener('resize', apply);
    window.addEventListener('resize', apply);

    // В другой ориентации инсеты другие, накопленный максимум там не годится.
    window.addEventListener('orientationchange', () => {
        maxInset = 0;
        document.documentElement.style.removeProperty(CSS_VAR);
        // Значение становится актуальным только после перекладки вьюпорта.
        window.setTimeout(apply, 300);
    });
}

export const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const MONTH_NAMES = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

export const SLOTS_CONFIG = {
    DAY: {
        MAX_SLOTS: 4,
        ICON: '☀️',
        LABEL: 'Дневная смена'
    },
    NIGHT: {
        MAX_SLOTS: 2,
        ICON: '🌙',
        LABEL: 'Вечерняя смена'
    }
};

export const ANIMATIONS = {
    TOOLTIP_FADE_IN: '0.3s',
    CALENDAR_SLIDE: '0.3s',
    SUCCESS_ANIMATION: '0.5s'
};

export const Z_INDICES = {
    TOOLTIP: 1000,
    CALENDAR_HEADER: 2,
    LOADING_OVERLAY: 5
}; 
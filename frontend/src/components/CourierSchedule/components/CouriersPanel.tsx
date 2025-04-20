import React, { forwardRef } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { logger } from '../../../utils/logger'; // Путь к логгеру может отличаться

// Анимация (если нужна)
// const slideUp = keyframes` ... `;

// Стили
// const CouriersPanelOverlay = styled(motion.div)`
//     position: fixed;
//     top: 0;
//     left: 0;
//     right: 0;
//     bottom: 0;
//     background: rgba(0, 0, 0, 0.5);
//     z-index: 1090; // Ниже панели, выше остального
// `;

const CouriersPanelContainerStyled = styled(motion.div)`
    position: fixed;
    bottom: 0;
    left: 80px; // <<< Ширина левой панели с иконками (ПОДСТАВИТЬ СВОЕ ЗНАЧЕНИЕ)
    right: 0; // <<< До правого края
    height: 250px; // <<< Высота панели - подбираем
    background-color: var(--background-color, #1a1a1a);
    border-top: 1px solid var(--border-color, #333);
    border-left: 1px solid var(--border-color, #333); // Граница слева
    box-shadow: -5px 0px 15px rgba(0, 0, 0, 0.2); // Тень слева
    z-index: 1100;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    overflow-y: auto; // Для скролла списка курьеров

    /* <<< Добавляем стили для отключения зума/выделения >>> */
    user-select: none;
    -webkit-user-select: none; /* Safari */
    -moz-user-select: none; /* Firefox */
    -ms-user-select: none; /* IE10+ */
    -webkit-touch-callout: none; /* iOS Safari */
`;

// Интерфейс пропсов
export interface CouriersPanelProps { // Экспортируем интерфейс, если он нужен где-то еще
    shiftType: 'day' | 'night';
    slotIndex: number;
    onClose: () => void;
    chatId?: string;
    // Сюда добавятся пропсы для передачи курьеров и колбэка выбора
}

// <<< Используем forwardRef >>>
const CouriersPanel = forwardRef<HTMLDivElement, CouriersPanelProps>((
    { shiftType, slotIndex, onClose, chatId },
    ref // <<< Принимаем ref
) => {
    logger.log(`[CouriersPanel] Rendering for ${shiftType} slot ${slotIndex}, chat ${chatId}`);

    // Тут будет логика загрузки и отображения курьеров для chatId

    return (
        // Используем React.Fragment вместо <> для возможности передать key, если нужно
        <React.Fragment>
            {/* Оверлей удален */}
            {/* Сам контейнер панели */}
            <CouriersPanelContainerStyled
                ref={ref} // <<< Применяем переданный ref
                key="couriers-panel-content"
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                onDoubleClick={(e) => e.preventDefault()} // <<< Предотвращаем зум по двойному клику
            >
                <h2>Выбор курьера ({shiftType === 'day' ? 'День' : 'Ночь'}, Слот {slotIndex + 1})</h2>
                <p>Список курьеров для чата {chatId || 'N/A'} будет здесь...</p>
                {/* Здесь будет список <CourierItem /> */}
                <button onClick={onClose} style={{ marginTop: 'auto', alignSelf: 'flex-start' }}>Закрыть</button>
            </CouriersPanelContainerStyled>
        </React.Fragment>
    );
});

CouriersPanel.displayName = 'CouriersPanel'; // Добавляем displayName

export default CouriersPanel; // Экспортируем компонент 
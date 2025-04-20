import React from 'react';
import styled from 'styled-components';
// import { SettingsOverlay as ModalBackdropOverlay } from '../CourierSchedule/CourierCalendar/styles'; // <<< УДАЛЯЕМ
import { TimesheetResponse, CourierTimesheetData } from '../../types/timesheet'; 
// <<< Импортируем тип для конфига слотов и ДЕФОЛТНЫЕ значения >>>
import { WeeklySlotConfig, SlotConfigForDay, defaultSingleDaySlotConfig } from '../../store/slices/shiftsSlice'; 

interface TimesheetPreviewProps {
    isOpen: boolean;
    onClose: () => void;
    onDownload: () => void;
    data: TimesheetResponse | null; 
    isLoading: boolean;
    error: string | null;
    chatId: string; 
    // <<< Добавляем проп для конфига слотов >>>
    slotConfig: WeeklySlotConfig | null;
    // <<< Добавляем проп для названия группы >>>
    groupTitle: string;
}

// <<< Обновляем стили контейнера для полного экрана >>>
const FullPageContainer = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--background-elevated, #1f1f1f); // Фон как у основного контента
    z-index: 1100; // Выше чем другие элементы
    display: flex;
    flex-direction: column;
    color: var(--text-color);
    padding: 1.5rem; // Отступы по краям страницы
    box-sizing: border-box; // Учитываем padding в размере
    overflow: hidden; // Убираем скролл у основного контейнера

    @media (max-width: 768px) {
        padding: 1rem; // Уменьшаем отступы на мобильных
    }
`;

const Header = styled.div`
    display: flex;
    justify-content: space-between; 
    // <<< Выравнивание по верху, чтобы кнопка не скакала >>>
    align-items: flex-start; 
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0; 
    flex-wrap: nowrap; /* Убираем wrap здесь, обертка заголовка будет внутри */
    gap: 1rem; // Отступ между заголовком и кнопкой
`;

// <<< Обертка для заголовка, чтобы он мог переноситься независимо >>>
const TitleWrapper = styled.div`
    flex-grow: 1; // Занимает доступное пространство
    /* Можно добавить правый отступ, если нужно */
`;

const Title = styled.h3`
    margin: 0;
    font-size: 1.4rem;
    color: var(--text-color-accent);
    /* Убираем стили, мешающие переносу */
    /* white-space: nowrap; */
    /* overflow: hidden; */
    /* text-overflow: ellipsis; */
    /* margin-right: 1rem; */
    /* Добавляем возможность переноса внутри заголовка */
    word-break: break-word; 
`;

const GroupTitleSpan = styled.span`
    font-size: 1rem;
    color: var(--text-secondary);
    margin-left: 0.75rem;
    font-weight: normal;
    /* Разрешаем перенос внутри названия группы тоже */
    word-break: break-word; 
`;

const CloseButton = styled.button`
    background: transparent;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.2rem;
    line-height: 1;
    flex-shrink: 0; // Кнопка не должна сжиматься

    &:hover {
        color: var(--text-color);
    }
`;

// <<< Область контента теперь должна скроллиться >>>
const ContentArea = styled.div`
    flex-grow: 1; // Занимает все доступное пространство
    overflow: auto; // Добавляем скролл для контента (включая таблицу)
    margin-bottom: 1.5rem;
    display: flex; /* Добавляем flex для позиционирования настроек внизу */
    flex-direction: column; /* Основной контент и настройки идут друг под другом */
`;

// <<< Обертка для таблицы для горизонтального скролла >>>
const TableWrapper = styled.div`
    overflow-x: auto;
    width: 100%;
    flex-grow: 1; /* Таблица занимает основное место */
    margin-bottom: 1.5rem; /* Отступ перед настройками */
`;

const ErrorMessage = styled.p`
    color: var(--error-color);
    text-align: center;
    padding: 1rem;
`;

const Table = styled.table`
    width: 100%;
    min-width: 600px; // Минимальная ширина, чтобы был смысл скроллить
    border-collapse: collapse;
    font-size: 0.9rem;
    
    th, td {
        border: 1px solid var(--border-color); // <<< Делаем границы четче
        padding: 0.75rem 1rem;
        text-align: left;
        white-space: nowrap; // Запрещаем перенос текста в ячейках
    }

    th {
        background-color: var(--background-secondary); 
        font-weight: 600;
        position: sticky; 
        top: 0; 
        z-index: 1;
        vertical-align: middle; // Вертикальное выравнивание по центру для заголовков
    }

    td {
        background-color: var(--card-background-lighter);
    }

    tr:nth-child(even) td {
        background-color: var(--background-elevated);
    }
    
    /* Стиль для ячеек заголовков дат */
    th.date-header {
        white-space: pre-line; /* Чтобы \n работал как перенос строки */
        text-align: center;    /* Выравнивание по центру */
        vertical-align: middle; /* Выравнивание по центру */
    }

    /* <<< Медиа-запрос для мобильных >>> */
    @media (max-width: 768px) {
        font-size: 0.8rem; // Уменьшаем шрифт
        th, td {
            padding: 0.5rem 0.75rem; // Уменьшаем отступы
        }
    }
`;

// <<< Стили для отображения настроек слотов >>>
const SlotSettingsContainer = styled.div`
    margin-top: auto; /* Прижимает блок к низу ContentArea */
    padding-top: 1rem;
    border-top: 1px dashed var(--border-color-light);
    display: flex;
    flex-wrap: wrap; /* Перенос на новую строку, если не влезает */
    gap: 1.5rem; /* Пространство между днями недели */
    font-size: 0.85rem;
    color: var(--text-secondary);
    flex-shrink: 0; /* Блок не должен сжиматься */

    @media (max-width: 768px) {
        gap: 1rem;
        font-size: 0.8rem;
    }
`;

const SlotDaySetting = styled.div`
    span {
        font-weight: 600;
        color: var(--text-color);
        margin-left: 0.3rem;
    }
`;

const Footer = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
    flex-shrink: 0; // Футер не должен сжиматься
`;

// Basic Button styling (reuse or create a shared Button component later)
const Button = styled.button`
    padding: 0.6rem 1.2rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--button-border-color);
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease-in-out;
    font-size: 0.9rem;

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;

const PrimaryButton = styled(Button)`
    background-color: var(--button-primary-background);
    color: var(--button-primary-text);
    border-color: var(--button-primary-border);

    &:hover:not(:disabled) {
        background-color: var(--button-primary-background-hover);
        box-shadow: var(--shadow-sm);
    }
`;

const SecondaryButton = styled(Button)`
    background-color: var(--button-secondary-background);
    color: var(--button-secondary-text);
    border-color: var(--button-secondary-border);

    &:hover:not(:disabled) {
        background-color: var(--button-secondary-background-hover);
    }
`;

// <<< Массив русских названий дней недели (Пн=0) >>>
const weekdaysRu = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
// <<< Массив коротких дней недели (для отображения настроек) >>>
const weekdaysRuShort = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

const TimesheetPreview: React.FC<TimesheetPreviewProps> = ({
    isOpen,
    onClose,
    onDownload,
    data,
    isLoading,
    error,
    slotConfig,
    groupTitle
}) => {
    if (!isOpen) {
        return null;
    }

    // <<< Функция для получения дня недели (0=Пн, 6=Вс) из даты YYYY-MM-DD >>>
    const getWeekdayIndex = (dateStr: string): number | null => {
        try {
            const dateObj = new Date(dateStr + 'T00:00:00Z');
            const weekdayNum = dateObj.getUTCDay(); // 0 = Вс, 1 = Пн
            return (weekdayNum === 0) ? 6 : weekdayNum - 1;
        } catch {
            return null;
        }
    };

    const renderContent = () => {
        if (isLoading) {
            return <p>Загрузка данных табеля...</p>; 
        }
        if (error) {
            return <ErrorMessage>Ошибка: {error}</ErrorMessage>;
        }
        if (!data || !data.columns || !data.rows || data.rows.length === 0) {
            // Поменял проверку data.columns.length === 0, т.к. колонки могут быть, а строк нет
            return <p>Данные табеля отсутствуют.</p>;
        }

        const { columns, rows } = data;
        const dateHeaders = columns;

        const formatDateHeader = (dateStr: string): string => {
             const index = getWeekdayIndex(dateStr);
             const dayNum = new Date(dateStr + 'T00:00:00Z').getUTCDate();
             const weekdayStr = index !== null ? weekdaysRuShort[index] : '?';
             return `${dayNum}\n${weekdayStr}`;
        };

        return (
            <>
                <TableWrapper>
                    <Table>
                        <thead>
                            <tr>
                                <th>ФИ Курьера</th>
                                {columns.map(dateCol => (
                                    <th key={dateCol} className="date-header">
                                        {formatDateHeader(dateCol)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((courierRow: CourierTimesheetData) => (
                                <tr key={courierRow.user_id}>
                                    <td>{courierRow.courier_name}</td>
                                    {columns.map(dateCol => (
                                        <td key={`${courierRow.user_id}-${dateCol}`}>
                                            {courierRow.dates[dateCol] || ''} 
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </TableWrapper>
                
                {/* Отображаем настройки слотов для ВСЕХ дней недели */} 
                <SlotSettingsContainer>
                    {weekdaysRu.map((dayName, dayIndex) => {
                        // <<< Получаем настройки или используем дефолтные >>>
                        // Конвертируем наш индекс (0=Пн..6=Вс) в индекс slotConfig (0=Вс..6=Сб)
                        const slotConfigIndex = (dayIndex + 1) % 7;
                        const configForDay: SlotConfigForDay | undefined = slotConfig ? slotConfig[slotConfigIndex] : undefined;
                        const daySlots = configForDay?.maxDaySlots ?? defaultSingleDaySlotConfig.maxDaySlots;
                        const nightSlots = configForDay?.maxNightSlots ?? defaultSingleDaySlotConfig.maxNightSlots;
                        
                        return (
                            <SlotDaySetting key={dayIndex}>
                                {dayName}: 
                                День:<span>{daySlots}</span>, 
                                Ночь:<span>{nightSlots}</span>
                            </SlotDaySetting>
                        );
                    })}
                </SlotSettingsContainer>
            </>
        );
    };

    return (
        // <<< Используем FullPageContainer вместо фрагмента и старого контейнера >>>
        <FullPageContainer>
            <Header>
                {/* <<< Оборачиваем заголовок >>> */}
                <TitleWrapper>
                    <Title>
                        Табель Учета Рабочего Времени
                        {groupTitle && <GroupTitleSpan>({groupTitle})</GroupTitleSpan>}
                    </Title>
                </TitleWrapper>
                <CloseButton onClick={onClose} aria-label="Закрыть">×</CloseButton>
            </Header>
            <ContentArea>
                {renderContent()} {/* renderContent теперь возвращает фрагмент с таблицей и настройками */}
            </ContentArea>
            <Footer>
                <SecondaryButton onClick={onClose}>Закрыть</SecondaryButton>
                <PrimaryButton 
                    onClick={onDownload} 
                    disabled={isLoading || !!error || !data || !data.rows || data.rows.length === 0}
                >
                    Скачать CSV
                </PrimaryButton>
            </Footer>
        </FullPageContainer>
    );
};

export default TimesheetPreview; 
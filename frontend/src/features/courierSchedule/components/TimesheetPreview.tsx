import React, { useState, useEffect, useRef, useMemo } from 'react';
import styled from 'styled-components';
import { TimesheetResponse, CourierTimesheetData } from '@features/courierSchedule/types/timesheet'; 
import type {
    WeeklySlotConfig
  } from '@features/courierSchedule/types/courierScheduleTypes'; 
import { getAvailableTimesheetPeriods } from '@features/courierSchedule/services/courierApi'; 

interface TimesheetPreviewProps {
    isOpen: boolean;
    onClose: () => void;
    onSendRequest: (destination: 'user' | 'group') => void;
    data: TimesheetResponse | null; 
    isLoading: boolean;
    error: string | null;
    chatId: string; 
    slotConfig: WeeklySlotConfig | null;
    groupTitle: string;
    onPeriodChange: (newPeriod: SelectedPeriod) => void;
}

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

    @media (max-width: 768px) {
        padding: 1rem; // Уменьшаем отступы на мобильных
    }
`;

const Header = styled.div`
    display: flex;
    justify-content: space-between; 
    align-items: flex-start; 
    margin-top: 80px;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0; 
    flex-wrap: nowrap; /* Убираем wrap здесь, обертка заголовка будет внутри */
    gap: 1rem; // Отступ между заголовком и кнопкой
`;

const TitleWrapper = styled.div`
    flex-grow: 1; // Занимает доступное пространство
    /* Можно добавить правый отступ, если нужно */
`;

const Title = styled.h3`
    margin: 0;
    font-size: 1.4rem;
    color: var(--text-color-accent);
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
        // <<< Заменяем фон на радиальный градиент >>>
        background: radial-gradient(circle at top right, var(--orange-dark) 0%, var(--orange-primary) 100%);
        // <<< Делаем текст белым >>>
        color: var(--text-color-on-primary);
        font-weight: 600;
        position: sticky; 
        top: 0; 
        z-index: 1;
        vertical-align: middle; // Вертикальное выравнивание по центру для заголовков
        // <<< Возможно, стоит изменить цвет границ для шапки? Пока оставим >>>
        border: 1px solid var(--border-color); 
    }

    td {
        background-color: var(--card-background-lighter);
        // <<< Добавляем transition для плавности >>>
        transition: background 0.2s ease-in-out, color 0.2s ease-in-out;
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

    /* <<< Стили для выделенной строки >>> */
    tr.selected-row td {
        background: radial-gradient(circle at top right, var(--orange-dark) 0%, var(--orange-primary) 100%);
        color: var(--text-color-on-primary);
    }
`;

const Footer = styled.div`
    display: flex;
    justify-content: space-between; 
    align-items: center; 
    gap: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
    flex-shrink: 0;
`;


const BaseButton = styled.button`
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

// <<< Обновляем наследование для PrimaryButton >>>
const PrimaryButton = styled(BaseButton)`
    background-color: var(--button-primary-background, var(--primary-color));
    color: var(--button-primary-text, #fff);
    border-color: var(--button-primary-border, var(--primary-color));

    &:hover:not(:disabled) {
        background-color: var(--button-primary-background-hover, var(--primary-dark));
        box-shadow: var(--shadow-sm);
    }
`;

// <<< Обновляем наследование для SecondaryButton >>>
const SecondaryButton = styled(BaseButton)`
    background-color: var(--button-secondary-background);
    color: var(--button-secondary-text);
    border-color: var(--button-secondary-border);

    &:hover:not(:disabled) {
        background-color: var(--button-secondary-background-hover);
    }
`;

// <<< Массив коротких дней недели (для отображения настроек) >>>
const weekdaysRuShort = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

// <<< СТИЛИ ДЛЯ КАСТОМНОГО ДРОПДАУНА >>>
const DropdownWrapper = styled.div`
    position: relative; // Для позиционирования меню
`;

const DropdownMenu = styled.div`
    position: absolute;
    bottom: calc(100% + 4px); // Появляется над кнопкой с небольшим отступом
    left: 0; // По умолчанию выравниваем по левому краю кнопки
    z-index: 1200;
    background-color: var(--card-background);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    padding: 4px;
    box-shadow: var(--shadow-md);
    min-width: 180px; // Минимальная ширина меню
    animation: fadeInScaleUp 0.15s ease-out; // Анимация появления

    /* Выравнивание по правому краю для меню "Отправить" */
    &.alignRight {
        left: auto;
        right: 0;
    }

    @keyframes fadeInScaleUp {
        from {
            opacity: 0;
            transform: scale(0.95) translateY(5px);
        }
        to {
            opacity: 1;
            transform: scale(1) translateY(0);
        }
    }
`;

const DropdownMenuItem = styled.div<{ $isSelected?: boolean }>`
    padding: 8px 12px;
    cursor: pointer;
    color: ${props => props.$isSelected ? 'var(--primary-color)' : 'var(--text-color)'};
    background-color: ${props => props.$isSelected ? 'var(--primary-transparent)' : 'transparent'};
    border-radius: var(--radius-sm);
    margin-bottom: 2px;
    transition: background-color var(--transition-fast), color var(--transition-fast);

    &:last-child {
        margin-bottom: 0;
    }

    &:hover {
        background-color: ${props => props.$isSelected ? 'var(--primary-transparent)' : 'var(--hover-overlay)'};
        color: var(--primary-color);
    }
`;

// <<< Стилизованная обертка для иконки стрелки >>>
const ArrowIconPlaceholder = styled.span<{ $isOpen: boolean }>`
    display: inline-block;
    margin-left: 8px;
    transition: transform var(--transition-normal);
    transform: rotate(${props => props.$isOpen ? '180deg' : '0deg'});
    vertical-align: middle; // Выравниваем по центру
    &::after {
        content: '▼'; /* Простой символ стрелки */
        font-size: 0.7em; // Делаем стрелку чуть меньше
    }
`;

// <<< НОВЫЙ КОМПОНЕНТ КНОПКИ ПЕРИОДА >>>
const PeriodButton = styled(BaseButton)`
    background-color: var(--card-background);
    color: var(--text-color);
    border-color: var(--border-color);

    &:hover:not(:disabled) {
        background-color: var(--hover-overlay);
        border-color: var(--primary-color);
        color: var(--primary-color);
        ${ArrowIconPlaceholder} { /* Стили для иконки при наведении */
            color: var(--primary-color);
        }
    }
     &:focus {
        box-shadow: 0 0 0 2px var(--primary-transparent);
    }
    
    ${ArrowIconPlaceholder} { /* Начальные стили иконки */
         color: var(--text-secondary);
         transition: color var(--transition-fast);
    }
`;

// --- Типы и константы ---

// <<< ЭКСПОРТИРУЕМ SelectedPeriod ОТСЮДА >>>
export interface SelectedPeriod {
    type: 'month' | 'week';
    year?: number; // Год (для месяца)
    month?: number; // Месяц (0-11) (для месяца)
}

// Тип для AvailablePeriod, который используется в этом компоненте (0-11 месяц)
interface AvailablePeriod {
    year: number;
    month: number; 
}

interface MenuItem {
    label: string;
    key: string;
    type: 'item';
}

interface MenuDivider {
    key: string;
    type: 'divider';
}
// <<< КОНЕЦ ВОЗВРАЩЕНИЯ ТИПОВ >>>

const TimesheetPreview: React.FC<TimesheetPreviewProps> = (props) => {
    const { // <<< Деструктуризация пропсов здесь >>>
        isOpen,
        onClose,
        onSendRequest,
        data,
        isLoading,
        error,
        chatId,
        groupTitle,
        onPeriodChange
    } = props;

    const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
    const [isSendDropdownOpen, setIsSendDropdownOpen] = useState(false);
    const periodDropdownRef = useRef<HTMLDivElement>(null);
    const sendDropdownRef = useRef<HTMLDivElement>(null);

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const [selectedPeriod, setSelectedPeriod] = useState<SelectedPeriod>({ 
        type: 'week' // <<< УСТАНАВЛИВАЕМ НАЧАЛЬНОЕ ЗНАЧЕНИЕ 'week' >>>
    });
    
    // Добавляем состояние для отслеживания, был ли уже выполнен начальный запрос данных
    const [initialDataLoaded, setInitialDataLoaded] = useState(false);
    
    // <<< Используем useState для availableMonths, инициализируем пустым >>>
    const [availableMonths, setAvailableMonths] = useState<AvailablePeriod[]>([]);

    // <<< Убедимся, что состояние number | null >>>
    const [selectedCourierId, setSelectedCourierId] = useState<number | null>(null);

    // Добавим состояние для отслеживания текущего режима отображения дропдауна
    const [dropdownView, setDropdownView] = useState<'default' | 'months'>('default');

    // <<< ДОБАВЛЯЕМ useEffect ДЛЯ ЗАГРУЗКИ ПЕРИОДОВ ПРИ МОНТИРОВАНИИ >>>
    useEffect(() => {
        if (isOpen && chatId) { // Загружаем только если открыто и есть chatId
            const fetchPeriods = async () => {
                try {
                    const periods = await getAvailableTimesheetPeriods(chatId);
                    setAvailableMonths(periods.length > 0 ? periods : [{ year: currentYear, month: currentMonth }]);
                } catch (e) {
                    setAvailableMonths([{ year: currentYear, month: currentMonth }]);
                }
            };
            fetchPeriods();
        }
    }, [isOpen, chatId, currentYear, currentMonth]); // Зависим от isOpen и chatId

    // Загружаем данные за неделю при первом открытии 
    useEffect(() => {
        if (isOpen && !initialDataLoaded) {
            // Устанавливаем тип period как 'week' и сообщаем родительскому компоненту
            setSelectedPeriod({ type: 'week' });
            // Принудительно запрашиваем данные за неделю
            onPeriodChange({ type: 'week' });
            setInitialDataLoaded(true);
        }
        
        // Сбрасываем флаг initialDataLoaded при закрытии модального окна
        if (!isOpen) {
            setInitialDataLoaded(false);
        }
    }, [isOpen, initialDataLoaded, onPeriodChange]);

    // Обновляем UI, если данные изменились
    useEffect(() => {
        if (!isLoading && !error && data) {
        }
    }, [data, isLoading, error, selectedPeriod]);

    // <<< useEffect для закрытия по клику вне (без изменений) >>>
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Закрываем меню периода
            if (
                periodDropdownRef.current && 
                !periodDropdownRef.current.contains(event.target as Node) &&
                isPeriodDropdownOpen // Проверяем, было ли оно открыто
            ) {
                // Закрываем дропдаун и сбрасываем вид к дефолтному
                setIsPeriodDropdownOpen(false);
                setDropdownView('default');
            }
            // Закрываем меню отправки
            if (
                sendDropdownRef.current && 
                !sendDropdownRef.current.contains(event.target as Node) &&
                isSendDropdownOpen // Проверяем, было ли оно открыто
            ) {
                setIsSendDropdownOpen(false);
            }
        };

        // Добавляем слушатель, только если хотя бы одно меню открыто
        if (isPeriodDropdownOpen || isSendDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside)
        }

        // Очистка при размонтировании компонента или изменении зависимостей
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isPeriodDropdownOpen, isSendDropdownOpen]); // Зависим от состояния обоих меню

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

    // <<< Убедимся, что обработчик принимает number >>>
    const handleRowClick = (userId: number) => {
        setSelectedCourierId(prevId => (prevId === userId ? null : userId));
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

        // Обновляем индикатор периода, чтобы показывать конкретный месяц или диапазон дат
        let periodText = '';
        if (selectedPeriod.type === 'week') {
            // Берем даты из фактических данных, а не вычисляем их
            if (data.columns && data.columns.length > 0) {
                // Сортируем даты, чтобы найти первую и последнюю
                const sortedDates = [...data.columns].sort();
                const firstDate = new Date(sortedDates[0] + 'T00:00:00Z');
                const lastDate = new Date(sortedDates[sortedDates.length - 1] + 'T00:00:00Z');
                
                // Форматируем даты в виде "ДД.ММ - ДД.ММ"
                const formatDate = (date: Date) => {
                    const day = date.getDate().toString().padStart(2, '0');
                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                    return `${day}.${month}`;
                };
                
                periodText = `Данные за текущую неделю: ${formatDate(firstDate)} - ${formatDate(lastDate)}`;
            } else {
                periodText = 'Данные за текущую неделю';
            }
        } else if (selectedPeriod.type === 'month' && selectedPeriod.year !== undefined && selectedPeriod.month !== undefined) {
            // Форматируем месяц и год
            const date = new Date(selectedPeriod.year, selectedPeriod.month);
            const monthYear = date.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
            periodText = `Данные за месяц: ${monthYear}`;
        } else {
            periodText = 'Данные за период';
        }

        const periodIndicator = <small style={{ color: 'var(--text-secondary)' }}>{periodText}</small>;

        const { columns, rows } = data;

        const formatDateHeader = (dateStr: string): string => {
             const index = getWeekdayIndex(dateStr);
             const dayNum = new Date(dateStr + 'T00:00:00Z').getUTCDate();
             const weekdayStr = index !== null ? weekdaysRuShort[index] : '?';
             return `${dayNum}\n${weekdayStr}`;
        };

        return (
            <>
                <TableWrapper>
                    {periodIndicator}
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
                                <tr 
                                    key={courierRow.user_id} 
                                    // <<< Сравниваем number | null с number >>>
                                    className={selectedCourierId === courierRow.user_id ? 'selected-row' : ''}
                                >
                                    {/* <<< Передаем number в обработчик >>> */}
                                    <td onClick={() => handleRowClick(courierRow.user_id)} style={{ cursor: 'pointer' }}>
                                        {courierRow.courier_name}
                                    </td>
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
            </>
        );
    };

    // --- Обработчики --- 
    const handleSendMenuClick = ({ key }: { key: string }) => {
        onSendRequest(key as 'user' | 'group');
        // <<< Закрываем меню отправки после клика >>>
        setIsSendDropdownOpen(false); 
    };

    // <<< ОБНОВЛЕННЫЙ ОБРАБОТЧИК СМЕНЫ ПЕРИОДА >>>
    const handlePeriodMenuClick = (key: string) => {
        // Если выбрали "Выбрать месяц", просто меняем вид дропдауна на список месяцев
        if (key === 'switch-to-month') {
            setDropdownView('months');
            return; // Прерываем выполнение, не закрывая дропдаун
        }
        
        let newPeriod: SelectedPeriod | null = null;

        if (key === 'switch-to-week' || key === 'current-week') {
            newPeriod = { type: 'week' };
        } else if (key.startsWith('month-')) {
            const [, yearStr, monthStr] = key.split('-');
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);
            if (!isNaN(year) && !isNaN(month)) {
                newPeriod = { type: 'month', year, month };
            }
        }

        if (newPeriod) {
            setSelectedPeriod(newPeriod);
            setIsPeriodDropdownOpen(false); 
            setDropdownView('default'); // Сбрасываем вид дропдауна
            
            // Затем уведомляем родительский компонент для загрузки данных
            onPeriodChange(newPeriod);
        } else {
            setIsPeriodDropdownOpen(false);
            setDropdownView('default'); // Сбрасываем вид дропдауна
        }
    };
    
    // При нажатии "Назад" в режиме выбора месяца
    const handleBackToMainMenu = () => {
        setDropdownView('default');
    };
    
    // --- Форматирование и генерация меню --- 
    const formatMonthYear = (year: number, month: number): string => {
        const date = new Date(year, month);
        return date.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
    };

    const periodMenuItems = useMemo(() => {
        // Если показываем список месяцев
        if (dropdownView === 'months') {
            const items: (MenuItem | MenuDivider)[] = [];
            
            // Добавляем кнопку "Назад"
            items.push({
                label: '← Назад',
                key: 'back-to-main',
                type: 'item'
            });
            
            items.push({ type: 'divider', key: 'divider-back' });
            
            // Добавляем список месяцев
            availableMonths.forEach(m => {
                items.push({
                    label: formatMonthYear(m.year, m.month),
                    key: `month-${m.year}-${m.month}`,
                    type: 'item'
                });
            });
            
            return items;
        }
        
        // Стандартное меню (default)
        const items: (MenuItem | MenuDivider)[] = [];
        
        if (selectedPeriod.type === 'month') {
            items.push({
                label: 'Выбрать другой месяц',
                key: 'switch-to-month',
                type: 'item'
            });
            
            items.push({ type: 'divider', key: 'divider-month' });
            
            items.push({
                label: 'Текущая неделя',
                key: 'switch-to-week',
                type: 'item'
            });
        } else {
            items.push({
                label: 'Выбрать месяц',
                key: 'switch-to-month',
                type: 'item'
            });
            
            items.push({ type: 'divider', key: 'divider-week' });
            
            items.push({
                label: 'Текущая неделя',
                key: 'current-week', 
                type: 'item'
            });
        }
        
        return items;
    }, [selectedPeriod.type, availableMonths, dropdownView]); // Добавляем dropdownView как зависимость

    const periodButtonLabel = useMemo(() => {
        if (selectedPeriod.type === 'month' && selectedPeriod.year !== undefined && selectedPeriod.month !== undefined) {
            return formatMonthYear(selectedPeriod.year, selectedPeriod.month);
        } else if (selectedPeriod.type === 'week') {
            // Получаем диапазон дат из фактических данных, если они есть
            if (data?.columns && data.columns.length > 0) {
                // Сортируем даты, чтобы найти первую и последнюю
                const sortedDates = [...data.columns].sort();
                const firstDate = new Date(sortedDates[0] + 'T00:00:00Z');
                const lastDate = new Date(sortedDates[sortedDates.length - 1] + 'T00:00:00Z');
                
                // Форматируем даты в виде "ДД.ММ - ДД.ММ"
                const formatDate = (date: Date) => {
                    const day = date.getDate().toString().padStart(2, '0');
                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                    return `${day}.${month}`;
                };
                
                return `Неделя: ${formatDate(firstDate)} - ${formatDate(lastDate)}`;
            }
            
            // Если данных нет, покажем просто "Текущая неделя"
            return 'Текущая неделя';
        }
        return 'Выбрать период'; // Fallback
    }, [selectedPeriod, data?.columns]); // Добавляем data?.columns в зависимости


    const sendMenuItems = [
        { label: 'В личные сообщения', key: 'user' },
        { label: `В чат группы (${groupTitle || '...'})`, key: 'group' },
    ];

    return (
        <FullPageContainer>
            <Header>
                <TitleWrapper>
                    <Title>
                        Табель Учета Рабочего Времени
                        {groupTitle && <GroupTitleSpan>({groupTitle})</GroupTitleSpan>}
                    </Title>
                </TitleWrapper>
                <CloseButton onClick={onClose} aria-label="Закрыть">×</CloseButton>
            </Header>
            <ContentArea>
                {renderContent()}
            </ContentArea>
            <Footer>
                <SecondaryButton onClick={onClose}>Закрыть</SecondaryButton>
                
                {/* Кастомный дропдаун выбора периода */}
                <DropdownWrapper ref={periodDropdownRef}> 
                    <PeriodButton onClick={() => {
                        // При открытии дропдауна всегда показываем стандартный вид
                        if (!isPeriodDropdownOpen) {
                            setDropdownView('default');
                        }
                        setIsPeriodDropdownOpen(!isPeriodDropdownOpen);
                    }}>
                     {periodButtonLabel} <ArrowIconPlaceholder $isOpen={isPeriodDropdownOpen} />
                    </PeriodButton>
                    {isPeriodDropdownOpen && (
                        <DropdownMenu>
                            {periodMenuItems.map(item => (
                                // <<< Проверяем тип перед рендерингом >>>
                                item.type === 'divider' ? 
                                <div key={item.key} style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} /> :
                                <DropdownMenuItem 
                                    key={item.key} 
                                    onClick={() => {
                                        // Особая обработка для кнопки "Назад"
                                        if (item.key === 'back-to-main') {
                                            handleBackToMainMenu();
                                            return;
                                        }
                                        
                                        handlePeriodMenuClick(item.key);
                                    }} 
                                    $isSelected={(
                                        selectedPeriod.type === 'month' && 
                                        item.key === `month-${selectedPeriod.year}-${selectedPeriod.month}`
                                    ) || (
                                        selectedPeriod.type === 'week' && item.key === 'current-week'
                                    )}
                                >
                                    {/* Теперь label точно есть у item */} 
                                    {item.label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenu>
                    )}
                </DropdownWrapper>
                
                {/* Кастомный дропдаун отправки */}
                <DropdownWrapper ref={sendDropdownRef}> 
                    <PrimaryButton 
                        onClick={() => setIsSendDropdownOpen(!isSendDropdownOpen)}
                        disabled={isLoading || !!error || !data || !data.rows || data.rows.length === 0}
                    >
                        Отправить <ArrowIconPlaceholder $isOpen={isSendDropdownOpen} />
                    </PrimaryButton>
                    {isSendDropdownOpen && (
                         <DropdownMenu className="alignRight"> {/* Выравниваем по правому краю */}
                            {sendMenuItems.map(item => (
                                <DropdownMenuItem 
                                    key={item.key} 
                                    onClick={() => { 
                                        handleSendMenuClick({ key: item.key }); 
                                        setIsSendDropdownOpen(false); // Закрываем меню после клика
                                    }} 
                                >
                                    {item.label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenu>
                    )}
                </DropdownWrapper>
            </Footer>
        </FullPageContainer>
    );
};

export default TimesheetPreview; 
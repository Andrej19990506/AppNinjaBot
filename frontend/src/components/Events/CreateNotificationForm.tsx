import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks'; 
import { selectUser } from '../../store/slices/userSlice'; 
import { selectAllEvents, createNotificationThunk, updateNotificationThunk } from '../../store/slices/eventsSlice'; 
import { EventNotification, EventRead, NotificationCreate, RepeatSettings } from '../../types/event';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import styled from 'styled-components';

// MUI Компоненты 
import TextField from '@mui/material/TextField';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import OutlinedInput from '@mui/material/OutlinedInput';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { styled as muiStyled } from '@mui/material/styles';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import RadioGroup from '@mui/material/RadioGroup';
import Radio from '@mui/material/Radio';
import Divider from '@mui/material/Divider';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import MessageIcon from '@mui/icons-material/Message';
import ChatIcon from '@mui/icons-material/Chat';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

// Расширяем интерфейс для передачи дополнительных данных уведомления
interface ExtendedNotificationCreate extends NotificationCreate {
    use_absolute_time?: boolean;
    absolute_time?: string;
    send_now?: boolean;
}

interface CreateNotificationFormProps {
    eventId: number;
    notificationId?: string | null;
    onClose: () => void;
    onStateChange: (state: { submit: () => Promise<void>; isValid: boolean; isLoading: boolean }) => void;
    initialData?: Partial<ExtendedNotificationCreate>;
}

type RepeatType = RepeatSettings['type'];

// Опции для дней недели
const weekdaysOptions = [
    { value: 1, label: 'Пн' }, { value: 2, label: 'Вт' }, { value: 3, label: 'Ср' },
    { value: 4, label: 'Чт' }, { value: 5, label: 'Пт' }, { value: 6, label: 'Сб' },
    { value: 0, label: 'Вс' },
];

// Стилизованные компоненты с использованием CSS переменных
const FormContainer = styled(motion.div)`
  display: flex;
  flex-direction: column;
  background-color: var(--background-color);
  width: 100%;
  height: 100%;
  max-height: 85vh;
  overflow: hidden;
  border-radius: 0; /* Убираем скругление с контейнера */
  box-shadow: var(--shadow-lg);
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  z-index: 1001;
  
  /* Исправление для мобильных устройств */
  @media (max-width: 768px) {
    width: 100vw;
    max-width: 100vw;
  }
`;

const FormHeader = styled.div`
  background: var(--gradient-primary);
  color: white;
  padding: 16px 24px;
  padding-top: 25px; /* Добавляем отступ сверху для ручки */
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 100%;
  box-sizing: border-box;
  border-radius: 16px 16px 0 0; /* Добавляем скругление к самой шапке */
  
  h2 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
    text-align: center;
  }
  
  /* Удаляем псевдоэлемент */
  &::before {
    display: none;
  }
`;

const FormContent = styled.div`
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
  padding-bottom: 70px;
  width: 100%;
  box-sizing: border-box;
  
  /* Стилизация скроллбара */
  scrollbar-width: thin;
  scrollbar-color: var(--gray-300) transparent;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background-color: var(--gray-300);
    border-radius: 3px;
  }
`;

const FormSection = styled.div`
  margin-bottom: 24px;
  padding: 16px;
  background-color: var(--card-background);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-normal);
  border-left: 4px solid var(--primary-color);
  
  &:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }
`;

const SectionTitle = styled.div`
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-color);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.05rem;
  
  svg {
    color: var(--primary-color);
  }
`;

// Стилизованная радио-группа
const StyledRadioGroup = styled(RadioGroup)`
  & .MuiFormControlLabel-root {
    margin-left: -6px;
    margin-bottom: 4px;
  }
  
  & .MuiRadio-root {
    color: var(--gray-400);
  }
  
  & .Mui-checked {
    color: var(--primary-color);
  }
`;

// Стилизованный Select с типизацией
const StyledSelect = muiStyled(Select)({
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'var(--gray-300)',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: 'var(--primary-color)',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: 'var(--primary-color)',
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: 'var(--primary-color)',
  }
});

// --- Стилизуем TextField для плавного перехода высоты --- 
const ExpandingTextField = muiStyled(TextField)(({ theme }) => ({
    transition: theme.transitions.create(['height', 'min-height'], {
        duration: theme.transitions.duration.short,
        easing: theme.transitions.easing.easeInOut,
    }),
    // Убедимся, что textarea внутри тоже может плавно менять размер
    '& .MuiInputBase-root': {
        transition: theme.transitions.create(['height', 'min-height'], {
            duration: theme.transitions.duration.short,
            easing: theme.transitions.easing.easeInOut,
        }),
    },
    '& .MuiInputBase-inputMultiline': {
        transition: theme.transitions.create(['height', 'min-height'], {
            duration: theme.transitions.duration.short,
            easing: theme.transitions.easing.easeInOut,
        }),
    }
}));

// Анимационные варианты
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.3, delay: 0.1 } }
};

const containerVariants = {
  hidden: { y: '100%' },
  visible: { 
    y: 0, 
    transition: { 
      type: 'spring', 
      damping: 25, 
      stiffness: 300,
      staggerChildren: 0.1
    } 
  },
  exit: { 
    y: '100%', 
    transition: { 
      duration: 0.3,
      ease: 'easeInOut' 
    } 
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: 0.3
    }
  }
};

// Анимация опций внутри секций
const optionVariants = {
  hidden: { opacity: 0, height: 0, y: -10 },
  visible: { 
    opacity: 1, 
    height: 'auto',
    y: 0,
    transition: { 
      type: 'spring',
      damping: 15,
      stiffness: 200
    }
  },
  exit: {
    opacity: 0,
    height: 0,
    y: -10,
    transition: {
      duration: 0.2
    }
  }
};

const slideVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { 
      type: 'spring',
      damping: 25,
      stiffness: 300 
    }
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: {
      duration: 0.2
    }
  }
};

// Обновленный компонент ручки перетаскивания с анимацией
const DragHandleBar = styled(motion.div)`
  width: 50px;
  height: 5px;
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
  cursor: grab;
  position: absolute;
  top: 8px;
  left: 50%;
  z-index: 3;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.5);
  }
  
  &:active {
    cursor: grabbing;
    background-color: rgba(255, 255, 255, 0.7);
  }
`;

const CreateNotificationForm: React.FC<CreateNotificationFormProps> = ({ 
    eventId, 
    notificationId, 
    onClose, 
    onStateChange,
    initialData 
}) => {
    const dispatch = useAppDispatch(); 
    const event = useAppSelector(selectAllEvents).find((e: EventRead) => e.id === eventId);
    const [description, setDescription] = useState('');
    const [timeBefore, setTimeBefore] = useState<number | string>('');
    const [repeat, setRepeat] = useState<RepeatType>('none');
    const [selectedChatIds, setSelectedChatIds] = useState<number[]>([]); 
    const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
    const [selectedMonthDay, setSelectedMonthDay] = useState<number | ''>(1);
    const [requiresConfirmation, setRequiresConfirmation] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [descriptionRows, setDescriptionRows] = useState(3);
    
    // Новые состояния для выбора времени уведомления
    const [timeMode, setTimeMode] = useState<'relative' | 'absolute' | 'now'>('relative');
    const [absoluteDateTime, setAbsoluteDateTime] = useState<string>('');
    
    const user = useAppSelector(selectUser);
    const availableChats = useMemo(() => {
        return user?.groups
            ?.filter(g => g.group_type === 'chef')
            ?.map(g => ({ id: g.chat_id, name: g.title }))
            || [];
    }, [user]);

    // Для управления перетаскиванием
    const y = useMotionValue(0);
    const overlayOpacity = useTransform(y, [0, 300], [1, 0.5]);
    const formRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    
    useEffect(() => {
        let notificationToEdit: EventNotification | undefined = undefined;

        if (event && notificationId) {
            notificationToEdit = event.notifications.find(n => n.id === notificationId);
        }

        const defaultMessage = initialData?.message || '';
        const defaultTime = initialData?.time || 15;
        const defaultRepeatType: RepeatType = (initialData?.repeat?.type || 'none') as RepeatType;
        const defaultChatIds: number[] = initialData?.chat_ids || [];
        const defaultWeekdays: number[] = initialData?.repeat?.weekdays || [];
        const defaultMonthDay = initialData?.repeat?.month_day || 1;
        const defaultRequiresConfirmation = initialData?.requires_confirmation || false;
        
        // Инициализируем новые состояния
        const defaultTimeMode = initialData?.send_now ? 'now' : 
                              initialData?.use_absolute_time ? 'absolute' : 'relative';
        
        const defaultAbsoluteTime = initialData?.absolute_time || 
                                 (event?.date ? new Date(event.date).toISOString().slice(0, 16) : 
                                 new Date().toISOString().slice(0, 16));

        setDescription(notificationToEdit?.message || defaultMessage);
        setTimeBefore(notificationToEdit?.time ?? defaultTime);
        setRepeat(notificationToEdit?.repeat?.type || defaultRepeatType);
        
        // Устанавливаем режим времени и абсолютное время
        setTimeMode(defaultTimeMode);
        setAbsoluteDateTime(defaultAbsoluteTime);
        
        if (event?.event_type === 'ato' && event.chat_ids && event.chat_ids.length > 0 && typeof event.chat_ids[0] === 'number') {
            setSelectedChatIds(event.chat_ids ? [event.chat_ids[0]] : defaultChatIds); 
        } else {
            setSelectedChatIds(notificationToEdit?.chat_ids || defaultChatIds);
        }

        setSelectedWeekdays(notificationToEdit?.repeat?.weekdays || defaultWeekdays);
        setSelectedMonthDay(notificationToEdit?.repeat?.month_day ?? defaultMonthDay);
        setRequiresConfirmation(notificationToEdit?.requires_confirmation || defaultRequiresConfirmation);

    }, [event, notificationId, initialData]); 

    const handleTimeBeforeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        if (value === '' || /^[0-9]+$/.test(value)) {
            setTimeBefore(value); 
        }
    };

    const handleRepeatChange = (event: SelectChangeEvent<RepeatType>) => {
        const newRepeatType = event.target.value as RepeatType;
        setRepeat(newRepeatType);
        if (newRepeatType !== 'weekly') {
            setSelectedWeekdays([]);
        }
        if (newRepeatType !== 'monthly') {
            // setSelectedMonthDay(1); 
        }
    };

    const handleWeekdaysChange = (event: SelectChangeEvent<number[]>) => {
        const { target: { value } } = event;
        setSelectedWeekdays(typeof value === 'string' ? value.split(',').map(Number) : value);
    };

    const handleMonthDayChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        if (value === '' || (/^\d+$/.test(value) && parseInt(value, 10) >= 1 && parseInt(value, 10) <= 31)) {
             setSelectedMonthDay(value === '' ? '' : parseInt(value, 10));
        }
    };

    const handleChatSelectionChange = (event: SelectChangeEvent<number[]>) => {
        const {
          target: { value },
        } = event;
        setSelectedChatIds(
          typeof value === 'string' ? value.split(',').map(Number) : value,
        );
    };

    // --- Обработчики фокуса для поля описания --- 
    const handleDescriptionFocus = () => {
        setDescriptionRows(10); // --- ИЗМЕНЕНИЕ: Увеличиваем количество строк до 10 --- 
    };

    const handleDescriptionBlur = () => {
        setDescriptionRows(3); // Возвращаем исходное количество строк при потере фокуса
    };

    // Добавляем обработчик изменения режима времени
    const handleTimeModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setTimeMode(event.target.value as 'relative' | 'absolute' | 'now');
    };
    
    // Обработчик изменения абсолютной даты и времени
    const handleAbsoluteDateTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setAbsoluteDateTime(event.target.value);
    };

    const isFormValid = useCallback(() => {
        // Базовая валидация описания и чатов
        let isValid = description.trim() !== '' && selectedChatIds.length > 0;
        
        // Валидация в зависимости от режима времени
        if (timeMode === 'relative') {
            const timeNum = typeof timeBefore === 'string' ? parseInt(timeBefore, 10) : timeBefore;
            isValid = isValid && !isNaN(timeNum) && timeNum >= 0;
        } else if (timeMode === 'absolute') {
            isValid = isValid && absoluteDateTime.trim() !== '';
        }
        // Если timeMode === 'now', дополнительных проверок не требуется
        
        // Валидация для повторения
        if (repeat === 'weekly' && selectedWeekdays.length === 0) {
            isValid = false;
        }
        if (repeat === 'monthly' && (selectedMonthDay === '' || selectedMonthDay < 1 || selectedMonthDay > 31)) {
            isValid = false;
        }
        
        return isValid;
    }, [description, timeBefore, absoluteDateTime, timeMode, selectedChatIds, repeat, selectedWeekdays, selectedMonthDay]);

    const handleSubmit = useCallback(async () => {
        if (!isFormValid()) {
            setError('Пожалуйста, заполните все обязательные поля корректно.');
            return;
        }
        setError(null);
        setIsLoading(true);

        try {
            // Получаем числовое значение времени (для режима 'relative')
            const timeNum = timeMode === 'relative' 
                ? (typeof timeBefore === 'string' ? parseInt(timeBefore, 10) : timeBefore)
                : 0; // Для режимов 'now' и 'absolute' устанавливаем 0, так как будут использоваться соответствующие флаги
            
            let repeatSettings: RepeatSettings = { type: repeat };
            if (repeat === 'weekly' && selectedWeekdays.length > 0) {
                repeatSettings.weekdays = selectedWeekdays.sort((a, b) => a - b);
            }
            if (repeat === 'monthly' && selectedMonthDay !== '') {
                repeatSettings.month_day = selectedMonthDay;
            }

            // Получаем смещение часового пояса пользователя для абсолютного времени
            let processedAbsoluteTime = absoluteDateTime;
            if (absoluteDateTime && !absoluteDateTime.includes('Z') && !absoluteDateTime.includes('+')) {
                // Добавляем информацию о часовом поясе, если её нет
                const localDate = new Date(absoluteDateTime);
                const offset = -localDate.getTimezoneOffset();
                const sign = offset >= 0 ? '+' : '-';
                const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
                const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
                processedAbsoluteTime = `${absoluteDateTime}${sign}${hours}:${minutes}`;
            }

            const notificationData: ExtendedNotificationCreate = {
                message: description.trim(),
                time: timeNum, // Используем 0 для 'now' и 'absolute'
                repeat: repeatSettings, 
                chat_ids: selectedChatIds,
                requires_confirmation: requiresConfirmation,
                // Добавляем новые поля в зависимости от выбранного режима времени
                send_now: timeMode === 'now',
                use_absolute_time: timeMode === 'absolute',
                absolute_time: timeMode === 'absolute' ? processedAbsoluteTime : undefined
            };

            // Отладка для проверки флага send_now
            console.log(`[CreateNotificationForm] Отправка уведомления, timeMode=${timeMode}, send_now=${timeMode === 'now'}, time=${timeNum}`);

            if (notificationId) {
                console.log(`--- Отправка запроса на ОБНОВЛЕНИЕ уведомления ${notificationId} для события ${eventId} ---`, notificationData);
                await dispatch(updateNotificationThunk({ eventId, notificationId, notificationData })).unwrap();
            } else {
                await dispatch(createNotificationThunk({ eventId, notificationData })).unwrap();
                console.log(`--- Отправка запроса на СОЗДАНИЕ уведомления для события ${eventId} ---`, notificationData);
            }
            
            console.log('--- Уведомление успешно создано/обновлено (через thunk) ---');
            onClose();

        } catch (apiError: any) {
            console.error('Ошибка при создании/обновлении уведомления:', apiError);
            
            if (apiError?.status === 422 || apiError?.code === 'ERR_BAD_REQUEST') {
                setError('Ошибка формата данных. Пожалуйста, свяжитесь с администратором.');
            } else {
                setError(apiError?.message || apiError || 'Не удалось сохранить уведомление. Попробуйте позже.');
            }
        } finally {
            setIsLoading(false);
        }
    }, [dispatch, eventId, notificationId, description, timeBefore, absoluteDateTime, timeMode, repeat, selectedChatIds, selectedWeekdays, selectedMonthDay, isFormValid, onClose, requiresConfirmation]);

    useEffect(() => {
        if (onStateChange) {
            onStateChange({ 
                submit: handleSubmit,
                isValid: isFormValid(),
                isLoading: isLoading
            });
        }
    }, [isLoading, isFormValid, handleSubmit, onStateChange]);

    // Обработчик начала перетаскивания
    const handleDragStart = () => {
        setIsDragging(true);
    };
    
    // Обработчик завершения перетаскивания
    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { y: number } }) => {
        const threshold = 150; // Порог для закрытия (в пикселях)
        
        // Если перетащили вниз больше порогового значения, закрываем форму
        if (info.offset.y > threshold) {
            onClose();
        } else {
            // Иначе возвращаем на место
            y.set(0);
        }
        setIsDragging(false);
    };

    if (!event) {
        return <Box sx={{ p: 2 }}>Событие не найдено.</Box>;
    }

    const isAtoEventWithTargetChatRender = !!(event && event.event_type === 'ato' && event.chat_ids && event.chat_ids.length > 0 && typeof event.chat_ids[0] === 'number');

    return (
        <>
            {/* Обновленный оверлей с фиксированной начальной непрозрачностью */}
            <motion.div
                style={{ 
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(2px)',
                    zIndex: 1000
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            />
            {/* Добавляем второй оверлей, который реагирует только на перетаскивание */}
            <motion.div
                style={{ 
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(2px)',
                    zIndex: 1000,
                    opacity: overlayOpacity,
                    pointerEvents: 'none' // Предотвращает клики на этом оверлее
                }}
            />
            <FormContainer
                ref={formRef}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                drag="y"
                dragConstraints={{ top: 0 }}
                dragElastic={0.2}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                style={{ 
                    y, 
                    boxShadow: isDragging 
                        ? '0 10px 25px rgba(0, 0, 0, 0.25)' 
                        : 'var(--shadow-lg)'
                }}
            >
                <FormHeader>
                    <DragHandleBar 
                        initial={{ opacity: 0.7, x: "-50%", y: 0 }}
                        animate={{ opacity: 1, x: "-50%", y: 0 }}
                        whileHover={{ opacity: 1, x: "-50%", y: 0, scale: 1.1 }}
                        whileTap={{ opacity: 1, x: "-50%", y: 0, scale: 0.95 }}
                    />
                    <h2>{(event.notifications && event.notifications.length > 0) ? 'Редактировать уведомление' : 'Новое уведомление'}</h2>
                </FormHeader>
            
                <FormContent>
                    {/* Секция описания */}
                    <motion.div variants={itemVariants}>
                      <FormSection>
                        <SectionTitle>
                          <MessageIcon />
                          Описание уведомления
                        </SectionTitle>
                        <ExpandingTextField
                            label="Текст сообщения"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            multiline
                            rows={descriptionRows}
                            onFocus={handleDescriptionFocus}
                            onBlur={handleDescriptionBlur}
                            required
                            fullWidth
                            disabled={isLoading}
                            error={!!error && description.trim() === ''}
                            sx={{ mt: 1 }}
                        />
                      </FormSection>
                    </motion.div>
                    
                    {/* Секция времени уведомления */}
                    <motion.div variants={itemVariants}>
                      <FormSection>
                        <SectionTitle>
                          <AccessTimeIcon />
                          Время отправки
                        </SectionTitle>
                        
                        <StyledRadioGroup
                            value={timeMode}
                            onChange={handleTimeModeChange}
                            sx={{ mb: 2 }}
                        >
                            <FormControlLabel 
                                value="relative" 
                                control={<Radio />} 
                                label="Относительно времени события" 
                            />
                            <div>
                              {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
                              {/* @ts-ignore */}
                              <AnimatePresence mode="wait">
                                {timeMode === 'relative' && (
                                  <motion.div
                                    key="relativeTime"
                                    variants={optionVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                  >
                                    <Box sx={{ ml: 4, mb: 2 }}>
                                        <TextField
                                            label="За сколько минут до события"
                                            value={timeBefore}
                                            onChange={handleTimeBeforeChange}
                                            type="number"
                                            fullWidth
                                            required={timeMode === 'relative'}
                                            size="small"
                                            inputProps={{ min: 0 }}
                                            error={timeMode === 'relative' && (timeBefore === '' || (typeof timeBefore === 'string' && parseInt(timeBefore, 10) < 0))}
                                            helperText={timeMode === 'relative' && (timeBefore === '' || (typeof timeBefore === 'string' && parseInt(timeBefore, 10) < 0)) ? "Необходимо указать время" : ""}
                                        />
                                    </Box>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                            
                            <FormControlLabel 
                                value="absolute" 
                                control={<Radio />} 
                                label="Указать конкретную дату и время" 
                            />
                            <div>
                              {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
                              {/* @ts-ignore */}
                              <AnimatePresence mode="wait">
                                {timeMode === 'absolute' && (
                                  <motion.div
                                    key="absoluteTime"
                                    variants={optionVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                  >
                                    <Box sx={{ ml: 4, mb: 2 }}>
                                        <TextField
                                            label="Дата и время уведомления"
                                            type="datetime-local"
                                            value={absoluteDateTime}
                                            onChange={handleAbsoluteDateTimeChange}
                                            fullWidth
                                            required={timeMode === 'absolute'}
                                            size="small"
                                            InputLabelProps={{ shrink: true }}
                                            error={timeMode === 'absolute' && absoluteDateTime === ''}
                                            helperText={timeMode === 'absolute' && absoluteDateTime === '' ? "Необходимо указать дату и время" : ""}
                                        />
                                    </Box>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                            
                            <FormControlLabel 
                                value="now" 
                                control={<Radio />} 
                                label="Отправить немедленно" 
                            />
                            <div>
                              {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
                              {/* @ts-ignore */}
                              <AnimatePresence mode="wait">
                                {timeMode === 'now' && (
                                  <motion.div
                                    key="nowTime"
                                    variants={optionVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                  >
                                    <Box sx={{ ml: 4, mb: 2 }}>
                                        <Typography variant="caption" color="text.secondary">
                                            Уведомление будет отправлено сразу после создания
                                        </Typography>
                                    </Box>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                        </StyledRadioGroup>
                      </FormSection>
                    </motion.div>
                    
                    {/* Секция с повторением */}
                    <motion.div variants={itemVariants}>
                      <FormSection>
                        <SectionTitle>
                          <EventRepeatIcon />
                          Повторение
                        </SectionTitle>
                        
                        <FormControl fullWidth required disabled={isLoading}>
                            <InputLabel id="repeat-select-label">Повторение</InputLabel>
                            <StyledSelect
                                labelId="repeat-select-label"
                                id="repeat-select"
                                value={repeat}
                                label="Повторение"
                                onChange={(event: SelectChangeEvent<unknown>, child: React.ReactNode) => {
                                    handleRepeatChange(event as SelectChangeEvent<RepeatType>);
                                }}
                            >
                                <MenuItem value="none">Никогда</MenuItem>
                                <MenuItem value="daily">Ежедневно</MenuItem>
                                <MenuItem value="weekly">Еженедельно</MenuItem>
                                <MenuItem value="monthly">Ежемесячно</MenuItem>
                            </StyledSelect>
                        </FormControl>
                        
                        <div>
                          {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
                          {/* @ts-ignore */}
                          <AnimatePresence mode="wait">
                            {repeat === 'weekly' && (
                              <motion.div
                                key="weeklyRepeat"
                                variants={slideVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                              >
                                <FormControl fullWidth required disabled={isLoading} error={!!error && selectedWeekdays.length === 0} sx={{ mt: 2 }}>
                                    <InputLabel id="weekdays-select-label">Дни недели</InputLabel>
                                    <StyledSelect
                                        labelId="weekdays-select-label"
                                        id="weekdays-select"
                                        multiple
                                        value={selectedWeekdays}
                                        onChange={(event: SelectChangeEvent<unknown>, child: React.ReactNode) => {
                                            handleWeekdaysChange(event as SelectChangeEvent<number[]>);
                                        }}
                                        input={<OutlinedInput label="Дни недели" />}
                                        renderValue={(selected) => (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {(selected as number[]).sort((a, b) => a - b).map((value) => (
                                                    <Chip key={value} label={weekdaysOptions.find(opt => opt.value === value)?.label} />
                                                ))}
                                            </Box>
                                        )}
                                        MenuProps={{ PaperProps: { style: { maxHeight: 224, width: 250 } } }}
                                    >
                                        {weekdaysOptions.map((option) => (
                                            <MenuItem key={option.value} value={option.value}>
                                                <Checkbox checked={selectedWeekdays.indexOf(option.value) > -1} />
                                                <ListItemText primary={option.label} />
                                            </MenuItem>
                                        ))}
                                    </StyledSelect>
                                    {error && selectedWeekdays.length === 0 && <p style={{ color: 'red', fontSize: '0.8em', margin: '3px 14px 0' }}>Выберите дни недели</p>}
                                </FormControl>
                              </motion.div>
                            )}
                            
                            {repeat === 'monthly' && (
                              <motion.div
                                key="monthlyRepeat"
                                variants={slideVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                              >
                                <TextField 
                                    label="День месяца"
                                    type="number"
                                    value={selectedMonthDay}
                                    onChange={handleMonthDayChange}
                                    required
                                    fullWidth
                                    disabled={isLoading}
                                    InputProps={{ inputProps: { min: 1, max: 31 } }} 
                                    error={!!error && (selectedMonthDay === '' || selectedMonthDay < 1 || selectedMonthDay > 31)}
                                    helperText={
                                        error && (selectedMonthDay === '' || selectedMonthDay < 1 || selectedMonthDay > 31) 
                                        ? "Введите число от 1 до 31" 
                                        : "Уведомлять в этот день каждого месяца"
                                    }
                                    sx={{ mt: 2 }}
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </FormSection>
                    </motion.div>
                    
                    {/* Секция с чатами */}
                    <motion.div variants={itemVariants}>
                      <FormSection>
                        <SectionTitle>
                          <ChatIcon />
                          Чаты для отправки
                        </SectionTitle>
                        
                        {!isAtoEventWithTargetChatRender ? (
                            <FormControl fullWidth required disabled={isLoading} error={!!error && selectedChatIds.length === 0}>
                                <InputLabel id="chats-select-label">Чаты для отправки</InputLabel>
                                <StyledSelect
                                    labelId="chats-select-label"
                                    id="chats-select"
                                    multiple
                                    value={selectedChatIds}
                                    onChange={(event: SelectChangeEvent<unknown>, child: React.ReactNode) => {
                                        handleChatSelectionChange(event as SelectChangeEvent<number[]>);
                                    }}
                                    input={<OutlinedInput label="Чаты для отправки" />}
                                    renderValue={(selected) => (selected as number[]).map(id => availableChats.find(c => c.id === id)?.name || `ID: ${id}`).join(', ')}
                                    MenuProps={{ 
                                        PaperProps: {
                                        style: {
                                            maxHeight: 224, 
                                            width: 250,
                                        },
                                        },
                                    }}
                                >
                                    {availableChats.map((chat) => (
                                        <MenuItem key={chat.id} value={chat.id}>
                                            <Checkbox checked={selectedChatIds.indexOf(chat.id) > -1} />
                                            <ListItemText primary={chat.name} />
                                        </MenuItem>
                                    ))}
                                    {availableChats.length === 0 && (
                                        <MenuItem disabled>Нет доступных чатов</MenuItem>
                                    )}
                                </StyledSelect>
                                {error && selectedChatIds.length === 0 && <p style={{ color: 'red', fontSize: '0.8em', margin: '3px 14px 0' }}>Выберите хотя бы один чат</p>}
                            </FormControl>
                        ) : (
                            <Box sx={{ p: 1.5, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--background-alt)' }}>
                                <Typography variant="subtitle2" gutterBottom sx={{ color: 'var(--text-secondary)' }}>
                                    Чат для отправки (Событие АТО):
                                </Typography>
                                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                    {isAtoEventWithTargetChatRender && event.chat_ids && event.chat_ids.length > 0 
                                        ? (availableChats.find(c => c.id === event.chat_ids![0])?.name || `ID: ${event.chat_ids![0]}`)
                                        : 'Чат не определен'}
                                </Typography>
                            </Box>
                        )}
                      </FormSection>
                    </motion.div>
                    
                    {/* Секция с подтверждением */}
                    <motion.div variants={itemVariants}>
                      <FormSection>
                        <SectionTitle>
                          <CheckCircleOutlineIcon />
                          Дополнительные настройки
                        </SectionTitle>
                        
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={requiresConfirmation}
                                    onChange={(e) => setRequiresConfirmation(e.target.checked)}
                                    disabled={isLoading}
                                />
                            }
                            label="Требуется подтверждение от пользователей"
                            sx={{ alignSelf: 'flex-start' }}
                        />
                      </FormSection>
                    </motion.div>
                    
                    {error && (
                      <motion.div 
                        variants={itemVariants}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ 
                          padding: '12px 16px',
                          marginTop: '16px',
                          backgroundColor: 'var(--error-background)',
                          color: 'var(--error-color)',
                          borderRadius: 'var(--radius)',
                          fontWeight: 500
                        }}
                      >
                        {error}
                      </motion.div>
                    )}
                </FormContent>
            </FormContainer>
        </>
    );
};

export default CreateNotificationForm;

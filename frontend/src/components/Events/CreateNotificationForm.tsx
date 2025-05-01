import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks'; 
import { selectUser } from '../../store/slices/userSlice'; 
import { selectAllEvents, createNotificationThunk, updateNotificationThunk } from '../../store/slices/eventsSlice'; 
import { EventNotification, EventRead, NotificationCreate, RepeatSettings } from '../../types/event';

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
import { styled } from '@mui/material/styles';

interface CreateNotificationFormProps {
    eventId: number;
    notificationId?: string | null;
    onClose: () => void;
    onStateChange: (state: { submit: () => Promise<void>; isValid: boolean; isLoading: boolean }) => void;
}

type RepeatType = RepeatSettings['type'];

// Опции для дней недели
const weekdaysOptions = [
    { value: 1, label: 'Пн' }, { value: 2, label: 'Вт' }, { value: 3, label: 'Ср' },
    { value: 4, label: 'Чт' }, { value: 5, label: 'Пт' }, { value: 6, label: 'Сб' },
    { value: 0, label: 'Вс' },
];

// --- Стилизуем TextField для плавного перехода высоты --- 
const ExpandingTextField = styled(TextField)(({ theme }) => ({
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

const CreateNotificationForm: React.FC<CreateNotificationFormProps> = ({ eventId, notificationId, onClose, onStateChange }) => {
    const dispatch = useAppDispatch(); 
    const event = useAppSelector(selectAllEvents).find((e: EventRead) => e.id === eventId);
    const [description, setDescription] = useState('');
    const [timeBefore, setTimeBefore] = useState<number | string>('');
    const [repeat, setRepeat] = useState<RepeatType>('none');
    const [selectedChatIds, setSelectedChatIds] = useState<number[]>([]); 
    const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
    const [selectedMonthDay, setSelectedMonthDay] = useState<number | ''>(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [descriptionRows, setDescriptionRows] = useState(3);
    const user = useAppSelector(selectUser);
    const availableChats = useMemo(() => {
        return user?.groups
            ?.filter(g => g.group_type === 'chef')
            ?.map(g => ({ id: g.chat_id, name: g.title })) 
            || []; 
    }, [user]);

    useEffect(() => {
        let initialData: Partial<EventNotification> = {};
        let notificationToEdit: EventNotification | undefined = undefined;

        if (event && notificationId) {
            notificationToEdit = event.notifications.find(n => n.id === notificationId);
        } else if (event && event.notifications && event.notifications.length > 0) {
            // Оставляем fallback на первое уведомление, если ID не передан, но уведомления есть
            // Это может быть полезно, если логика открытия редактирования не передает ID
            // Но лучше всегда передавать ID для ясности.
            // notificationToEdit = event.notifications[0]; 
        }

        if (notificationToEdit) {
            initialData = {
                message: notificationToEdit.message || '',
                time: notificationToEdit.time ?? 15,
                repeat: notificationToEdit.repeat || { type: 'none' },
                chat_ids: notificationToEdit.chat_ids || [],
            };
        } else {
            // Значения по умолчанию для нового уведомления
            initialData = {
                message: '',
                time: 15,
                repeat: { type: 'none' },
                chat_ids: [],
            };
        }

        setDescription(initialData.message || '');
        setTimeBefore(initialData.time ?? 15);
        setRepeat(initialData.repeat?.type || 'none');
        setSelectedChatIds(initialData.chat_ids || []);
        setSelectedWeekdays(initialData.repeat?.weekdays || []);
        setSelectedMonthDay(initialData.repeat?.month_day ?? 1);

    }, [eventId, event, notificationId]);

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

    const isFormValid = useCallback(() => {
        const timeNum = typeof timeBefore === 'string' ? parseInt(timeBefore, 10) : timeBefore;
        let isValid = (
            description.trim() !== '' && 
            !isNaN(timeNum) && 
            timeNum >= 0 && 
            selectedChatIds.length > 0
        );
        if (repeat === 'weekly' && selectedWeekdays.length === 0) {
            isValid = false;
        }
        if (repeat === 'monthly' && (selectedMonthDay === '' || selectedMonthDay < 1 || selectedMonthDay > 31)) {
            isValid = false;
        }
        return isValid;
    }, [description, timeBefore, selectedChatIds, repeat, selectedWeekdays, selectedMonthDay]);

    const handleSubmit = useCallback(async () => {
        if (!isFormValid()) {
            setError('Пожалуйста, заполните все обязательные поля корректно.');
            return;
        }
        setError(null);
        setIsLoading(true);

        try {
            const timeNum = typeof timeBefore === 'string' ? parseInt(timeBefore, 10) : timeBefore;
            
            let repeatSettings: RepeatSettings = { type: repeat };
            if (repeat === 'weekly' && selectedWeekdays.length > 0) {
                repeatSettings.weekdays = selectedWeekdays.sort((a, b) => a - b);
            }
            if (repeat === 'monthly' && selectedMonthDay !== '') {
                repeatSettings.month_day = selectedMonthDay;
            }

            const notificationData = {
                message: description.trim(),
                time: timeNum,
                repeat: repeatSettings, 
                chat_ids: selectedChatIds
            };

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
            setError(apiError?.message || apiError || 'Не удалось сохранить уведомление. Попробуйте позже.');
        } finally {
            setIsLoading(false);
        }
    }, [dispatch, eventId, notificationId, description, timeBefore, repeat, selectedChatIds, selectedWeekdays, selectedMonthDay, isFormValid, onClose]);

    useEffect(() => {
        if (onStateChange) {
            onStateChange({ 
                submit: handleSubmit,
                isValid: isFormValid(),
                isLoading: isLoading
            });
        }
    }, [isLoading, isFormValid, handleSubmit, onStateChange]);

    if (!event) {
        return <Box sx={{ p: 2 }}>Событие не найдено.</Box>;
    }

    return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <h2>{(event.notifications && event.notifications.length > 0) ? 'Редактировать' : 'Новое'} уведомление</h2>
            <ExpandingTextField
                label="Описание уведомления"
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
            />
            <TextField 
                label="Уведомить за (минут)"
                type="number"
                value={timeBefore}
                onChange={handleTimeBeforeChange}
                required
                fullWidth
                disabled={isLoading}
                InputProps={{ inputProps: { min: 0 } }} 
                error={!!error && (typeof timeBefore === 'string' ? isNaN(parseInt(timeBefore, 10)) : timeBefore < 0)}
            />
            <FormControl fullWidth required disabled={isLoading}>
                <InputLabel id="repeat-select-label">Повторение</InputLabel>
                <Select
                    labelId="repeat-select-label"
                    id="repeat-select"
                    value={repeat}
                    label="Повторение"
                    onChange={handleRepeatChange}
                >
                    <MenuItem value="none">Никогда</MenuItem>
                    <MenuItem value="daily">Ежедневно</MenuItem>
                    <MenuItem value="weekly">Еженедельно</MenuItem>
                    <MenuItem value="monthly">Ежемесячно</MenuItem>
                </Select>
            </FormControl>
            {repeat === 'weekly' && (
                <FormControl fullWidth required disabled={isLoading} error={!!error && selectedWeekdays.length === 0}>
                    <InputLabel id="weekdays-select-label">Дни недели</InputLabel>
                    <Select
                        labelId="weekdays-select-label"
                        id="weekdays-select"
                        multiple
                        value={selectedWeekdays}
                        onChange={handleWeekdaysChange}
                        input={<OutlinedInput label="Дни недели" />}
                        renderValue={(selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {selected.sort((a, b) => a - b).map((value) => (
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
                    </Select>
                     {error && selectedWeekdays.length === 0 && <p style={{ color: 'red', fontSize: '0.8em', margin: '3px 14px 0' }}>Выберите дни недели</p>}
                 </FormControl>
             )}
            {repeat === 'monthly' && (
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
                />
            )}
            <FormControl fullWidth required disabled={isLoading} error={!!error && selectedChatIds.length === 0}>
                <InputLabel id="chats-select-label">Чаты для отправки</InputLabel>
                <Select
                    labelId="chats-select-label"
                    id="chats-select"
                    multiple
                    value={selectedChatIds}
                    onChange={handleChatSelectionChange}
                    input={<OutlinedInput label="Чаты для отправки" />}
                    renderValue={(selected) => selected.map(id => availableChats.find(c => c.id === id)?.name || `ID: ${id}`).join(', ')}
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
                </Select>
                {error && selectedChatIds.length === 0 && <p style={{ color: 'red', fontSize: '0.8em', margin: '3px 14px 0' }}>Выберите хотя бы один чат</p>}
            </FormControl>
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </Box>
    );
};

export default CreateNotificationForm;

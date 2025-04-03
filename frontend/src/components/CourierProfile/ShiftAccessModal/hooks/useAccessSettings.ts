import { useState, useEffect, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '../../../../store/hooks';
import { 
    AccessSettings, 
    selectAccessSettings, 
    selectIsLoadingSettings, 
    selectSettingsError,
    updateAccessSettings,
    fetchAccessSettings
} from '../../../../store/slices/shiftsSlice';
import { addNotification, NotificationTypes } from '../../../../store/slices/notificationSlice';

interface UseAccessSettingsProps {
    chatId?: string;
}

/**
 * Хук для управления настройками доступа к сменам
 */
export const useAccessSettings = ({ chatId }: UseAccessSettingsProps = {}) => {
    const dispatch = useAppDispatch();
    
    // Получаем настройки из Redux
    const storedSettings = useAppSelector(selectAccessSettings);
    const isLoading = useAppSelector(selectIsLoadingSettings);
    const error = useAppSelector(selectSettingsError);
    
    // Локальное состояние для отслеживания изменений
    const [settings, setSettings] = useState<AccessSettings>(storedSettings);
    const [isDirty, setIsDirty] = useState(false);
    
    // Загружаем настройки при монтировании компонента
    useEffect(() => {
        dispatch(fetchAccessSettings({ chatId }));
    }, [dispatch, chatId]);
    
    // Обновляем локальное состояние при изменении хранимых настроек
    useEffect(() => {
        setSettings(storedSettings);
    }, [storedSettings]);
    
    // Обработчик изменения настроек
    const handleSettingsChange = useCallback((updatedValues: Partial<AccessSettings>) => {
        setSettings(prevSettings => {
            const newSettings = { ...prevSettings, ...updatedValues };
            setIsDirty(true);
            return newSettings;
        });
    }, []);
    
    // Сохранение настроек на сервере
    const saveSettings = useCallback(async () => {
        try {
            console.log('🔍 Текущие настройки перед сохранением:', {
                полныеДанные: JSON.stringify(settings, null, 2),
                keys: Object.keys(settings),
                count: Object.keys(settings).length,
                источник: 'useAccessSettings.saveSettings'
            });
            
            // Убедимся, что все поля присутствуют
            const completeSettings = {
                // ID чата
                chat_id: chatId,
                
                // Общие настройки
                allowMultipleShifts: settings.allowMultipleShifts ?? false,
                autoApprove: settings.autoApprove ?? false,
                allowSameDay: settings.allowSameDay ?? false,
                
                // Настройки периода регистрации
                registrationStartDay: settings.registrationStartDay ?? 4,
                registrationStartHour: settings.registrationStartHour ?? 12,
                registrationStartMinute: settings.registrationStartMinute ?? 0,
                
                // Гибкие настройки периода доступа
                offsetType: settings.offsetType ?? 'weeks',
                offsetAmount: settings.offsetAmount ?? 1,
                periodLength: settings.periodLength ?? 7,
                
                // Период активности правила
                isAlwaysActive: settings.isAlwaysActive ?? true,
                activeStartDate: settings.activeStartDate ?? '',
                activeEndDate: settings.activeEndDate ?? '',
                
                // Устаревшие поля
                daysAhead: settings.daysAhead ?? 14,
                
                // Списки
                enabledDates: settings.enabledDates ?? [],
                restrictedUsers: settings.restrictedUsers ?? [],
                
                // Метаданные
                lastUpdated: new Date().toISOString(),
            };
            
            console.log('📝 Дополненные настройки для отправки:', {
                полныеДанные: JSON.stringify(completeSettings, null, 2),
                keys: Object.keys(completeSettings),
                count: Object.keys(completeSettings).length,
                источник: 'useAccessSettings.saveSettings (completeSettings)'
            });
            
            await dispatch(updateAccessSettings(completeSettings)).unwrap();
            
            dispatch(addNotification({
                type: NotificationTypes.SUCCESS,
                message: 'Настройки доступа успешно сохранены',
                duration: 5000
            }));
            
            setIsDirty(false);
            return true;
        } catch (error) {
            console.error('❌ Ошибка при сохранении настроек:', error);
            
            let errorMessage = 'Ошибка при сохранении настроек доступа';
            
            // Проверяем, является ли ошибка строкой (от rejectWithValue)
            if (typeof error === 'string') {
                errorMessage = error;
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }
            
            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: errorMessage,
                duration: 5000
            }));
            
            return false;
        }
    }, [dispatch, settings, chatId]);
    
    // Сброс настроек к начальным значениям
    const resetSettings = useCallback(() => {
        setSettings(storedSettings);
        setIsDirty(false);
    }, [storedSettings]);
    
    return {
        settings,
        isLoading,
        error,
        isDirty,
        handleSettingsChange,
        saveSettings,
        resetSettings
    };
}; 
import { useContext } from 'react';
import { AccessSettingsContext, AccessSettingsContextType } from '@/features/courierSchedule/components/setting-panel/shift-access-modal-settings/components/ShiftAccessModal';

/**
 * Хук для доступа к настройкам доступа внутри компонентов шагов
 * @returns Объект с настройками доступа и методом для их обновления
 */
export const useStepAccessSettings = (): AccessSettingsContextType => {
    const context = useContext(AccessSettingsContext);
    
    if (!context) {
        throw new Error('useStepAccessSettings должен использоваться внутри AccessSettingsContext.Provider');
    }
    
    return context;
}; 
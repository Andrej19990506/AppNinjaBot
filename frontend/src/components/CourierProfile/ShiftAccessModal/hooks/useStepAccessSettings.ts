import { useContext } from 'react';
import { AccessSettingsContext, AccessSettingsContextType } from '../components/ShiftAccessModal';

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
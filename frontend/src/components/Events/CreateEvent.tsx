import React, { useState, useMemo } from 'react';
// Убираем ChatSelector
// import ChatSelector from '../common/ChatSelector/ChatSelector'; 
import { AnimatePresence } from 'framer-motion';
// import { useAppSelector } from '../../store/hooks'; // Убрали, так как не используется
// import { selectUser } from '../../store/slices/userSlice'; // Убрали

// Определяем типы пропсов
interface CreateEventProps {
    onClose: () => void; // Функция без аргументов и без возврата
}

// Максимально упрощенный CreateEvent
const CreateEvent: React.FC<CreateEventProps> = ({ onClose }) => {
    // Оставляем только эти состояния
    // const [currentStep, setCurrentStep] = useState(1); // Убираем шаги
    const [isLoading, setIsLoading] = useState(false);
    const [description, setDescription] = useState('');
    // const [selectedChats, setSelectedChats] = useState([]); // Убираем чаты
    const [showSuccess, setShowSuccess] = useState(false);

    // Убираем user и фильтр чатов, так как они больше не нужны здесь
    // const user = useAppSelector(selectUser); 
    // const allUserChats = user?.groups || [];
    // const chefChats = useMemo(() => { ... }, [allUserChats]);

    // Убираем handleChatSelect

    // Типизируем событие в onChange
    const handleDescriptionChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setDescription(event.target.value);
    };

    // Рендерим только поле описания
    const renderContent = () => {
        return (
            <div> 
               <h2>Новое событие</h2> {/* Добавим заголовок */}
               <p>Введите описание:</p>
               <textarea 
                   value={description} 
                   onChange={handleDescriptionChange} // Используем типизированный хендлер
                   placeholder="Описание события..." 
                   maxLength={1000} 
                   rows={5} 
                   style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }} 
                   autoFocus // Ставим фокус сразу
               />
            </div>
        );
    };

    // Отправляем только описание
    const handleSubmit = async () => {
        // Проверка на пустое описание перед отправкой
        if (description.trim().length === 0) {
            // Можно показать ошибку или просто ничего не делать
            console.warn('Описание не может быть пустым');
            return; 
        }

        try {
            setIsLoading(true);
            
            const eventData = {
                description: description,
                // Убираем chat_ids
            };
            
            console.log('TODO: Отправить ТОЛЬКО описание на API:', eventData);
            await new Promise(resolve => setTimeout(resolve, 1000)); 

            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                onClose(); // Закрываем шторку
            }, 1500); // Уменьшим время показа успеха
        } catch (error) {
            console.error('Error creating event:', error);
            // TODO: Показать ошибку
        } finally {
            setIsLoading(false);
        }
    };

    // Убираем проверку canProceed

    return (
        <div>
            {/* @ts-ignore // Known issue with framer-motion types */}
            <AnimatePresence mode="sync">
                 <div className="stepContent" style={{ minHeight: '30vh' }}> {/* Можно уменьшить высоту */} 
                     {renderContent()}
                 </div>
            </AnimatePresence>

            {/* Только кнопки Отмена и Создать */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                <button onClick={onClose} disabled={isLoading}>Отмена</button> 
                
                <button 
                    onClick={handleSubmit} 
                    // Кнопка активна, если описание не пустое и не идет загрузка
                    disabled={description.trim().length === 0 || isLoading}
                >
                    {isLoading ? 'Создание...' : 'Создать'} {/* Укоротим текст кнопки */} 
                </button>
            </div>

            {/* Экран успеха */} 
            {/* @ts-ignore // Known issue with framer-motion types */}
            <AnimatePresence mode="sync">
                {showSuccess && 
                    <div style={{ /* стили */ }}>
                        Событие создано!
                    </div>
                }
            </AnimatePresence>
        </div>
    );
};

export default CreateEvent; 
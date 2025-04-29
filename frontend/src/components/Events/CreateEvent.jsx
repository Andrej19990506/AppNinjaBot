import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
// import styles from './CreateEvent.module.css'; // Уже удален
// import MobileLayout from '../layouts/MobileLayout'; // Уже удален
// import DesktopLayout from '../layouts/DesktopLayout'; // Уже удален
// import { useMediaQuery } from '../../hooks/useMediaQuery'; // Уже удален
// import TextArea from '../common/Textarea/TextArea'; // Уже удален

// Удаляем импорт DateTimePicker
// import DateTimePicker from '../DateTimePicker/DateTimePicker';
// Удаляем импорт RepeatSettings
// import RepeatSettings from '../RepeatSettings';
// Удаляем импорт NotificationManager
// import NotificationManager from '../notifications/NotificationManager';
// Исправляем путь и расширение ChatSelector
import ChatSelector from '../common/ChatSelector/ChatSelector';
// Удаляем импорт useApi
// import { useApi } from '../../hooks/useApi';
// Удаляем импорт SuccessScreen
// import SuccessScreen from '../common/SuccessScreen/SuccessScreen';
import { AnimatePresence } from 'framer-motion';
// Импортируем хук Redux
import { useAppSelector } from '../../store/hooks'; 
// Импортируем селектор пользователя
import { selectUser } from '../../store/slices/userSlice'; 
// import { selectUserChats } from '../../store/slices/userSlice'; // Пример селектора, ЗАМЕНИТЬ НА РЕАЛЬНЫЙ

const CreateEvent = () => {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    // Возвращаем isLoading и setIsLoading
    const [isLoading, setIsLoading] = useState(false);
    // Удаляем isMobile
    // const isMobile = useMediaQuery('(max-width: 768px)');
    const [description, setDescription] = useState('');
    const [selectedDate, setSelectedDate] = useState(null);
    const [repeatType, setRepeatType] = useState('none');
    const [selectedWeekdays, setSelectedWeekdays] = useState([]);
    const [monthDay, setMonthDay] = useState(null);
    const [selectedChats, setSelectedChats] = useState([]);
    const [notifications, setNotifications] = useState([]);
    // Удаляем errors и setErrors
    /*
    const [errors, setErrors] = useState({
        description: false,
        date: false,
        notifications: false,
        chats: false
    });
    */
    const [showSuccess, setShowSuccess] = useState(false);

    // Получаем пользователя из стора
    const user = useAppSelector(selectUser);
    // Берем группы из пользователя
    const allUserChats = user?.groups || []; 

    // Фильтруем чаты типа 'chef' и преобразуем в формат ChatItem
    const chefChats = useMemo(() => {
        return allUserChats
            .filter(chat => chat.group_type === 'chef')
            .map(chat => ({ // Преобразуем в формат ChatItem, ожидаемый ChatSelector
                chat_id: chat.chat_id?.toString() || '', // Убедимся, что chat_id это строка
                chat_title: chat.title || 'Без названия',
                admins: chat.admins || [], // Добавляем поле admins (может быть пустым)
                // Добавляем другие поля из интерфейса ChatItem, если они есть в group
                group_type: chat.group_type, 
                id: chat.id, // Добавляем id из group
                metadata: chat.json_metadata || {}, // Добавляем metadata
                // Добавь сюда другие поля из Group, если они нужны ChatSelector'у
            })); 
    }, [allUserChats]);

    const handleRepeatTypeChange = (type) => {
        setRepeatType(type);
        if (type === 'none') {
            setSelectedWeekdays([]);
            setMonthDay(null);
        }
        if (type === 'weekly') {
            const today = new Date().getDay();
            setSelectedWeekdays([today]);
        }
        if (type === 'monthly') {
            setMonthDay(new Date().getDate());
        }
    };

    const handleChatSelect = (chatIds) => {
        setSelectedChats(chatIds);
    };

    const handleNotificationsChange = (newNotifications) => {
        setNotifications(newNotifications);
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <div> {/* Placeholder для шага 1 */} 
                       <p>Введите описание события (компонент TextArea будет здесь)</p>
                       <textarea 
                           value={description} 
                           onChange={(e) => setDescription(e.target.value)} 
                           placeholder="Описание события..." 
                           maxLength={1000} 
                           rows={5} 
                           style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }} // Базовые стили
                       />
                    </div>
                );
            case 2:
                 // Заменяем DateTimePicker на плейсхолдер
                return (
                    // <DateTimePicker
                    //     selectedDate={selectedDate}
                    //     onDateChange={setSelectedDate}
                    // />
                    <div> {/* Placeholder для шага 2 */} 
                        <p>Выберите дату и время (компонент DateTimePicker будет здесь)</p>
                        {/* Можно временно добавить стандартный input */} 
                        <input 
                            type="datetime-local" 
                            value={selectedDate ? new Date(selectedDate.getTime() - selectedDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} 
                            onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value) : null)} 
                        />
                    </div>
                );
            case 3:
                // Заменяем RepeatSettings на плейсхолдер
                return (
                    // <RepeatSettings
                    //     repeatType={repeatType}
                    //     selectedWeekdays={selectedWeekdays}
                    //     monthDay={monthDay}
                    //     onRepeatTypeChange={handleRepeatTypeChange}
                    //     onWeekdayChange={handleWeekdayChange}
                    //     onMonthDayChange={handleMonthDayChange}
                    // />
                    <div> {/* Placeholder для шага 3 */} 
                        <p>Настройте параметры повтора (компонент RepeatSettings будет здесь)</p>
                        <select value={repeatType} onChange={(e) => handleRepeatTypeChange(e.target.value)}>
                            <option value="none">Не повторять</option>
                            <option value="weekly">Еженедельно</option>
                            <option value="monthly">Ежемесячно</option>
                        </select>
                        {/* TODO: Добавить выбор дней недели/месяца, если нужно */} 
                    </div>
                );
            case 4:
                // Заменяем NotificationManager на плейсхолдер
                return (
                    // <NotificationManager 
                    //     notifications={notifications}
                    //     onNotificationsChange={handleNotificationsChange}
                    // />
                    <div> {/* Placeholder для шага 4 */} 
                        <p>Настройте уведомления (компонент NotificationManager будет здесь)</p>
                        {/* TODO: Добавить базовый ввод уведомлений, если нужно */} 
                        <button onClick={() => handleNotificationsChange([{ message: 'Напомнить за час', time: '60' }])}>Добавить пример уведомления</button>
                        <pre>{JSON.stringify(notifications, null, 2)}</pre>
                    </div>
                );
            case 5:
                return (
                    <ChatSelector
                        // Передаем отфильтрованные чаты
                        chats={chefChats} 
                        selectedChats={selectedChats} // Передаем массив ID выбранных чатов
                        onChatSelect={handleChatSelect} // Передаем колбэк для обновления выбранных чатов
                        mode="events" // Указываем режим
                    />
                );
            default:
                return null;
        }
    };

    const handleSubmit = async () => {
        try {
            setIsLoading(true);
            
            const localDate = new Date(selectedDate);
            const krasnoyarskDate = new Date(localDate); // Оставляем логику времени, но надо проверить
            
            const formattedDate = krasnoyarskDate.toLocaleString('sv', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Asia/Krasnoyarsk' // ВНИМАНИЕ: Проверить нужный часовой пояс!
            }).replace('T', ' ');
            
            const repeatData = {
                type: repeatType,
                weekdays: repeatType === 'weekly' ? selectedWeekdays : [],
                monthDay: repeatType === 'monthly' ? monthDay : null
            };
            
            const eventData = {
                description: description,
                date: formattedDate,
                repeat: repeatData,
                notifications: notifications.map(n => ({
                    message: n.message,
                    time: parseInt(n.time) // Убедиться, что time это строка перед parseInt
                })),
                chat_ids: selectedChats
            };
            
            // Заменяем вызов apiCreateEvent на TODO
            // await apiCreateEvent(eventData);
            console.log('TODO: Отправить данные на API:', eventData);
            // Имитируем задержку API
            await new Promise(resolve => setTimeout(resolve, 1000)); 

            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                navigate('/events');
            }, 2000);
        } catch (error) {
            console.error('Error creating event:', error);
            // TODO: Добавить обработку ошибок для пользователя
        } finally {
            setIsLoading(false);
        }
    };

    const canProceedToNextStep = () => {
        switch (currentStep) {
            case 1:
                return description.trim().length > 0;
            case 2:
                return selectedDate !== null;
            case 3:
                return true;
            case 4:
                return notifications.length > 0;
            case 5:
                return selectedChats.length > 0;
            default:
                return false;
        }
    };

    return (
        <div className="pageWrapper">
            <AnimatePresence mode="sync">
                 <div className="stepContent">
                     {renderStepContent()}
                 </div>
            </AnimatePresence>

            <div>
                <button onClick={() => currentStep > 1 && setCurrentStep(currentStep - 1)} disabled={currentStep === 1}>Назад</button>
                <button onClick={() => currentStep < 5 && canProceedToNextStep() && setCurrentStep(currentStep + 1)} disabled={currentStep === 5 || !canProceedToNextStep()}>Далее</button>
                {currentStep === 5 && <button onClick={handleSubmit} disabled={!canProceedToNextStep() || isLoading}>{isLoading ? 'Отправка...' : 'Создать событие'}</button>}
            </div>

            {/* Заменяем SuccessScreen на плейсхолдер */}
            <AnimatePresence mode="sync">
                {showSuccess && 
                    // <SuccessScreen />
                    <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'lightgreen', padding: '20px', borderRadius: '10px', zIndex: 1000 }}>
                        Событие успешно создано! (Плейсхолдер SuccessScreen)
                    </div>
                }
            </AnimatePresence>
        </div>
    );
};

export default CreateEvent; 
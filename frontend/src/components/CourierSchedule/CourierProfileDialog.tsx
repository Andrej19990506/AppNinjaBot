import React, { useState, useEffect, useMemo } from 'react';
import styled, { keyframes } from 'styled-components';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import defaultAvatar from '../../assets/images/Ninja.jpg';
import { updateUserProfileThunk } from '../../store/slices/userSlice';
import { updateSeniorityStatus } from '../../store/slices/userSlice';
import { addNotification, NotificationTypes } from '../../store/slices/notificationSlice';

// Добавляем ShiftSlotLocal из хука для единообразия
interface ShiftSlotLocal {
    id?: string;
    userId?: string;
    photo_url?: string | null;
    firstName?: string;
    lastName?: string;
    shiftType?: 'day' | 'night';
    slotIndex: number;
    isSeniorCourier?: boolean;
    is_senior_courier?: boolean; // Для совместимости
}

interface CourierProfileDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave?: (data: { firstName: string; lastName: string; isSeniorCourier?: boolean; }) => void;
    profileData?: ShiftSlotLocal | null;
    chatId?: string;
}

const slideIn = keyframes`
    from {
        transform: translateY(-20px);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
`;

const slideOut = keyframes`
    from {
        transform: translateY(0);
        opacity: 1;
    }
    to {
        transform: translateY(20px);
        opacity: 0;
    }
`;

const fadeIn = keyframes`
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
`;

const fadeOut = keyframes`
    from {
        opacity: 1;
    }
    to {
        opacity: 0;
    }
`;

const DialogOverlay = styled.div<{ $isOpen: boolean; $isClosing: boolean }>`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: ${props => props.$isClosing ? fadeOut : fadeIn} var(--transition-normal) ease-out;
    backdrop-filter: blur(4px);
    
    @supports (-webkit-touch-callout: none) {
        padding-bottom: 40px;
        min-height: -webkit-fill-available;
    }
`;

const DialogContent = styled.div<{ $isClosing: boolean }>`
    background-color: var(--card-background);
    border-radius: var(--radius-lg);
    padding: 24px;
    width: 90%;
    max-width: 400px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: var(--shadow-lg);
    animation: ${props => props.$isClosing ? slideOut : slideIn} var(--transition-normal) ease-out;
    border: 1px solid var(--border-color);
    margin: auto;
    
    scrollbar-width: thin;
    scrollbar-color: var(--primary-color) transparent;
    
    &::-webkit-scrollbar {
        width: 6px;
    }
    
    &::-webkit-scrollbar-track {
        background: transparent;
    }
    
    &::-webkit-scrollbar-thumb {
        background-color: var(--primary-color);
        border-radius: 3px;
    }

    @media screen and (max-height: 600px) {
        margin: 20px auto;
    }
`;

const Header = styled.div`
    text-align: center;
    margin-bottom: 24px;
`;

const Title = styled.h2`
    color: var(--text-color);
    font-size: 1.5rem;
    margin: 0;
    margin-bottom: 8px;
    text-align: center;
`;

const ProfileImage = styled.div<{ $url?: string }>`
    width: 120px;
    height: 120px;
    border-radius: 50%;
    margin: 0 auto 24px;
    background: ${props => props.$url ? `url(${props.$url})` : `url(${defaultAvatar})`};
    background-size: cover;
    background-position: center;
    border: 3px solid var(--primary-color);
    box-shadow: var(--shadow-md);
`;

const Form = styled.form`
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

const InputGroup = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const Label = styled.label`
    color: var(--text-color);
    font-size: 0.9rem;
`;

const Input = styled.input`
    padding: 12px;
    border-radius: var(--radius);
    border: 1px solid var(--border-color);
    background-color: var(--background-color);
    color: var(--text-color);
    font-size: 1rem;
    transition: all var(--transition-fast);

    &:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 2px var(--primary-transparent);
    }

    &::placeholder {
        color: var(--text-secondary);
    }
`;

const CheckboxGroup = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 12px;
`;

const CheckboxLabel = styled.label`
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-color);
    font-size: 0.9rem;
    cursor: pointer;
`;

const Checkbox = styled.input`
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--primary-color);
`;

const Button = styled.button`
    padding: 12px;
    border-radius: var(--radius);
    border: none;
    background: var(--gradient-primary);
    color: white;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
    margin-top: 8px;

    &:hover {
        transform: var(--hover-transform);
        box-shadow: var(--shadow-md);
    }

    &:active {
        transform: var(--active-transform);
    }
`;

const ErrorMessage = styled.div`
    color: var(--error-color);
    margin-bottom: 16px;
    font-size: 0.9rem;
`;

const CloseButton = styled.button`
    position: absolute;
    top: 12px;
    right: 12px;
    background: none;
    border: none;
    font-size: 1.8rem;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 4px;
    line-height: 1;

    &:hover {
        color: var(--text-color);
    }
`;

const CourierProfileDialog: React.FC<CourierProfileDialogProps> = ({
    isOpen,
    onClose,
    onSave,
    profileData,
    chatId
}) => {
    const currentUser = useAppSelector(state => state.user.user);
    const loading = useAppSelector(state => state.user.loading);
    const error = useAppSelector(state => state.user.error);
    const dispatch = useAppDispatch();

    const isCurrentUserProfile = !profileData || (currentUser?.id === profileData?.userId);
    const displayData = profileData || currentUser;

    const getFirstName = (data: any): string => data?.firstName ?? data?.first_name ?? '';
    const getLastName = (data: any): string => data?.lastName ?? data?.last_name ?? '';
    const getIsSenior = (data: any): boolean => !!(data && (data.isSeniorCourier || data.is_senior_courier));
    const getPhotoUrl = (data: any): string | undefined => data?.photo_url || undefined;

    const [localError, setLocalError] = useState<string | null>(null);
    const [isClosing, setIsClosing] = useState(false);

    // Находим текущую группу в данных пользователя
    const currentGroup = useMemo(() => {
        if (!currentUser || !currentUser.groups || !chatId) return null;
        return currentUser.groups.find(g => String(g.chat_id) === String(chatId));
    }, [currentUser, chatId]);

    // Определяем, является ли текущий пользователь админом/создателем в ЭТОЙ группе
    const isCurrentUserAdminOrCreator = useMemo(() => {
        if (!currentGroup) return false;
        // Убедимся, что проверяем и 'admin' для совместимости
        return currentGroup.role === 'administrator' || 
               currentGroup.role === 'creator' ||
               currentGroup.role === 'admin'; 
    }, [currentGroup]);

    // Инициализируем состояние isSenior из данных ТЕКУЩЕЙ группы, если это профиль пользователя
    // Иначе (если смотрим чужой профиль) - берем из profileData
    const initialSeniorStatus = useMemo(() => {
        if (isCurrentUserProfile && currentGroup) {
            // Если статус null, считаем как false для чекбокса
            return currentGroup.is_senior_courier ?? false; 
        } else {
            // Для чужого профиля или если нет группы
            return getIsSenior(displayData); 
        }
    }, [isCurrentUserProfile, currentGroup, displayData]);

    const [firstName, setFirstName] = useState(getFirstName(displayData));
    const [lastName, setLastName] = useState(getLastName(displayData));
    const [isSenior, setIsSenior] = useState(initialSeniorStatus);
    // Отслеживаем исходные значения для проверки изменений
    const [initialFirstName, setInitialFirstName] = useState(getFirstName(displayData));
    const [initialLastName, setInitialLastName] = useState(getLastName(displayData));
    const [initialIsSeniorForSubmit, setInitialIsSeniorForSubmit] = useState(initialSeniorStatus);

    // Обновляем состояния и ИСХОДНЫЕ значения при изменении данных
    useEffect(() => {
        const dataToDisplay = profileData || currentUser;
        const newFirstName = getFirstName(dataToDisplay);
        const newLastName = getLastName(dataToDisplay);
        const newSeniorStatus = initialSeniorStatus; // Используем уже вычисленное
        
        setFirstName(newFirstName);
        setLastName(newLastName);
        setIsSenior(newSeniorStatus);
        
        // Обновляем начальные значения для следующего сравнения при submit
        setInitialFirstName(newFirstName);
        setInitialLastName(newLastName);
        setInitialIsSeniorForSubmit(newSeniorStatus);
        
        setLocalError(null);
    }, [currentUser, profileData, initialSeniorStatus]); 

    const handleClose = () => {
        if (isClosing) return;
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setIsClosing(false);
        }, 300);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);
        if (!isCurrentUserProfile || !currentUser?.id || !chatId) return; // Проверяем наличие currentUser.id и chatId

        let closeDialog = true; // Флаг, нужно ли закрывать диалог после сохранения
        const userId = currentUser.id;

        // 1. Проверяем и обновляем имя/фамилию
        const firstNameChanged = firstName.trim() !== initialFirstName.trim();
        const lastNameChanged = lastName.trim() !== initialLastName.trim();

        if (firstNameChanged || lastNameChanged) {
            console.log('[CourierProfileDialog] Обновляем имя/фамилию...');
            try {
                await dispatch(updateUserProfileThunk({
                    userId: userId,
                    data: { firstName: firstName.trim(), lastName: lastName.trim() }
                })).unwrap(); // Используем unwrap для обработки ошибок thunk
                
                dispatch(addNotification({ type: NotificationTypes.SUCCESS, message: 'Имя и фамилия обновлены' }));
                // Обновляем initial значения после успешного сохранения
                setInitialFirstName(firstName.trim());
                setInitialLastName(lastName.trim());
            } catch (error: any) {
                console.error('Ошибка обновления профиля:', error);
                setLocalError(typeof error === 'string' ? error : error?.message || 'Не удалось обновить имя/фамилию.');
                closeDialog = false; // Не закрываем диалог при ошибке
            }
        }

        // 2. Проверяем и обновляем статус старшего (только для админов/создателей)
        const seniorStatusChanged = isSenior !== initialIsSeniorForSubmit;

        if (isCurrentUserAdminOrCreator && seniorStatusChanged) {
            console.log(`[CourierProfileDialog] Обновляем статус старшего на ${isSenior}...`);
             try {
                await dispatch(updateSeniorityStatus({
                    groupTelegramId: chatId, 
                    userTelegramId: String(userId), // Убедимся, что передаем строку, если API ожидает строку
                    isSenior: isSenior
                })).unwrap();

                dispatch(addNotification({ type: NotificationTypes.SUCCESS, message: 'Статус старшего курьера обновлен' }));
                // Обновляем initial значение после успешного сохранения
                setInitialIsSeniorForSubmit(isSenior);
            } catch (error: any) {
                console.error('Ошибка обновления статуса старшего:', error);
                 // Добавляем ошибку, если она еще не установлена
                setLocalError(prev => prev ? `${prev}\n${error.message || 'Не удалось обновить статус старшего.'}` : (error.message || 'Не удалось обновить статус старшего.'));
                closeDialog = false; // Не закрываем диалог при ошибке
            }
        }

        // Закрываем диалог только если все операции прошли успешно
        if (closeDialog && !localError) {
            handleClose();
        }
    };

    const handleSeniorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setIsSenior(e.target.checked);
    };

    if (!isOpen && !isClosing) {
        return null;
    }

    const canEdit = isCurrentUserProfile && !!onSave;
    const showSeniorCheckbox = canEdit && isCurrentUserAdminOrCreator;

    return (
        <DialogOverlay $isOpen={isOpen} $isClosing={isClosing} onClick={handleClose}>
            <DialogContent $isClosing={isClosing} onClick={(e) => e.stopPropagation()}>
                <CloseButton onClick={handleClose}>&times;</CloseButton>
                <Header>
                    <ProfileImage $url={getPhotoUrl(displayData)} />
                    <Title>{`${getFirstName(displayData) || 'Имя'} ${getLastName(displayData) || 'Фамилия'}`}</Title>
                </Header>

                <Form onSubmit={handleSubmit}>
                    <InputGroup>
                        <Label htmlFor="firstName">Имя</Label>
                        <Input
                            id="firstName"
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="Введите имя"
                            disabled={!canEdit}
                        />
                    </InputGroup>
                    <InputGroup>
                        <Label htmlFor="lastName">Фамилия</Label>
                        <Input
                            id="lastName"
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Введите фамилию"
                            disabled={!canEdit}
                        />
                    </InputGroup>

                    {showSeniorCheckbox && (
                        <CheckboxGroup>
                            <CheckboxLabel>
                                <Checkbox
                                    type="checkbox"
                                    checked={isSenior}
                                    onChange={handleSeniorChange}
                                    disabled={!canEdit}
                                />
                                Старший курьер
                            </CheckboxLabel>
                        </CheckboxGroup>
                    )}
                    {(!showSeniorCheckbox && getIsSenior(displayData)) && (
                         <p style={{ fontSize: '0.9rem', color: 'var(--primary-color)', marginTop: '10px' }}>⭐ Старший курьер</p>
                    )}

                    {(error || localError) && <ErrorMessage>{error || localError}</ErrorMessage>}
                    
                    {canEdit && (
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Сохранение...' : 'Сохранить'}
                        </Button>
                    )}
                     {!canEdit && (
                         <Button type="button" onClick={handleClose} style={{ background: 'var(--button-secondary-bg)' }}>
                             Закрыть
                         </Button>
                     )}
                </Form>
            </DialogContent>
        </DialogOverlay>
    );
};

export default CourierProfileDialog; 
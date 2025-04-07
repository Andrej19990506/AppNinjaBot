import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { useAppSelector } from '../../store/hooks';
import defaultAvatar from '../../assets/images/Ninja.jpg';

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
    onSave?: (data: { firstName: string; lastName: string; isSeniorCourier?: boolean; seniorPassword?: string; }) => void; // Делаем onSave опциональным
    profileData?: ShiftSlotLocal | null; // Добавляем проп для данных курьера
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

const PasswordNoteText = styled.p`
    color: var(--text-secondary);
    font-size: 0.8rem;
    margin: 4px 0;
    font-style: italic;
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
}) => {
    const currentUser = useAppSelector(state => state.user.user);
    const loading = useAppSelector(state => state.user.loading);
    const error = useAppSelector(state => state.user.error);

    // Определяем, показываем ли мы профиль текущего пользователя
    const isCurrentUserProfile = !profileData || (currentUser?.id === profileData?.userId);

    // Используем данные из profileData или currentUser
    const displayData = profileData || currentUser;

    // ---- Нормализация данных ----
    const getFirstName = (data: any): string => data?.firstName ?? data?.first_name ?? '';
    const getLastName = (data: any): string => data?.lastName ?? data?.last_name ?? '';
    const getIsSenior = (data: any): boolean => !!(data && (data.isSeniorCourier || data.is_senior_courier));
    const getPhotoUrl = (data: any): string | undefined => data?.photo_url || undefined;
    // ---------------------------

    // Состояния для полей формы, инициализируем из displayData с нормализацией
    const [firstName, setFirstName] = useState(getFirstName(displayData));
    const [lastName, setLastName] = useState(getLastName(displayData));
    const [isSenior, setIsSenior] = useState(getIsSenior(displayData));
    const [seniorPassword, setSeniorPassword] = useState('');
    const [showPasswordInput, setShowPasswordInput] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const [isClosing, setIsClosing] = useState(false);

    // Обновляем состояния при изменении currentUser или profileData
    useEffect(() => {
        const dataToDisplay = profileData || currentUser;
        setFirstName(getFirstName(dataToDisplay));
        setLastName(getLastName(dataToDisplay));
        setIsSenior(getIsSenior(dataToDisplay));
        // Сбрасываем пароль и ошибку при смене профиля
        setSeniorPassword('');
        setShowPasswordInput(false);
        setLocalError(null);
    }, [currentUser, profileData]);

    // Обработчик закрытия
    const handleClose = () => {
        if (isClosing) return;
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setIsClosing(false); // Сбрасываем флаг после завершения анимации
        }, 300); // Длительность анимации
    };

    // Обработчик отправки формы (только если onSave передан и это профиль текущего пользователя)
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);

        if (!isCurrentUserProfile || !onSave) return; // Не сохраняем чужой профиль или если нет onSave

        if (isSenior && !currentUser?.is_senior_courier && !seniorPassword) {
            setLocalError('Введите пароль старшего курьера для подтверждения.');
            setShowPasswordInput(true);
            return;
        }

        // Вызываем onSave с данными формы
        onSave({ 
            firstName, 
            lastName, 
            isSeniorCourier: isSenior, 
            seniorPassword: isSenior ? seniorPassword : undefined 
        });
        
        // Закрываем диалог после успешного сохранения (если нужно)
        // handleClose();
    };

    // Обработчик изменения чекбокса старшего курьера
    const handleSeniorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setIsSenior(checked);
        // Показываем поле пароля только если делаем себя старшим (изначально не были)
        const currentIsSenior = getIsSenior(currentUser); // Получаем актуальный статус текущего пользователя
        if (checked && !currentIsSenior) {
            setShowPasswordInput(true);
        } else {
            setShowPasswordInput(false);
            setSeniorPassword(''); // Сбрасываем пароль, если убираем галку или уже старший
        }
    };

    if (!isOpen && !isClosing) {
        return null;
    }

    const canEdit = isCurrentUserProfile && !!onSave; // Редактировать можно только свой профиль и если есть onSave

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

                    {/* Показываем чекбокс старшего только если можно редактировать */}
                    {canEdit && (
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
                    {/* Показываем статус старшего текстом, если нельзя редактировать */}
                    {!canEdit && getIsSenior(displayData) && (
                         <p style={{ fontSize: '0.9rem', color: 'var(--primary-color)', marginTop: '10px' }}>⭐ Старший курьер</p>
                    )}

                    {/* Поле для пароля старшего курьера */}
                    {canEdit && showPasswordInput && (
                        <InputGroup style={{ marginTop: '10px' }}>
                            <Label htmlFor="seniorPassword">Пароль старшего курьера</Label>
                            <Input
                                id="seniorPassword"
                                type="password"
                                value={seniorPassword}
                                onChange={(e) => setSeniorPassword(e.target.value)}
                                placeholder="Введите пароль для подтверждения"
                                disabled={!canEdit}
                            />
                             <PasswordNoteText>
                                 Требуется только при первом назначении статуса старшего.
                             </PasswordNoteText>
                        </InputGroup>
                    )}

                    {(error || localError) && <ErrorMessage>{error || localError}</ErrorMessage>}
                    
                    {/* Показываем кнопку сохранения только если можно редактировать */}
                    {canEdit && (
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Сохранение...' : 'Сохранить'}
                        </Button>
                    )}
                     {/* Показываем кнопку "Закрыть", если нельзя редактировать */} 
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
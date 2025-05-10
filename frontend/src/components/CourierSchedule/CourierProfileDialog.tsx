import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { updateSeniorCourierStatus } from '../../store/slices/userSlice';
import defaultAvatar from '../../assets/images/Ninja.jpg';

interface CourierProfileDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { firstName: string; lastName: string; isSeniorCourier?: boolean; seniorPassword?: string; }) => void;
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

// Анимация для галочки
const checkmarkAnimation = keyframes`
    0% {
        stroke-dashoffset: 100;
    }
    100% {
        stroke-dashoffset: 0;
    }
`;

const bounceAnimation = keyframes`
    0%, 20%, 50%, 80%, 100% {
        transform: translateY(0);
    }
    40% {
        transform: translateY(-30px);
    }
    60% {
        transform: translateY(-15px);
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

const Subtitle = styled.p`
    color: var(--text-secondary);
    font-size: 1rem;
    margin: 0;
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

const SuccessContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    text-align: center;
`;

const CheckmarkCircle = styled.div`
    width: 100px;
    height: 100px;
    position: relative;
    margin-bottom: 24px;
    animation: ${bounceAnimation} 1s ease;
`;

const Checkmark = styled.svg`
    width: 100%;
    height: 100%;
    stroke: var(--success-color);
    stroke-width: 4;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 100;
    stroke-dashoffset: 100;
    animation: ${checkmarkAnimation} 1s ease forwards;
    fill: none;
`;

const SuccessMessage = styled.div`
    margin-bottom: 24px;
`;

const SuccessText = styled.h3`
    color: var(--text-color);
    font-size: 1.5rem;
    margin: 0 0 8px 0;
`;

const CourierProfileDialog: React.FC<CourierProfileDialogProps> = ({
    isOpen,
    onClose,
    onSave,
}) => {
    const user = useAppSelector((state) => state.user.user);
    const dispatch = useAppDispatch();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [isSeniorCourier, setIsSeniorCourier] = useState(false);
    const [seniorPassword, setSeniorPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isClosing, setIsClosing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [passwordValid, setPasswordValid] = useState(true);

    useEffect(() => {
        if (isOpen) {
            setIsClosing(false);
            setIsSuccess(false);
            setFirstName(user?.first_name || '');
            setLastName(user?.last_name || '');
            setIsSeniorCourier(user?.isSeniorCourier || false);
            setSeniorPassword('');
            setError(null);
            setPasswordValid(true);
        }
    }, [isOpen, user]);

    // Валидация пароля старшего курьера
    useEffect(() => {
        if (isSeniorCourier) {
            // Минимальная длина 6 символов
            setPasswordValid(seniorPassword.length >= 6);
        } else {
            setPasswordValid(true);
        }
    }, [seniorPassword, isSeniorCourier]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setIsClosing(false);
            setIsSuccess(false);
        }, 300);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedFirstName = firstName.trim();
        const trimmedLastName = lastName.trim();

        if (!trimmedFirstName || !trimmedLastName) {
            setError('Пожалуйста, заполните оба поля');
            return;
        }

        if (isSeniorCourier && !seniorPassword) {
            setError('Для старшего курьера необходимо указать пароль');
            return;
        }

        if (isSeniorCourier && !passwordValid) {
            setError('Пароль должен содержать минимум 6 символов');
            return;
        }

        try {
            const data = {
                firstName: trimmedFirstName,
                lastName: trimmedLastName
            };

            // Добавляем данные старшего курьера только если включен чекбокс
            if (isSeniorCourier) {
                Object.assign(data, {
                    isSeniorCourier: true,
                    seniorPassword: seniorPassword
                });
            }

            // Обновляем статус старшего курьера в Redux
            dispatch(updateSeniorCourierStatus(isSeniorCourier));
            console.log('🌟 Обновлен статус старшего курьера в профиле:', isSeniorCourier);

            await onSave(data);
            setIsSuccess(true);
        } catch (error) {
            if (error instanceof Error) {
                setError(error.message);
            } else {
                setError('Ошибка при сохранении данных');
            }
        }
    };

    if (!isOpen) return null;

    return (
        <DialogOverlay $isOpen={isOpen} $isClosing={isClosing}>
            <DialogContent $isClosing={isClosing}>
                {!isSuccess ? (
                    <>
                        <Header>
                            <Title>Профиль курьера</Title>
                            <Subtitle>Пожалуйста, заполните ваши данные</Subtitle>
                        </Header>
                        <ProfileImage $url={user?.photo_url || undefined} />
                        {error && <ErrorMessage>{error}</ErrorMessage>}
                        <Form onSubmit={handleSubmit}>
                            <InputGroup>
                                <Label htmlFor="firstName">Имя</Label>
                                <Input
                                    id="firstName"
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    placeholder="Введите ваше имя"
                                />
                            </InputGroup>
                            <InputGroup>
                                <Label htmlFor="lastName">Фамилия</Label>
                                <Input
                                    id="lastName"
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    placeholder="Введите вашу фамилию"
                                />
                            </InputGroup>
                            
                            <CheckboxGroup>
                                <CheckboxLabel>
                                    <Checkbox
                                        type="checkbox"
                                        checked={isSeniorCourier}
                                        onChange={(e) => setIsSeniorCourier(e.target.checked)}
                                    />
                                    Старший курьер
                                </CheckboxLabel>
                            </CheckboxGroup>

                            {isSeniorCourier && (
                                <InputGroup>
                                    <Label htmlFor="seniorPassword">Пароль старшего курьера</Label>
                                    <Input
                                        id="seniorPassword"
                                        type="password"
                                        value={seniorPassword}
                                        onChange={(e) => setSeniorPassword(e.target.value)}
                                        placeholder="Введите пароль"
                                        style={{
                                            borderColor: passwordValid ? '' : 'var(--error-color)'
                                        }}
                                    />
                                    <PasswordNoteText>
                                        Пароль должен содержать минимум 6 символов
                                    </PasswordNoteText>
                                </InputGroup>
                            )}
                            
                            <Button type="submit">Сохранить</Button>
                        </Form>
                    </>
                ) : (
                    <SuccessContainer>
                        <CheckmarkCircle>
                            <Checkmark viewBox="0 0 52 52">
                                <circle cx="26" cy="26" r="23" />
                                <path d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                            </Checkmark>
                        </CheckmarkCircle>
                        <SuccessMessage>
                            <SuccessText>Спасибо!</SuccessText>
                            <Subtitle>Ваши данные успешно сохранены</Subtitle>
                        </SuccessMessage>
                        <Button onClick={handleClose}>OK</Button>
                    </SuccessContainer>
                )}
            </DialogContent>
        </DialogOverlay>
    );
};

export default CourierProfileDialog; 
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import CloseIcon from '@mui/icons-material/Close';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import styled from 'styled-components';
import { WriteOffApi } from '@/features/WriteOff/services/writeOffApi';

interface ExpiryDateModalProps {
    isOpen: boolean;
    onClose: () => void;
    productName: string;
    groupId: string;
    onSuccess: () => void;
}

// Styled Components
const Overlay = styled.div`
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
`;

const Modal = styled.div`
  background: white;
  border-radius: 12px;
  padding: 0;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
`;

// Motion компоненты
const MotionOverlay = motion(Overlay);
const MotionModal = motion(Modal);

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
`;

const TitleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const TitleIcon = styled(AccessTimeIcon)`
  color: #3b82f6;
  font-size: 24px;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  color: #6b7280;
  transition: all 0.2s;
  
  &:hover {
    background-color: #f3f4f6;
    color: #374151;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Content = styled.div`
  padding: 24px;
`;

const ProductInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
`;

const ProductLabel = styled.span`
  font-weight: 500;
  color: #64748b;
`;

const ProductName = styled.span`
  font-weight: 600;
  color: #1e293b;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  font-weight: 500;
  color: #374151;
  font-size: 14px;
`;

const Input = styled.input`
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;
  
  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  &:disabled {
    background-color: #f9fafb;
    cursor: not-allowed;
  }
`;

const HelpText = styled.div`
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
`;

const ErrorMessage = styled.div`
  padding: 12px 16px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  font-size: 14px;
`;

const Actions = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 8px;
`;

const Button = styled.button`
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const CancelButton = styled(Button)`
  background: #f3f4f6;
  color: #374151;
  
  &:hover:not(:disabled) {
    background: #e5e7eb;
  }
`;

const SubmitButton = styled(Button)`
  background: #3b82f6;
  color: white;
  
  &:hover:not(:disabled) {
    background: #2563eb;
  }
`;

const ExpiryDateModal: React.FC<ExpiryDateModalProps> = ({
    isOpen,
    onClose,
    productName,
    groupId,
    onSuccess
}) => {
    const [expiryDate, setExpiryDate] = useState('');
    const [warningHours, setWarningHours] = useState(4);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!expiryDate) {
            setError('Пожалуйста, выберите дату истечения срока годности');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Конвертируем часы в дни для API
            const warningDays = Math.round(warningHours / 24 * 100) / 100; // Округляем до 2 знаков после запятой
            
            const response = await WriteOffApi.updateProductExpiry(
                groupId,
                productName,
                expiryDate,
                warningDays
            );

            if (response.success) {
                console.log('✅ [ExpiryDateModal] Срок годности успешно обновлен');
                onSuccess();
                onClose();
            } else {
                const errorMessage = response.error || 'Не удалось обновить срок годности';
                setError(errorMessage);
            }
        } catch (err: unknown) {
            console.error('❌ [ExpiryDateModal] Ошибка обновления срока годности:', err);
            const errorMessage = err instanceof Error ? err.message : 'Ошибка обновления срока годности';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (!isLoading) {
            setExpiryDate('');
            setWarningHours(4);
            setError(null);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <MotionOverlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
        >
            <MotionModal
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={e => e.stopPropagation()}
            >
                <Header>
                    <TitleContainer>
                        <TitleIcon />
                        <Title>Установить срок годности</Title>
                    </TitleContainer>
                    <CloseButton onClick={handleClose} disabled={isLoading}>
                        <CloseIcon />
                    </CloseButton>
                </Header>

                <Content>
                    <ProductInfo>
                        <ProductLabel>Товар:</ProductLabel>
                        <ProductName>{productName}</ProductName>
                    </ProductInfo>

                    <Form onSubmit={handleSubmit}>
                        <FormGroup>
                            <Label htmlFor="expiryDate">
                                Дата истечения срока годности:
                            </Label>
                            <Input
                                id="expiryDate"
                                type="datetime-local"
                                value={expiryDate}
                                onChange={(e) => setExpiryDate(e.target.value)}
                                required
                            />
                        </FormGroup>

                        <FormGroup>
                            <Label htmlFor="warningHours">
                                Предупреждение за (часов):
                            </Label>
                            <Input
                                id="warningHours"
                                type="number"
                                min="1"
                                max="168" // 7 дней
                                value={warningHours}
                                onChange={(e) => setWarningHours(Number(e.target.value))}
                                required
                            />
                            <HelpText>
                                Например: 4 часа = предупреждение за 4 часа до истечения
                            </HelpText>
                        </FormGroup>

                        {error && (
                            <ErrorMessage>
                                <span>{error}</span>
                            </ErrorMessage>
                        )}

                        <Actions>
                            <CancelButton
                                type="button"
                                onClick={handleClose}
                                disabled={isLoading}
                            >
                                Отмена
                            </CancelButton>
                            <SubmitButton
                                type="submit"
                                disabled={isLoading || !expiryDate}
                            >
                                {isLoading ? 'Сохранение...' : 'Сохранить'}
                            </SubmitButton>
                        </Actions>
                    </Form>
                </Content>
            </MotionModal>
        </MotionOverlay>
    );
};

export default ExpiryDateModal;

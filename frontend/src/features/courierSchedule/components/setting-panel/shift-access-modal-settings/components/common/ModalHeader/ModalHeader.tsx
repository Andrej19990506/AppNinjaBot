import React from 'react';
import {
    ModalHeader as Header,
    ModalTitle,
    HeaderIcon,
    CloseButton
} from '../../ShiftAccessModal.styles';
import { CalendarIcon } from '../icons';

interface ModalHeaderProps {
    title: string;
    onClose: () => void;
    showCloseButton?: boolean;
}

const ModalHeader: React.FC<ModalHeaderProps> = ({ 
    title, 
    onClose,
    showCloseButton = true
}) => (
    <Header>
        <ModalTitle>
            <HeaderIcon>
                <CalendarIcon size={28} />
            </HeaderIcon>
            {title}
        </ModalTitle>
        {showCloseButton && (
            <CloseButton 
                onClick={onClose}
                aria-label="Закрыть"
            />
        )}
    </Header>
);

export default React.memo(ModalHeader); 
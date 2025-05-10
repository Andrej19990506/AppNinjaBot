import React from 'react';
import { LoadingContainer, Spinner, LoadingText } from './styles';

const LoadingOverlay: React.FC = () => {
    return (
        <LoadingContainer>
            <Spinner />
            <LoadingText>Загрузка календаря...</LoadingText>
        </LoadingContainer>
    );
};

export default LoadingOverlay; 
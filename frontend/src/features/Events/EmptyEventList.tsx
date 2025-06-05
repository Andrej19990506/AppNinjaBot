import React from 'react';
import {
    EmptyContainer,
    Content,
    IconWrapper,
    IconSvg,
    Text,
    MotionCircle,
    MotionPath
} from './EmptyEventList.styles';

// Определяем типы пропсов
interface EmptyEventListProps {
    onIconClick: () => void;
}

const EmptyEventList: React.FC<EmptyEventListProps> = ({ onIconClick }) => {
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.5 } }
    };

    const contentVariants = {
        hidden: { scale: 0.8, y: 20 },
        visible: { scale: 1, y: 0, transition: { delay: 0.2 } }
    };

    const iconWrapperVariants = {
        hover: { scale: 1.1 },
        tap: { scale: 0.95 }
    };

    const circleVariants = {
        hidden: { pathLength: 0 },
        visible: { pathLength: 1, transition: { duration: 1 } }
    };

    const pathVariants = {
        hidden: { pathLength: 0 },
        visible: { pathLength: 1, transition: { duration: 0.5, delay: 0.5 } }
    };

    const textVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { delay: 0.4 } }
    };

    return (
        <EmptyContainer
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            <Content variants={contentVariants}>
                <IconWrapper
                    variants={iconWrapperVariants}
                    whileTap="tap"
                    onClick={onIconClick}
                >
                    <IconSvg
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <MotionCircle
                            variants={circleVariants}
                            cx="12"
                            cy="12"
                            r="10"
                        />
                        <MotionPath
                            variants={pathVariants}
                            d="M12 8v8M8 12h8"
                        />
                    </IconSvg>
                </IconWrapper>
                <Text variants={textVariants}>
                    У вас пока нет событий.<br />
                    Нажмите, чтобы создать первое!
                </Text>
            </Content>
        </EmptyContainer>
    );
};

export default EmptyEventList; 
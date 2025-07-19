import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NavigationIcon from '@mui/icons-material/Navigation';

const PageContainer = styled.div`
    width: 100%;
    height: 100vh;
    background: var(--background-color);
    overflow-y: auto;
    position: relative;
`;

const BackButton = styled.button<{ $hiddenOnScroll: boolean }>`
    position: fixed;
    bottom: 20px; /* Ниже кнопки скролла */
    left: 50%;
    transform: translateX(-50%) ${props => props.$hiddenOnScroll ? 'translateY(80px)' : 'translateY(0)'};
    width: 60px;
    height: 60px;
    background: var(--gradient-primary);
    border: none;
    border-radius: 50%;
    color: white;
    cursor: pointer;
    box-shadow: var(--shadow-md);
    z-index: 999; /* Ниже чем кнопка скролла */
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: ${props => props.$hiddenOnScroll ? 0.3 : 1};

    &:hover {
        transform: translateX(-50%) translateY(-3px) scale(1.05);
        box-shadow: var(--shadow-lg);
    }

    &:active {
        transform: translateX(-50%) translateY(0) scale(1.02);
    }

    @media (max-width: 768px) {
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%) ${props => props.$hiddenOnScroll ? 'translateY(70px)' : 'translateY(0)'};
        width: 50px;
        height: 50px;

        &:hover {
            transform: translateX(-50%) translateY(-3px) scale(1.05);
        }

        &:active {
            transform: translateX(-50%) translateY(0) scale(1.02);
        }
    }
`;

const Container = styled.div`
    width: 100%;
    margin: 0;
    background: transparent;
    overflow: hidden;
`;

const Header = styled.div`
    background: var(--gradient-primary);
    color: white;
    padding: calc(80px + 40px) 20px 40px 20px; /* Отступ для Telegram + обычный отступ */
    text-align: center;
    position: relative;
    overflow: hidden;
    width: 100%;
    max-width: 1920px;
    margin: 0 auto;

    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="2" fill="white" opacity="0.1"/><circle cx="20" cy="20" r="1" fill="white" opacity="0.1"/><circle cx="80" cy="30" r="1.5" fill="white" opacity="0.1"/></svg>');
        animation: float 6s ease-in-out infinite;
    }

    @keyframes float {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        50% { transform: translateY(-10px) rotate(180deg); }
    }



    @media (max-width: 768px) {
        padding: calc(80px + 30px) 20px 30px 20px;
    }
`;

const Logo = styled.div`
    width: 80px;
    height: 80px;
    border-radius: 50%;
    margin: 0 auto 20px;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 1;
    transition: all var(--transition-normal);

    &:hover {
        transform: scale(1.05);
    }
`;

const MainTitle = styled.h1`
    font-size: 2.5rem;
    margin-bottom: 10px;
    font-weight: 700;
    position: relative;
    z-index: 1;
    color: white;

    @media (max-width: 768px) {
        font-size: 2rem;
    }
`;

const Subtitle = styled.p`
    font-size: 1.2rem;
    opacity: 0.9;
    position: relative;
    z-index: 1;
    color: white;
`;

const NavigationBar = styled.nav`
    background: var(--card-background);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    position: sticky;
    top: 0;
    z-index: 100;
    padding: 15px 0;
    margin-bottom: 0;
`;

const NavContainer = styled.div`
    max-width: 900px;
    margin: 0 auto;
    padding: 0 20px;

    @media (max-width: 768px) {
        padding: 0 15px;
    }
`;

const NavList = styled.ul`
    display: flex;
    list-style: none;
    margin: 0;
    padding: 0;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;

    @media (max-width: 768px) {
        gap: 8px;
        flex-direction: column;
    }
`;

const NavItem = styled.li`
    flex: 1;
    min-width: 160px;
    max-width: 200px;

    @media (max-width: 768px) {
        flex: none;
        min-width: 100%;
        max-width: 100%;
    }
`;

const NavLink = styled.button<{ $active?: boolean }>`
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 14px 16px;
    background: ${props => props.$active 
        ? 'var(--gradient-primary)' 
        : 'var(--card-background)'};
    border: 1px solid ${props => props.$active ? 'var(--primary-color)' : 'var(--border-color)'};
    border-radius: var(--radius);
    text-decoration: none;
    color: ${props => props.$active ? 'white' : 'var(--text-color)'};
    font-weight: 600;
    font-size: 1rem;
    line-height: 1.3;
    text-align: center;
    transition: all var(--transition-normal);
    position: relative;
    overflow: hidden;
    cursor: pointer;
    box-shadow: ${props => props.$active ? 'var(--shadow-md)' : 'none'};
    width: 100%;
    min-height: 70px;
    word-wrap: break-word;
    hyphens: auto;

    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 95, 31, 0.2), transparent);
        transition: left 0.5s;
    }

    &:hover {
        background: ${props => props.$active ? 'var(--gradient-primary)' : 'var(--hover-overlay)'};
        color: ${props => props.$active ? 'white' : 'var(--primary-color)'};
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
        border-color: var(--primary-color);
    }

    &:hover::before {
        left: 100%;
    }

    &:active {
        transform: translateY(0);
    }

    @media (max-width: 768px) {
        padding: 16px 20px;
        font-size: 1.1rem;
        min-height: 60px;
    }
`;

const ContentWrapper = styled.div`
    width: 100%;
    background: var(--card-background);
    margin: 0 auto;

    @media (min-width: 769px) {
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        margin: 20px auto;
        max-width: 1200px;
    }
`;

const Content = styled.div`
    padding: 20px;
    max-width: 900px;
    margin: 0 auto;
    width: 100%;

    @media (min-width: 769px) {
        padding: 40px 30px;
    }
`;

const Section = styled.div`
    margin-bottom: 40px;
`;

const SectionTitle = styled.h2`
    font-size: 1.8rem;
    color: var(--primary-color);
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
`;

const FeatureCard = styled.div`
    background: var(--card-background);
    border: 1px solid var(--border-color);
    border-radius: var(--radius);
    padding: 25px;
    margin-bottom: 20px;
    transition: all var(--transition-normal);
    position: relative;
    overflow: hidden;
    box-shadow: var(--shadow-sm);

    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 4px;
        height: 100%;
        background: var(--gradient-primary);
    }

    &:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
        border-color: var(--primary-color);
    }
`;

const FeatureTitle = styled.div`
    font-size: 1.4rem;
    color: var(--primary-color);
    margin-bottom: 15px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
`;

const FeatureDescription = styled.p`
    color: var(--text-secondary);
    margin-bottom: 15px;
`;

const StepsList = styled.ul`
    list-style: none;
    padding: 0;
`;

const StepItem = styled.li`
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 12px;
    padding: 10px;
    background: var(--card-background);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    transition: all var(--transition-normal);

    &:hover {
        background: var(--hover-overlay);
        border-color: var(--primary-color);
        transform: translateX(5px);
    }
`;

const StepEmoji = styled.span`
    font-size: 1.2rem;
    min-width: 24px;
`;

const StepText = styled.span`
    flex: 1;
    color: var(--text-color);
`;

const StepSubtitle = styled.div`
    font-weight: 600;
    color: var(--primary-color);
    margin-bottom: 5px;
`;

const HighlightBox = styled.div`
    background: var(--gradient-primary);
    color: white;
    padding: 20px;
    border-radius: var(--radius);
    margin: 20px 0;
    text-align: center;
    font-weight: 600;
    box-shadow: var(--shadow-md);
`;

const BenefitsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin-top: 20px;

    @media (max-width: 768px) {
        grid-template-columns: 1fr;
    }
`;

const BenefitCard = styled.div`
    background: var(--card-background);
    border: 1px solid var(--border-color);
    border-radius: var(--radius);
    padding: 20px;
    box-shadow: var(--shadow-sm);
    text-align: center;
    transition: all var(--transition-normal);

    &:hover {
        transform: translateY(-5px);
        box-shadow: var(--shadow-lg);
        border-color: var(--primary-color);
    }
`;

const BenefitIcon = styled.div`
    font-size: 2.5rem;
    margin-bottom: 15px;
`;

const BenefitTitle = styled.h4`
    font-size: 1.2rem;
    color: var(--primary-color);
    margin-bottom: 10px;
    font-weight: 600;
`;

const BenefitText = styled.p`
    color: var(--text-secondary);
    font-size: 0.9rem;
`;

// Стили для видео секции
const VideoSection = styled.div`
    margin: 40px 0;
`;

const VideoContainer = styled.div`
    position: relative;
    background: var(--card-background);
    border-radius: var(--radius-lg);
    padding: 30px;
    text-align: center;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-color);
    overflow: hidden;

    &::before {
        content: '';
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background: linear-gradient(45deg, transparent, rgba(255, 95, 31, 0.1), transparent);
        animation: shimmer 3s infinite;
        z-index: 1;
    }

    @keyframes shimmer {
        0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
        100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
    }

    @media (max-width: 768px) {
        padding: 20px;
        margin: 20px 0;
    }
`;

const VideoTitle = styled.h2`
    font-size: 1.8rem;
    color: var(--primary-color);
    margin-bottom: 15px;
    font-weight: 700;
    position: relative;
    z-index: 2;

    @media (max-width: 768px) {
        font-size: 1.5rem;
    }
`;

const VideoDescription = styled.p`
    color: var(--text-secondary);
    margin-bottom: 25px;
    font-size: 1.1rem;
    position: relative;
    z-index: 2;
`;

const VideoWrapper = styled.div`
    position: relative;
    border-radius: var(--radius);
    overflow: hidden;
    box-shadow: var(--shadow-md);
    background: #000;
    z-index: 2;
`;



const VideoPlayer = styled.video`
    width: 100%;
    height: auto;
    min-height: 400px;
    border-radius: var(--radius);
    background: #000;

    @media (max-width: 768px) {
        min-height: 250px;
    }
`;

const PlayButtonOverlay = styled.div<{ $visible: boolean }>`
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 80px;
    height: 80px;
    background: var(--gradient-primary);
    border-radius: 50%;
    display: ${props => props.$visible ? 'flex' : 'none'};
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all var(--transition-normal);
    z-index: 3;
    box-shadow: var(--shadow-lg);
    border: 3px solid rgba(255, 255, 255, 0.3);
    overflow: hidden;

    &::after {
        content: '';
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.2), transparent);
        animation: shine 3s infinite;
    }

    @keyframes shine {
        0% { transform: rotate(45deg) translateX(-100%); }
        100% { transform: rotate(45deg) translateX(100%); }
    }

    &:hover {
        transform: translate(-50%, -50%) scale(1.15);
        box-shadow: 0 20px 40px rgba(255, 95, 31, 0.5);
        border-color: rgba(255, 255, 255, 0.6);
    }

    &:active {
        transform: translate(-50%, -50%) scale(1.05);
    }

    &::before {
        content: '';
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        animation: pulse 2s infinite;
    }

    @keyframes pulse {
        0% {
            transform: scale(1);
            opacity: 1;
        }
        100% {
            transform: scale(1.4);
            opacity: 0;
        }
    }

    @media (max-width: 768px) {
        width: 60px;
        height: 60px;
    }
`;

const PlayIcon = styled.svg`
    width: 32px;
    height: 32px;
    fill: white;
    margin-left: 4px;
    position: relative;
    z-index: 1;

    @media (max-width: 768px) {
        width: 24px;
        height: 24px;
        margin-left: 3px;
    }
`;

const VideoControlsInfo = styled.p`
    margin-top: 15px;
    font-size: 0.9rem;
    color: var(--text-secondary);
    position: relative;
    z-index: 2;
`;

const VideoFeatures = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
    margin-top: 25px;
    position: relative;
    z-index: 2;

    @media (max-width: 768px) {
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
    }
`;

const VideoFeature = styled.div`
    background: var(--card-background);
    border: 1px solid var(--border-color);
    padding: 15px;
    border-radius: var(--radius);
    text-align: center;
    transition: all var(--transition-normal);
    box-shadow: var(--shadow-sm);

    &:hover {
        background: var(--hover-overlay);
        border-color: var(--primary-color);
        transform: translateY(-3px);
        box-shadow: var(--shadow-md);
    }

    @media (max-width: 768px) {
        padding: 10px;
    }
`;

const VideoFeatureIcon = styled.div`
    font-size: 1.5rem;
    margin-bottom: 8px;
    color: var(--primary-color);
`;

const VideoFeatureText = styled.div`
    font-size: 0.9rem;
    color: var(--text-secondary);
    font-weight: 500;
`;

const Footer = styled.div`
    background: var(--gradient-primary);
    color: white;
    padding: 30px 20px;
    text-align: center;
    font-size: 1.2rem;
    font-weight: 600;
    width: 100%;
    max-width: 1920px;
    margin: 0 auto;
`;

const VersionBadge = styled.span`
    display: inline-block;
    background: rgba(255, 255, 255, 0.2);
    padding: 5px 15px;
    border-radius: 20px;
    font-size: 0.9rem;
    margin-top: 10px;
`;

const ScrollToNavBtn = styled.button<{ $visible: boolean; $hiddenOnScroll: boolean }>`
    position: fixed;
    bottom: 90px; /* Выше кнопки "Назад" */
    left: 50%;
    transform: translateX(-50%) ${props => props.$hiddenOnScroll ? 'translateY(120px)' : 'translateY(0)'};
    width: 60px;
    height: 60px;
    background: var(--gradient-primary);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: var(--shadow-lg);
    border: 3px solid rgba(255, 255, 255, 0.3);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 1000;
    opacity: ${props => {
        if (!props.$visible) return 0;
        return props.$hiddenOnScroll ? 0.3 : 1;
    }};
    pointer-events: ${props => props.$visible ? 'all' : 'none'};
    border: none;
    color: white;

    &:hover {
        transform: translateX(-50%) translateY(-5px) scale(1.1);
        box-shadow: 0 20px 40px rgba(255, 95, 31, 0.4);
        border: 3px solid rgba(255, 255, 255, 0.6);
    }

    &:active {
        transform: translateX(-50%) translateY(-2px) scale(1.05);
    }

    &::before {
        content: '';
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        animation: pulse 2s infinite;
    }

    @keyframes pulse {
        0% {
            transform: scale(1);
            opacity: 1;
        }
        100% {
            transform: scale(1.4);
            opacity: 0;
        }
    }

    @media (max-width: 768px) {
        bottom: 80px; /* Выше кнопки "Назад" на мобильных */
        width: 50px;
        height: 50px;
    }
`;

const NavIcon = styled.svg`
    width: 24px;
    height: 24px;
    fill: white;
    position: relative;
    z-index: 1;

    @media (max-width: 768px) {
        width: 20px;
        height: 20px;
    }
`;

interface UpdatesPageProps {
    onBack: () => void;
}



const UpdatesPage: React.FC<UpdatesPageProps> = ({ onBack }) => {
    const [activeSection, setActiveSection] = useState('section-grant-access');
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const [isScrolling, setIsScrolling] = useState(false);
    const [playButtonVisible, setPlayButtonVisible] = useState(true);

    useEffect(() => {
        let scrollTimeout: NodeJS.Timeout;
        let isScrolling = false;

        const handleScroll = (event: Event) => {
            isScrolling = true;
            
            // Очищаем предыдущий таймер
            clearTimeout(scrollTimeout);

            // Найдем ВСЕ скроллируемые элементы для вычисления позиции
            const allElements = Array.from(document.querySelectorAll('*')) as HTMLElement[];
            const scrollableElements = allElements.filter(el => {
                const style = window.getComputedStyle(el);
                return (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollTop > 0;
            });

            // Найдем максимальный scrollTop из всех элементов
            let maxScrollTop = 0;
            scrollableElements.forEach(el => {
                if (el.scrollTop > maxScrollTop) {
                    maxScrollTop = el.scrollTop;
                }
            });

            // Проверяем стандартные источники
            const windowScrollY = window.scrollY;
            const documentScrollTop = document.documentElement.scrollTop;
            const bodyScrollTop = document.body.scrollTop;

            const scrollY = Math.max(windowScrollY, documentScrollTop, bodyScrollTop, maxScrollTop);
            
            // Логика показа кнопки как в оригинале
            const navigationBar = document.getElementById('navigation-bar') as HTMLElement;
            let shouldShow = false;
            if (navigationBar) {
                const navBottom = navigationBar.offsetTop + navigationBar.offsetHeight;
                shouldShow = scrollY > navBottom + 200; // Показываем через 200px после навигации
            } else {
                shouldShow = scrollY > 400; // Fallback
            }
            
            setShowScrollBtn(shouldShow);
            
            if (shouldShow) {
                // Скрываем кнопку при скролле
                setIsScrolling(isScrolling);
            } else {
                setIsScrolling(false);
            }
            
            // Устанавливаем новый таймер на 1 секунду
            scrollTimeout = setTimeout(() => {
                isScrolling = false;
                // Обновляем состояние кнопки через 1 секунду
                setIsScrolling(false);
            }, 1000);

            // Подсветка активного раздела
            const sections = ['section-grant-access', 'section-invite-employee', 'section-view-permissions', 'section-revoke-permissions', 'section-benefits', 'section-video'];
            const scrollPos = scrollY + 150;

            let currentActiveSection = sections[0];

            for (const sectionId of sections) {
                const section = document.getElementById(sectionId);
                if (section) {
                    const sectionTop = section.offsetTop;
                    
                    if (scrollPos >= sectionTop) {
                        currentActiveSection = sectionId;
                    }
                }
            }
            
            setActiveSection(currentActiveSection);
        };

        // Добавляем обработчики на все возможные элементы
        window.addEventListener('scroll', handleScroll);
        document.addEventListener('scroll', handleScroll);
        
        // Найдем все скроллируемые элементы и добавим обработчики
        const findAndAttachScrollListeners = () => {
            const allElements = Array.from(document.querySelectorAll('*')) as HTMLElement[];
            allElements.forEach(el => {
                const style = window.getComputedStyle(el);
                if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                    el.addEventListener('scroll', handleScroll);
                }
            });
        };

        // Ждем рендеринга и добавляем обработчики
        setTimeout(findAndAttachScrollListeners, 100);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            document.removeEventListener('scroll', handleScroll);
            clearTimeout(scrollTimeout);
        };
    }, []);

    const scrollToSection = (sectionId: string) => {
        const element = document.getElementById(sectionId);
        
        if (element) {
            const navBar = document.getElementById('navigation-bar') as HTMLElement;
            const navHeight = navBar ? navBar.offsetHeight : 80;
            const offsetTop = element.offsetTop - navHeight - 20;
            
            // Используем scrollIntoView для лучшей совместимости
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            
            // Дополнительная корректировка для учета навигации
            setTimeout(() => {
                window.scrollTo({
                    top: Math.max(0, offsetTop),
                    behavior: 'smooth'
                });
            }, 100);
            
            setActiveSection(sectionId);
        }
    };

    const scrollToNav = () => {
        // Скроллим в самое начало страницы - это понятнее для пользователя
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    const handleVideoPlay = () => {
        setPlayButtonVisible(false);
    };

    const handleVideoPause = () => {
        setPlayButtonVisible(true);
    };

    const handleVideoEnded = () => {
        setPlayButtonVisible(true);
    };

    const handlePlayButtonClick = () => {
        const video = document.getElementById('tutorial-video') as HTMLVideoElement;
        if (video) {
            video.play();
            setPlayButtonVisible(false);
        }
    };

    const handleFullscreenClick = () => {
        console.log('🔄 handleFullscreenClick вызван');
        
        const video = document.getElementById('tutorial-video') as HTMLVideoElement;
        if (!video) {
            console.error('❌ Видео элемент не найден');
            return;
        }

        // Проверяем, находимся ли мы в Telegram Mini App
        const telegramWebApp = (window as any).Telegram?.WebApp;
        if (telegramWebApp) {
            console.log('📱 Обнаружен Telegram WebApp API');
            console.log('🔍 Версия Bot API:', telegramWebApp.version);
            
            try {
                // Фиксируем ориентацию в ландшафтную для лучшего просмотра видео
                if (telegramWebApp.lockOrientation) {
                    telegramWebApp.lockOrientation('landscape');
                    console.log('📐 Ориентация зафиксирована в ландшафтную');
                }
                
                // Сначала запрашиваем полноэкранный режим для WebApp
                telegramWebApp.requestFullscreen();
                console.log('✅ Telegram.WebApp.requestFullscreen() вызван');
                
                // Добавляем обработчики событий полноэкранного режима
                telegramWebApp.onEvent('fullscreenChanged', () => {
                    console.log('📐 fullscreenChanged событие получено');
                    const isFullscreen = telegramWebApp.isExpanded;
                    console.log('🔍 isExpanded:', isFullscreen);
                    
                    if (isFullscreen) {
                        // Теперь можно запустить полноэкранный режим для видео
                        setTimeout(() => {
                            console.log('🎬 Запускаем полноэкранный режим для видео');
                            requestVideoFullscreen(video);
                        }, 200);
                    }
                });
                
                telegramWebApp.onEvent('fullscreenFailed', (error: any) => {
                    console.error('❌ fullscreenFailed событие:', error);
                    console.log('🔄 Пробуем fallback к обычному полноэкранному режиму');
                    requestVideoFullscreen(video);
                });
                
            } catch (error) {
                console.error('❌ Ошибка при вызове Telegram.WebApp.requestFullscreen():', error);
                // Fallback к обычному полноэкранному режиму
                requestVideoFullscreen(video);
            }
        } else {
            console.log('🌐 Обычный браузер - используем стандартный API');
            requestVideoFullscreen(video);
        }
    };

    const requestVideoFullscreen = (video: HTMLVideoElement) => {
        console.log('🎥 requestVideoFullscreen вызван для видео:', video);
        
        try {
            if (video.requestFullscreen) {
                console.log('✅ Используем requestFullscreen()');
                video.requestFullscreen();
            } else if ((video as any).webkitRequestFullscreen) {
                console.log('✅ Используем webkitRequestFullscreen()');
                (video as any).webkitRequestFullscreen();
            } else if ((video as any).msRequestFullscreen) {
                console.log('✅ Используем msRequestFullscreen()');
                (video as any).msRequestFullscreen();
            } else if ((video as any).mozRequestFullScreen) {
                console.log('✅ Используем mozRequestFullScreen()');
                (video as any).mozRequestFullScreen();
            } else {
                console.error('❌ Ни один метод полноэкранного режима не поддерживается');
            }
        } catch (error) {
            console.error('❌ Ошибка при запросе полноэкранного режима:', error);
        }
    };



    // Добавляем обработчик событий полноэкранного режима
    useEffect(() => {
        const handleFullscreenChange = () => {
            console.log('🎬 onFullscreenChange событие');
            const isFullscreen = !!(document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement || (document as any).msFullscreenElement);
            console.log('🔍 Видео в полноэкранном режиме:', isFullscreen);
            
            // Проверяем состояние Telegram WebApp
            const telegramWebApp = (window as any).Telegram?.WebApp;
            if (telegramWebApp) {
                console.log('📱 Telegram WebApp isExpanded:', telegramWebApp.isExpanded);
                console.log('📱 Telegram WebApp viewportHeight:', telegramWebApp.viewportHeight);
                console.log('📱 Telegram WebApp viewportStableHeight:', telegramWebApp.viewportStableHeight);
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);

        // Логируем информацию о Telegram WebApp при загрузке
        const telegramWebApp = (window as any).Telegram?.WebApp;
        if (telegramWebApp) {
            console.log('📱 Telegram WebApp обнаружен при загрузке');
            console.log('📱 Версия:', telegramWebApp.version);
            console.log('📱 isExpanded:', telegramWebApp.isExpanded);
            console.log('📱 viewportHeight:', telegramWebApp.viewportHeight);
            console.log('📱 Доступные методы:', Object.keys(telegramWebApp));
        } else {
            console.log('🌐 Telegram WebApp не обнаружен - обычный браузер');
        }

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
            document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
        };
    }, []);

    // Перехватываем клики по стандартной кнопке полноэкранного режима
    useEffect(() => {
        const video = document.getElementById('tutorial-video') as HTMLVideoElement;
        if (!video) return;

        const handleVideoClick = (e: Event) => {
            const target = e.target as HTMLElement;
            
            // Проверяем различные селекторы для кнопки полноэкранного режима
            const isFullscreenButton = 
                target.closest('[data-fullscreen-button]') ||
                target.closest('.vjs-fullscreen-control') ||
                target.closest('[aria-label*="fullscreen"]') ||
                target.closest('[title*="fullscreen"]') ||
                target.closest('button[data-fullscreen]') ||
                target.closest('[aria-label*="полноэкранный"]') ||
                target.closest('[title*="полноэкранный"]') ||
                target.closest('button[aria-label*="fullscreen"]') ||
                target.closest('button[title*="fullscreen"]');

            if (isFullscreenButton) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🎬 Перехвачен клик по стандартной кнопке полноэкранного режима');
                handleFullscreenClick();
                return false;
            }
        };

        // Добавляем обработчик на видео элемент
        video.addEventListener('click', handleVideoClick, true);
        
        // Также добавляем обработчик на весь контейнер видео
        const videoContainer = video.closest('.video-container') || video.parentElement;
        if (videoContainer) {
            videoContainer.addEventListener('click', handleVideoClick, true);
        }

        return () => {
            video.removeEventListener('click', handleVideoClick, true);
            if (videoContainer) {
                videoContainer.removeEventListener('click', handleVideoClick, true);
            }
        };
    }, []);



    return (
        <PageContainer data-testid="page-container">
            <BackButton 
                $hiddenOnScroll={isScrolling} 
                onClick={onBack} 
                aria-label="Назад к материалам"
            >
                <ArrowBackIcon />
            </BackButton>

            <Container>
                <Header>
                    <Logo>
                        <div style={{ 
                            fontSize: '60px', 
                            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
                            textShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}>
                            🔒
                        </div>
                    </Logo>
                    <MainTitle>Временный доступ для сотрудников</MainTitle>
                    <Subtitle>Управляйте правами доступа легко и безопасно</Subtitle>
                </Header>

                <NavigationBar id="navigation-bar">
                    <NavContainer>
                        <NavList>
                            <NavItem>
                                <NavLink 
                                    $active={activeSection === 'section-grant-access'}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        scrollToSection('section-grant-access');
                                    }}
                                >
                                    📋 Выдача доступа
                                </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLink 
                                    $active={activeSection === 'section-invite-employee'}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        scrollToSection('section-invite-employee');
                                    }}
                                >
                                    👤 Приглашение
                                </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLink 
                                    $active={activeSection === 'section-view-permissions'}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        scrollToSection('section-view-permissions');
                                    }}
                                >
                                    📊 Просмотр прав
                                </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLink 
                                    $active={activeSection === 'section-revoke-permissions'}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        scrollToSection('section-revoke-permissions');
                                    }}
                                >
                                    ❌ Отзыв прав
                                </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLink 
                                    $active={activeSection === 'section-benefits'}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        scrollToSection('section-benefits');
                                    }}
                                >
                                    🎯 Преимущества
                                </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLink 
                                    $active={activeSection === 'section-video'}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        scrollToSection('section-video');
                                    }}
                                >
                                    📹 Видео
                                </NavLink>
                            </NavItem>
                        </NavList>
                    </NavContainer>
                </NavigationBar>

                <ContentWrapper>
                    <Content>
                        <Section>
                            <SectionTitle>✨ Что добавлено</SectionTitle>
                            <FeatureCard>
                                <FeatureDescription>
                                    Добавлен новый функционал <strong>Временный доступ</strong> - теперь администраторы могут выдавать сотрудникам временные права на работу с <strong>инвентаризацией</strong> и <strong>списаниями</strong>.
                                </FeatureDescription>
                            </FeatureCard>
                        </Section>

                        <Section>
                            <SectionTitle>🎯 Как пользоваться</SectionTitle>
                            
                            <FeatureCard id="section-grant-access">
                                <FeatureTitle>📋 1. Выдача временного доступа</FeatureTitle>
                                
                                <StepSubtitle>🔍 Где найти:</StepSubtitle>
                                <StepsList>
                                    <StepItem>
                                        <StepEmoji>🏢</StepEmoji>
                                        <StepText>Откройте карточку выбора филиала</StepText>
                                    </StepItem>
                                    <StepItem>
                                        <StepEmoji>👥</StepEmoji>
                                        <StepText>Теперь там есть индикатор сотрудников, состоящих в рабочей группе</StepText>
                                    </StepItem>
                                    <StepItem>
                                        <StepEmoji>📱</StepEmoji>
                                        <StepText>Нажмите на список сотрудников</StepText>
                                    </StepItem>
                                </StepsList>

                                <StepSubtitle>⚡ Как выдать доступ:</StepSubtitle>
                                <StepsList>
                                    <StepItem>
                                        <StepEmoji>🔍</StepEmoji>
                                        <StepText>Найдите нужного сотрудника в списке</StepText>
                                    </StepItem>
                                    <StepItem>
                                        <StepEmoji>🎯</StepEmoji>
                                        <StepText>Нажмите кнопку <strong>"Открыть доступ"</strong> рядом с его именем</StepText>
                                    </StepItem>
                                    <StepItem>
                                        <StepEmoji>⏰</StepEmoji>
                                        <StepText>
                                            <strong>Выберите срок доступа:</strong>
                                            <ul style={{marginTop: '5px', marginLeft: '20px'}}>
                                                <li>1 час</li>
                                                <li>1 день</li>
                                                <li>1 неделя</li>
                                                <li>1 месяц</li>
                                            </ul>
                                        </StepText>
                                    </StepItem>
                                    <StepItem>
                                        <StepEmoji>🛠️</StepEmoji>
                                        <StepText>
                                            <strong>Выберите функционал:</strong>
                                            <ul style={{marginTop: '5px', marginLeft: '20px'}}>
                                                <li>📦 Инвентаризация</li>
                                                <li>🗑️ Списания</li>
                                                <li>🎯 Или оба сразу</li>
                                            </ul>
                                        </StepText>
                                    </StepItem>
                                    <StepItem>
                                        <StepEmoji>✅</StepEmoji>
                                        <StepText>Нажмите <strong>"Подтвердить"</strong></StepText>
                                    </StepItem>
                                </StepsList>

                                <HighlightBox>
                                    🎉 Что произойдет:<br/>
                                    ⚡ Сотрудник мгновенно получит доступ к выбранным функциям<br/>
                                    🔄 Доступ автоматически закроется через указанное время
                                </HighlightBox>
                            </FeatureCard>

                            <FeatureCard id="section-invite-employee">
                                <FeatureTitle>👤 2. Если сотрудника нет в списке</FeatureTitle>
                                
                                <StepSubtitle>📩 Пригласить нового сотрудника:</StepSubtitle>
                                <StepsList>
                                    <StepItem>
                                        <StepEmoji>📨</StepEmoji>
                                        <StepText>Нажмите кнопку <strong>"Пригласить сотрудника"</strong></StepText>
                                    </StepItem>
                                    <StepItem>
                                        <StepEmoji>💬</StepEmoji>
                                        <StepText>Откроется окно выбора чата</StepText>
                                    </StepItem>
                                    <StepItem>
                                        <StepEmoji>📤</StepEmoji>
                                        <StepText>Отправьте приглашение в нужный чат</StepText>
                                    </StepItem>
                                    <StepItem>
                                        <StepEmoji>🔗</StepEmoji>
                                        <StepText>Сотрудник получит ссылку для регистрации</StepText>
                                    </StepItem>
                                    <StepItem>
                                        <StepEmoji>🤖</StepEmoji>
                                        <StepText>Он переходит по ссылке → бот анализирует что он состоит именно в вашей группе</StepText>
                                    </StepItem>
                                    <StepItem>
                                        <StepEmoji>✅</StepEmoji>
                                        <StepText>Если состоит → автоматически регистрируется в системе</StepText>
                                    </StepItem>
                                    <StepItem>
                                        <StepEmoji>🔄</StepEmoji>
                                        <StepText>Закройте и откройте заново приложение → сотрудник появится в списке</StepText>
                                    </StepItem>
                                </StepsList>
                            </FeatureCard>

                            <FeatureCard id="section-view-permissions">
                                <FeatureTitle>📊 3. Просмотр активных прав</FeatureTitle>
                                
                                <StepSubtitle>👀 Где посмотреть:</StepSubtitle>
                                <StepsList>
                                    <StepItem>
                                        <StepEmoji>📋</StepEmoji>
                                        <StepText>В том же списке сотрудников</StepText>
                                    </StepItem>
                                    <StepItem>
                                        <StepEmoji>🔢</StepEmoji>
                                        <StepText>Рядом с именем будет показано количество активных прав</StepText>
                                    </StepItem>
                                    <StepItem>
                                        <StepEmoji>📌</StepEmoji>
                                        <StepText>Например: <strong>"Доступ (2)"</strong> означает 2 активных права</StepText>
                                    </StepItem>
                                </StepsList>

                                <StepSubtitle>📝 Подробная информация:</StepSubtitle>
                                <StepsList>
                                    <StepItem>
                                        <StepEmoji>👆</StepEmoji>
                                        <StepText>Нажмите на сотрудника с активными правами</StepText>
                                    </StepItem>
                                    <StepItem>
                                        <StepEmoji>👁️</StepEmoji>
                                        <StepText>Увидите все его права с обратным отсчетом времени</StepText>
                                    </StepItem>
                                    <StepItem>
                                        <StepEmoji>⏳</StepEmoji>
                                        <StepText>Показывается что доступно и когда истекает</StepText>
                                    </StepItem>
                                </StepsList>
                            </FeatureCard>

                            <FeatureCard id="section-revoke-permissions">
                                <FeatureTitle>❌ 4. Отзыв прав</FeatureTitle>
                                
                                <StepSubtitle>🚫 Как отозвать:</StepSubtitle>
                                <StepsList>
                                    <StepItem>
                                        <StepEmoji>📱</StepEmoji>
                                        <StepText>Откройте карточку сотрудника с активными правами</StepText>
                                    </StepItem>
                                    <StepItem>
                                        <StepEmoji>🔴</StepEmoji>
                                        <StepText>Нажмите кнопку <strong>"Отозвать"</strong> рядом с нужным правом</StepText>
                                    </StepItem>
                                    <StepItem>
                                        <StepEmoji>⚡</StepEmoji>
                                        <StepText>Доступ сразу закроется</StepText>
                                    </StepItem>
                                    <StepItem>
                                        <StepEmoji>📬</StepEmoji>
                                        <StepText>Сотрудник получит уведомление об отзыве в реальном времени</StepText>
                                    </StepItem>
                                </StepsList>
                            </FeatureCard>
                        </Section>

                        <Section id="section-benefits">
                            <SectionTitle>🎯 Преимущества</SectionTitle>
                            <BenefitsGrid>
                                <BenefitCard>
                                    <BenefitIcon>⚡</BenefitIcon>
                                    <BenefitTitle>Быстро</BenefitTitle>
                                    <BenefitText>Доступ выдается за 30 секунд</BenefitText>
                                </BenefitCard>
                                <BenefitCard>
                                    <BenefitIcon>🔒</BenefitIcon>
                                    <BenefitTitle>Безопасно</BenefitTitle>
                                    <BenefitText>Автоматическая очистка прав</BenefitText>
                                </BenefitCard>
                                <BenefitCard>
                                    <BenefitIcon>🎨</BenefitIcon>
                                    <BenefitTitle>Удобно</BenefitTitle>
                                    <BenefitText>Все в одном интерфейсе</BenefitText>
                                </BenefitCard>
                                <BenefitCard>
                                    <BenefitIcon>👁️</BenefitIcon>
                                    <BenefitTitle>Контроль</BenefitTitle>
                                    <BenefitText>Видно кто и на сколько имеет доступ</BenefitText>
                                </BenefitCard>
                                <BenefitCard>
                                    <BenefitIcon>🤖</BenefitIcon>
                                    <BenefitTitle>Автоматизация</BenefitTitle>
                                    <BenefitText>Регистрация новых сотрудников через бот</BenefitText>
                                </BenefitCard>
                            </BenefitsGrid>
                        </Section>

                        <VideoSection id="section-video">
                            <VideoContainer>
                                <VideoTitle>📹 Видео-обучение: Временный доступ</VideoTitle>
                                <VideoDescription>
                                    Посмотрите пошаговое руководство по работе с новым функционалом временного доступа
                                </VideoDescription>
                                
                                <VideoWrapper>
                                    <VideoPlayer 
                                        id="tutorial-video"
                                        controls 
                                        preload="metadata"
                                        playsInline={false}
                                        poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Crect width='1920' height='1080' fill='%23FF5F1F'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='72' font-family='Arial, sans-serif'%3E🎬 Обучающее видео%3C/text%3E%3C/svg%3E"
                                        onPlay={handleVideoPlay}
                                        onPause={handleVideoPause}
                                        onEnded={handleVideoEnded}

                                    >
                                        <source src="AppNinjaBotTutorial.mp4" type="video/mp4" />
                                        <p>Ваш браузер не поддерживает воспроизведение видео. 
                                        <a href="AppNinjaBotTutorial.mp4" download>Скачайте видео</a> для просмотра.</p>
                                    </VideoPlayer>
                                    
                                    <PlayButtonOverlay $visible={playButtonVisible} onClick={handlePlayButtonClick}>
                                        <PlayIcon viewBox="0 0 24 24">
                                            <path d="M8 5v14l11-7z"/>
                                        </PlayIcon>
                                    </PlayButtonOverlay>
                                    


                                </VideoWrapper>
                                
                                <VideoControlsInfo>
                                    💡 <strong>Совет:</strong> Включите полноэкранный режим для лучшего просмотра
                                </VideoControlsInfo>
                                
                                <VideoFeatures>
                                    <VideoFeature>
                                        <VideoFeatureIcon>🎯</VideoFeatureIcon>
                                        <VideoFeatureText>Пошаговые инструкции</VideoFeatureText>
                                    </VideoFeature>
                                    <VideoFeature>
                                        <VideoFeatureIcon>💼</VideoFeatureIcon>
                                        <VideoFeatureText>Реальные примеры</VideoFeatureText>
                                    </VideoFeature>
                                    <VideoFeature>
                                        <VideoFeatureIcon>⏱️</VideoFeatureIcon>
                                        <VideoFeatureText>Краткий обзор</VideoFeatureText>
                                    </VideoFeature>
                                    <VideoFeature>
                                        <VideoFeatureIcon>🔄</VideoFeatureIcon>
                                        <VideoFeatureText>Повторный просмотр</VideoFeatureText>
                                    </VideoFeature>
                                </VideoFeatures>
                            </VideoContainer>
                        </VideoSection>
                    </Content>
                </ContentWrapper>

                <Footer>
                    🚀 Функционал готов к использованию!
                    <VersionBadge>v2.0</VersionBadge>
                </Footer>
            </Container>

            <ScrollToNavBtn 
                $visible={showScrollBtn} 
                $hiddenOnScroll={isScrolling}
                onClick={(e) => {
                    e.preventDefault();
                    
                    // Найдем активный скроллируемый элемент
                    const allElements = Array.from(document.querySelectorAll('*')) as HTMLElement[];
                    const scrollableElements = allElements.filter(el => {
                        const style = window.getComputedStyle(el);
                        return (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollTop > 0;
                    });
                    
                    if (scrollableElements.length > 0) {
                        // Скроллим все найденные элементы
                        scrollableElements.forEach(el => {
                            el.scrollTo({
                                top: 0,
                                behavior: 'smooth'
                            });
                        });
                    } else {
                        // Fallback - стандартный скролл
                        window.scrollTo({
                            top: 0,
                            behavior: 'smooth'
                        });
                    }
                }}
                aria-label="Вернуться к началу"
            >
                <NavIcon viewBox="0 0 24 24" style={{ fill: 'white', width: '24px', height: '24px' }}>
                    <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
                </NavIcon>
            </ScrollToNavBtn>
        </PageContainer>
    );
};

export default UpdatesPage; 
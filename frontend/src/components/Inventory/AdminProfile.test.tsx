import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AdminProfile from './AdminProfile';
import { WebApp } from '../../types/telegram';

// Создаем базовый мок для WebApp
const createMockWebApp = (overrides?: Partial<WebApp>): WebApp => ({
    initData: '',
    initDataUnsafe: {
        query_id: '',
        user: {
            id: 1,
            first_name: 'Test'
        }
    },
    version: '6.0',
    platform: 'web',
    colorScheme: 'light',
    themeParams: {
        bg_color: '#fff',
        text_color: '#000',
        hint_color: '#999',
        link_color: '#00f',
        button_color: '#000',
        button_text_color: '#fff'
    },
    isExpanded: false,
    viewportHeight: 0,
    viewportStableHeight: 0,
    headerColor: '#fff',
    backgroundColor: '#fff',
    isClosingConfirmationEnabled: false,
    BackButton: {
        isVisible: false,
        onClick: jest.fn(),
        offClick: jest.fn(),
        show: jest.fn(),
        hide: jest.fn()
    },
    MainButton: {
        text: '',
        color: '#000',
        textColor: '#fff',
        isVisible: false,
        isProgressVisible: false,
        isActive: false,
        setText: jest.fn(),
        onClick: jest.fn(),
        offClick: jest.fn(),
        show: jest.fn(),
        hide: jest.fn(),
        enable: jest.fn(),
        disable: jest.fn(),
        showProgress: jest.fn(),
        hideProgress: jest.fn()
    },
    openLink: jest.fn(),
    showPopup: jest.fn(),
    ready: jest.fn(),
    expand: jest.fn(),
    close: jest.fn(),
    ...overrides
});

const mockAdmin = {
    user_id: 1234567890,
    first_name: 'John',
    last_name: 'Doe',
    username: 'johndoe',
    photo_url: 'https://example.com/photo.jpg'
};

describe('AdminProfile', () => {
    beforeEach(() => {
        // Очищаем моки перед каждым тестом
        jest.clearAllMocks();
        window.Telegram = undefined;
    });

    it('renders admin information correctly', () => {
        render(<AdminProfile admin={mockAdmin} />);

        // Проверяем, что все элементы отображаются
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('@johndoe')).toBeInTheDocument();
        expect(screen.getByText('Нажмите, чтобы написать')).toBeInTheDocument();
        
        // Проверяем атрибуты изображения
        const image = screen.getByAltText('John') as HTMLImageElement;
        expect(image).toBeInTheDocument();
        expect(image.src).toBe('https://example.com/photo.jpg');
    });

    it('uses fallback image when photo_url is not provided', () => {
        const adminWithoutPhoto = { ...mockAdmin, photo_url: undefined };
        render(<AdminProfile admin={adminWithoutPhoto} />);

        const image = screen.getByAltText('John') as HTMLImageElement;
        expect(image.src).toContain('https://ui-avatars.com/api/');
        expect(image.src).toContain('name=John');
    });

    it('uses fallback image when photo fails to load', () => {
        render(<AdminProfile admin={mockAdmin} />);
        
        const image = screen.getByAltText('John') as HTMLImageElement;
        fireEvent.error(image);

        expect(image.src).toContain('https://ui-avatars.com/api/');
        expect(image.src).toContain('name=John');
    });

    it('handles click when username is available', () => {
        const mockOpenLink = jest.fn();
        window.Telegram = {
            WebApp: createMockWebApp({
                openLink: mockOpenLink
            })
        };

        render(<AdminProfile admin={mockAdmin} />);
        fireEvent.click(screen.getByRole('button'));

        expect(mockOpenLink).toHaveBeenCalledWith('https://t.me/johndoe');
    });

    it('shows popup when username is not available', () => {
        const mockShowPopup = jest.fn();
        window.Telegram = {
            WebApp: createMockWebApp({
                showPopup: mockShowPopup
            })
        };

        const adminWithoutUsername = { ...mockAdmin, username: undefined };
        render(<AdminProfile admin={adminWithoutUsername} />);
        fireEvent.click(screen.getByRole('button'));

        expect(mockShowPopup).toHaveBeenCalledWith({
            title: 'Контакт администратора',
            message: expect.stringContaining('John Doe не указал username в Telegram'),
            buttons: [{
                type: 'close',
                text: 'Понятно'
            }]
        });
    });

    it('handles keyboard navigation', () => {
        const mockOpenLink = jest.fn();
        window.Telegram = {
            WebApp: createMockWebApp({
                openLink: mockOpenLink
            })
        };

        render(<AdminProfile admin={mockAdmin} />);
        
        // Проверяем Enter
        fireEvent.keyPress(screen.getByRole('button'), { key: 'Enter', code: 'Enter' });
        expect(mockOpenLink).toHaveBeenCalledWith('https://t.me/johndoe');

        // Проверяем Space
        mockOpenLink.mockClear();
        fireEvent.keyPress(screen.getByRole('button'), { key: ' ', code: 'Space' });
        expect(mockOpenLink).toHaveBeenCalledWith('https://t.me/johndoe');
    });

    it('handles error when interacting with Telegram WebApp', () => {
        const mockShowPopup = jest.fn().mockImplementation(() => {
            throw new Error('Telegram error');
        });

        window.Telegram = {
            WebApp: createMockWebApp({
                openLink: mockShowPopup,
                showPopup: mockShowPopup
            })
        };

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        render(<AdminProfile admin={mockAdmin} />);
        fireEvent.click(screen.getByRole('button'));

        expect(consoleSpy).toHaveBeenCalledWith('Error interacting with Telegram WebApp:', expect.any(Error));
        expect(consoleSpy).toHaveBeenCalledWith('Failed to show error popup');

        consoleSpy.mockRestore();
    });
}); 
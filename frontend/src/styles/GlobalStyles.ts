import { createGlobalStyle } from 'styled-components';

export const GlobalStyles = createGlobalStyle`
  :root {
    /* RGB значения для градиентов и прозрачности */
    --background-rgb: 255, 255, 255;
    --card-rgb: 255, 255, 255;
    --border-rgb: 0, 0, 0;
    --orange-rgb: 255, 95, 31;
    --success-rgb: 16, 185, 129;
    --error-rgb: 239, 68, 68;

    /* Основные цвета */
    --orange-primary: #FF5F1F;
    --orange-light: #FF8B59;
    --orange-dark: #E64500;
    --orange-primary-hover: #ff7a47;
    
    /* Состояния */
    --success-color: #10B981;
    --success-light: #34D399;
    --warning-color: #F59E0B;
    --error-color: #EF4444;
    --success-background: rgba(16, 185, 129, 0.1);
    --warning-background: rgba(245, 158, 11, 0.1);
    --error-background: rgba(239, 68, 68, 0.1);

    /* Фоны и границы */
    --bg-primary: rgba(255, 255, 255, 0.1);
    --bg-secondary: rgba(255, 255, 255, 0.05);
    --border-color: rgba(0, 0, 0, 0.1);

    /* Эффекты наведения и активации */
    --hover-overlay: rgba(0, 0, 0, 0.05);
    --active-overlay: rgba(0, 0, 0, 0.1);
    
    /* Градиенты */
    --gradient-primary: linear-gradient(135deg, var(--orange-primary), var(--orange-light));
    --gradient-success: linear-gradient(135deg, var(--success-color), var(--success-light));

    /* Основные цвета */
    --primary-color: var(--orange-primary);
    --primary-light: var(--orange-light);
    --primary-dark: var(--orange-dark);
    --primary-transparent: rgb(255 95 31 / 10%);

    /* Нейтральные цвета */
    --gray-50: #f9fafb;
    --gray-100: #f3f4f6;
    --gray-200: #e5e7eb;
    --gray-300: #d1d5db;
    --gray-400: #9ca3af;
    --gray-500: #6b7280;
    --gray-600: #4b5563;
    --gray-700: #374151;
    --gray-800: #1f2937;
    --gray-900: #111827;

    /* Светлая тема */
    --background-color: #fff;
    --card-background: #fff;
    --text-color: #2c3e50;
    --text-secondary: #666;
    --error-color: #e74c3c;
    --error-background: rgb(231 76 60 / 10%);
    --success-color: #2ecc71;
    --success-background: rgb(46 204 113 / 10%);

    /* Размеры и отступы */
    --header-height: 60px;
    --radius: 12px;
    --radius-lg: 16px;
    --radius-sm: 8px;
    
    /* Тени */
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 5%);
    --shadow: 0 1px 3px 0 rgb(0 0 0 / 10%), 0 1px 2px -1px rgb(0 0 0 / 10%);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 10%), 0 2px 4px -2px rgb(0 0 0 / 10%);
    --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 10%), 0 4px 6px -4px rgb(0 0 0 / 10%);

    /* Эффекты */
    --disabled-opacity: 50%;

    /* Анимации и переходы */
    --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
    --transition-normal: 200ms cubic-bezier(0.4, 0, 0.2, 1);
    --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
    
    /* Эффекты наведения */
    --hover-transform: translateY(-2px);
    --active-transform: translateY(0);

    /* Скелетон и загрузка */
    --skeleton-base: var(--gray-100);
    --skeleton-shine: var(--gray-200);

    /* Утилиты для градиентов */
    --gradient-dark: linear-gradient(45deg, var(--gray-900), var(--gray-800));

    --navigation-height: 80px;

    /* Новые переменные */
    --success-color: #10B981;
    --warning-color: #F59E0B;
    --error-color: #EF4444;
    --success-background: rgba(16, 185, 129, 0.1);
    --warning-background: rgba(245, 158, 11, 0.1);
    --error-background: rgba(239, 68, 68, 0.1);
  }

  /* Темная тема */
  [data-theme="dark"] {
    /* Основные цвета */
    --primary-color: var(--orange-primary);
    --primary-light: var(--orange-light);
    --primary-dark: var(--orange-dark);
    --primary-transparent: rgb(255 95 31 / 15%);

    /* Фоны и цвета текста */
    --background-color: #121212;
    --card-background: #1E1E1E;
    --text-color: #E0E0E0;
    --text-secondary: #A0A0A0;
    --border-color: #2A2A2A;

    /* Состояния */
    --error-color: var(--orange-dark);
    --error-background: rgb(230 69 0 / 15%);
    --success-color: var(--orange-primary);
    --success-background: rgb(255 95 31 / 15%);

    /* Оттенки серого */
    --gray-50: #1A1A1A;
    --gray-100: #242424;
    --gray-200: #2A2A2A;
    --gray-300: #333333;
    --gray-400: #404040;
    --gray-500: #595959;
    --gray-600: #737373;
    --gray-700: #8C8C8C;
    --gray-800: #A6A6A6;
    --gray-900: #BFBFBF;

    /* Тени */
    --shadow-sm: 0 1px 2px rgb(0 0 0 / 30%);
    --shadow: 0 1px 3px rgb(0 0 0 / 40%);
    --shadow-md: 0 4px 6px rgb(0 0 0 / 50%);
    --shadow-lg: 0 10px 15px rgb(0 0 0 / 50%);

    /* Эффекты */
    --hover-overlay: rgb(255 95 31 / 10%);
    --active-overlay: rgb(255 95 31 / 15%);

    /* Скелетон и загрузка */
    --skeleton-base: var(--gray-800);
    --skeleton-shine: var(--gray-700);

    /* Обновляем цвета для форм и текстовых полей */
    --input-background: #2A2A2A;
    --input-border: #404040;
    --input-text: #E0E0E0;
    --input-placeholder: #808080;
    --input-focus-border: var(--orange-primary);
    --input-focus-background: #333333;

    /* Фоны и границы */
    --bg-primary: rgba(255, 255, 255, 0.05);
    --bg-secondary: rgba(255, 255, 255, 0.02);
    --border-color: rgba(255, 255, 255, 0.1);

    /* Фоны и цвета текста */
    --background-rgb: 18, 18, 18;
    --card-rgb: 30, 30, 30;
    --border-rgb: 255, 255, 255;
  }

  /* Утилитарные классы */
  .gradient-primary {
    background: var(--gradient-primary);
  }

  .gradient-dark {
    background: var(--gradient-dark);
  }

  .text-gradient {
    background: linear-gradient(45deg, var(--orange-primary), var(--orange-light));
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    transition: all var(--transition-normal);
    background-color: var(--background-color);
    color: var(--text-color);
  }

  code {
    font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
      monospace;
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  button {
    border: none;
    background: none;
    cursor: pointer;
    font: inherit;
  }

  input, button, textarea, select {
    font: inherit;
  }
`; 
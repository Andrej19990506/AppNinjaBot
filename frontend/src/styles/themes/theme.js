import { createTheme } from '@mui/material/styles';

// --- Статичные значения для palette --- 
// Используем реальные значения, соответствующие вашим CSS переменным
// для светлой темы (или для темы по умолчанию, если она одна)
const staticTextColor = '#2c3e50'; 
const staticTextSecondary = '#666'; // Или другой цвет из вашей --text-secondary
const staticBackgroundColor = '#ffffff'; // Из --background-primary
const staticCardBackground = '#ffffff'; // Из --background-secondary
const staticRadius = 12; // Как число
const staticPrimaryLight = '#FF8B59'; // Из --orange-light
const staticPrimaryColor = '#FF5F1F'; // Из --orange-primary
const staticPrimaryDark = '#E64500'; // Из --orange-dark
// Добавляем статичные значения для других переменных, если они используются в палитре
const staticErrorColor = '#d32f2f'; // Стандартный MUI красный, замените на ваш из --error-color
const staticSuccessColor = '#2e7d32'; // Стандартный MUI зеленый, замените на ваш из --success-color

export const theme = createTheme({
  palette: {
    // --- Используем СТАТИЧНЫЕ значения здесь --- 
    primary: {
      main: staticPrimaryColor,
      light: staticPrimaryLight,
      dark: staticPrimaryDark,
    },
    background: {
      default: staticBackgroundColor,
      paper: staticCardBackground,    
    },
    text: {
      primary: staticTextColor,       
      secondary: staticTextSecondary, 
    },
    error: {
        main: staticErrorColor, 
    },
    success: {
        main: staticSuccessColor,
    }
  },
  shape: {
    // --- Используем СТАТИЧНОЕ число здесь --- 
    borderRadius: staticRadius, 
  },
  // --- Используем CSS ПЕРЕМЕННЫЕ для переопределения стилей компонентов --- 
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          // Используем переменную для радиуса
          borderRadius: `var(--radius, ${staticRadius}px)`,
          textTransform: 'none',
          // --- Пример явного задания цветов кнопке через переменные --- 
          // Эти стили перебьют цвета, выведенные из статичной палитры
          // Например, для contained primary кнопки:
          // '&.MuiButton-containedPrimary': { 
          //    backgroundColor: 'var(--orange-primary)',
          //    color: 'var(--text-color-on-primary)', // Убедитесь, что эта переменная есть
          //    '&:hover': {
          //        backgroundColor: 'var(--orange-dark)',
          //    }
          // },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          // Используем переменные
          backgroundColor: 'var(--orange-light)',
          borderRadius: `var(--radius, ${staticRadius}px)`, // Добавим радиус и сюда
          '& .MuiLinearProgress-bar': {
            backgroundColor: 'var(--orange-primary)',
          },
        },
      },
    },
    MuiOutlinedInput: {
        styleOverrides: {
            root: {
                // Используем переменные
                backgroundColor: 'var(--input-background, transparent)',
                borderRadius: `var(--radius, ${staticRadius}px)`,
                // Управляем цветом рамки через переменные
                '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'var(--input-border, var(--grey-light))',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'var(--input-focus-border, var(--orange-primary))',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'var(--input-focus-border, var(--orange-primary))',
                    borderWidth: '1px', // Оставляем 1px, чтобы убрать возможное удвоение рамки MUI
                },
                 // Состояние ошибки
                 '&.Mui-error .MuiOutlinedInput-notchedOutline': {
                     borderColor: 'var(--error-color)', // Используем переменную ошибки
                 },
            },
            // Стили для самого поля ввода <input>
            input: {
                // Используем переменные
                color: 'var(--text-color)',
                '&::placeholder': {
                    color: 'var(--input-placeholder, var(--text-secondary))',
                    opacity: 1,
                },
            }
        }
    },
    // MuiInputBase нужен в основном для базовых стилей инпута, 
    // MuiOutlinedInput выше уже должен покрыть большинство случаев.
    // Оставляем на всякий случай, если есть другие типы инпутов.
    MuiInputBase: {
        styleOverrides: {
            input: {
                color: 'var(--text-color)',
                '&::placeholder': {
                    color: 'var(--input-placeholder, var(--text-secondary))',
                    opacity: 1,
                },
            }
        }
    },
    MuiInputLabel: {
        styleOverrides: {
            root: {
                // Используем переменные
                color: 'var(--text-secondary)', // Цвет лейбла по умолчанию
                // Цвет лейбла при фокусе
                '&.Mui-focused': {
                    color: 'var(--orange-primary)', // Можно использовать --input-focus-border или --orange-primary
                },
                // Цвет лейбла при ошибке
                '&.Mui-error': {
                    color: 'var(--error-color)', // Используем переменную ошибки
                },
            }
        }
    },
    // --- Добавляем стили для Paper (используется в меню, диалогах и т.д.) ---
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none', // Убираем градиент, если он был у Paper
          backgroundColor: 'var(--card-background)', // Фон из переменной для карточек
          color: 'var(--text-color)', // Цвет текста из переменной
        }
      }
    },
    // --- Добавляем стили для MenuItem (элементы выпадающего меню) ---
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: 'var(--text-color)', // Цвет текста пункта меню
          '&:hover': {
            backgroundColor: 'var(--hover-overlay, rgba(0, 0, 0, 0.08))', // Цвет фона при наведении
          },
          // Стили для выбранного пункта
          '&.Mui-selected': {
            backgroundColor: 'var(--active-overlay, rgba(0, 0, 0, 0.12))', // Цвет фона выбранного пункта
            '&:hover': {
              backgroundColor: 'var(--active-overlay, rgba(0, 0, 0, 0.15))', // Немного темнее при наведении на выбранный
            },
            // Можно добавить стиль для жирного шрифта или галочки, если нужно
            // fontWeight: 'bold',
          },
        }
      }
    },
  },
}); 
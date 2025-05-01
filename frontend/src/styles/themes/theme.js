import { createTheme } from '@mui/material/styles';

// Значения по умолчанию (например, для светлой темы)
const defaultTextColor = '#2c3e50'; 
const defaultTextSecondary = '#666';
const defaultBackgroundColor = '#fff';
const defaultCardBackground = '#fff';
const defaultRadius = 12; // Значение из --radius
const defaultPrimaryLight = '#FF8B59'; // Значение из --orange-light
const defaultPrimaryColor = '#FF5F1F'; // Значение из --orange-primary

export const theme = createTheme({
  palette: {
    primary: {
      main: defaultPrimaryColor, // Используем статичное значение
      light: defaultPrimaryLight, // Используем статичное значение
      dark: '#E64500', // Оставляем статичное значение
    },
    background: {
      default: defaultBackgroundColor, // Используем статичное значение
      paper: defaultCardBackground,    // Используем статичное значение
    },
    text: {
      primary: defaultTextColor,       // Используем статичное значение
      secondary: defaultTextSecondary, // Используем статичное значение
    },
  },
  shape: {
    borderRadius: defaultRadius, // Используем статичное значение
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: defaultRadius, // Используем статичное значение
          textTransform: 'none',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: defaultPrimaryLight, // Используем статичное значение
          '& .MuiLinearProgress-bar': {
            backgroundColor: defaultPrimaryColor, // Используем статичное значение
          },
        },
      },
    },
  },
}); 
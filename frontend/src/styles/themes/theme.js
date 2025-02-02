import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#FF5F1F',
      light: '#FF8B59',
      dark: '#E64500',
    },
    background: {
      default: 'var(--background-color)',
      paper: 'var(--card-background)',
    },
    text: {
      primary: 'var(--text-color)',
      secondary: 'var(--text-secondary)',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius)',
          textTransform: 'none',
        },
      },
    },
  },
}); 
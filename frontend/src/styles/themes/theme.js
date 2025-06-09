import { createTheme } from '@mui/material/styles';

const staticTextColor = '#2c3e50'; 
const staticTextSecondary = '#666';
const staticBackgroundColor = '#ffffff';
const staticCardBackground = '#ffffff';
const staticRadius = 12;
const staticPrimaryLight = '#FF8B59';
const staticPrimaryColor = '#FF5F1F';
const staticPrimaryDark = '#E64500';
const staticErrorColor = '#d32f2f';
const staticSuccessColor = '#2e7d32';

export const theme = createTheme({
  palette: {
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
    borderRadius: staticRadius, 
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: `var(--radius, ${staticRadius}px)`,
          textTransform: 'none',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: 'var(--orange-light)',
          borderRadius: `var(--radius, ${staticRadius}px)`,
          '& .MuiLinearProgress-bar': {
            backgroundColor: 'var(--orange-primary)',
          },
        },
      },
    },
    MuiOutlinedInput: {
        styleOverrides: {
            root: {
                backgroundColor: 'var(--input-background, transparent)',
                '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'var(--input-border, var(--grey-light))',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'var(--input-focus-border, var(--orange-primary))',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'var(--input-focus-border, var(--orange-primary))',
                    borderWidth: '1px',
                },
                 '&.Mui-error .MuiOutlinedInput-notchedOutline': {
                     borderColor: 'var(--error-color)',
                 },
            },
            input: {
                color: 'var(--text-color)',
                '&::placeholder': {
                    color: 'var(--input-placeholder, var(--text-secondary))',
                    opacity: 1,
                },
            }
        }
    },
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
                color: 'var(--text-secondary)',
                '&.Mui-focused': {
                    color: 'var(--orange-primary)',
                },
                '&.Mui-error': {
                    color: 'var(--error-color)',
                },
            }
        }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'var(--card-background)',
          color: 'var(--text-color)',
        }
      }
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: 'var(--text-color)',
          '&:hover': {
            backgroundColor: 'var(--hover-overlay, rgba(0, 0, 0, 0.08))',
          },
          '&.Mui-selected': {
            backgroundColor: 'var(--active-overlay, rgba(0, 0, 0, 0.12))',
            '&:hover': {
              backgroundColor: 'var(--active-overlay, rgba(0, 0, 0, 0.15))',
            },
          },
        }
      }
    },
  },
}); 
import React from 'react';
import Button from '@mui/material/Button';

interface CancelButtonProps {
  onClick: () => void;
  children?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  variant?: 'text' | 'outlined' | 'contained';
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
  fullWidth?: boolean;
}

export const CancelButton: React.FC<CancelButtonProps> = ({
  onClick,
  children = 'Отмена',
  disabled = false,
  className = '',
  variant = 'outlined',
  color = 'secondary',
  fullWidth = false
}) => {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className={className}
      variant={variant}
      color={color}
      fullWidth={fullWidth}
    >
      {children}
    </Button>
  );
};

export default CancelButton; 
import React from 'react';
import Button from '@mui/material/Button';

interface ActionButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  variant?: 'text' | 'outlined' | 'contained';
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  onClick,
  children,
  disabled = false,
  className = '',
  variant = 'contained',
  color = 'primary',
  fullWidth = false,
  type = 'button'
}) => {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className={className}
      variant={variant}
      color={color}
      fullWidth={fullWidth}
      type={type}
    >
      {children}
    </Button>
  );
};

export default ActionButton; 
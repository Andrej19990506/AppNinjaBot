import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import Button from '@mui/material/Button';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import SpeedDial from '@mui/material/SpeedDial';
import SpeedDialAction from '@mui/material/SpeedDialAction';
import styles from './AddPhotoButton.module.css';

interface AddPhotoButtonProps {
  onPhotoCapture?: (file: File) => void;
}

/**
 * Компонент кнопки добавления фото списания с выбором камеры или галереи
 */
const AddPhotoButton: React.FC<AddPhotoButtonProps> = ({ onPhotoCapture }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Обработчик выбора фото из галереи
  const handleGallerySelect = () => {
    fileInputRef.current?.click();
  };

  // Обработчик открытия камеры
  const handleCameraOpen = () => {
    cameraInputRef.current?.click();
  };

  // Обработчик файла
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onPhotoCapture) {
      onPhotoCapture(file);
    }
    // Очищаем input для повторного выбора того же файла
    event.target.value = '';
  };

  const actions = [
    {
      icon: <CameraAltIcon className={styles.actionIcon} />,
      name: 'Сделать фото',
      onClick: handleCameraOpen,
    },
    {
      icon: <PhotoLibraryIcon className={styles.actionIcon} />,
      name: 'Выбрать из галереи',
      onClick: handleGallerySelect,
    },
  ];

  return (
    <div className={styles.addPhotoContainer}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 15,
          delay: 0.1
        }}
      >
        <SpeedDial
          ariaLabel="Добавить фото списания"
          className={styles.speedDial}
          icon={<CameraAltIcon className={styles.mainIcon} />}
          direction="up"
          FabProps={{
            size: 'medium',
            className: styles.fabButton,
          }}
        >
          {actions.map((action) => (
            <SpeedDialAction
              key={action.name}
              icon={action.icon}
              tooltipTitle={action.name}
              tooltipPlacement="left"
              onClick={action.onClick}
              className={styles.speedDialAction}
              FabProps={{
                className: styles.actionButton,
              }}
            />
          ))}
        </SpeedDial>
      </motion.div>

      {/* Скрытые input для выбора файлов */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default AddPhotoButton; 
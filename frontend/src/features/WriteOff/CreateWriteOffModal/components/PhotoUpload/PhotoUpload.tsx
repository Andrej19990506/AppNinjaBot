import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import DeleteIcon from '@mui/icons-material/Delete';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import PhotoGallery from '@/shared/components/PhotoGallery/PhotoGallery';
import PhotoThumbnail from '@/shared/components/PhotoGallery/PhotoThumbnail';
import styles from './PhotoUpload.module.css';

interface PhotoUploadProps {
  onPhotosChange?: (files: File[]) => void;
  selectedPhotos?: File[];
  isRequired?: boolean;
  label?: string;
  maxPhotos?: number;
}

/**
 * Компонент галереи фото для списания
 * Поддерживает несколько фото, горизонтальную прокрутку и просмотр в полном размере
 */
export const PhotoUpload: React.FC<PhotoUploadProps> = ({
  onPhotosChange,
  selectedPhotos = [],
  isRequired = false,
  label = "Фото списания",
  maxPhotos = 10
}) => {
  console.log('📷 [PhotoUpload] PROPS получены:', {
    selectedPhotosLength: selectedPhotos?.length || 0,
    selectedPhotosNames: selectedPhotos?.map(f => f.name) || [],
    onPhotosChange: !!onPhotosChange
  });
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [forceUpdate, setForceUpdate] = useState(0);
  
  console.log('🔄 [PhotoUpload] Рендер компонента. Фото:', selectedPhotos.length, 'URL:', photoUrls.length);

  // Обновляем URL превью при изменении фото
  React.useEffect(() => {
    console.log('🔄 [PhotoUpload] Обновление превью для', selectedPhotos.length, 'фото');
    
    // Очищаем старые URL
    setPhotoUrls(prevUrls => {
      prevUrls.forEach(url => URL.revokeObjectURL(url));
      return [];
    });
    
    // Создаем новые URL для превью
    const newUrls = selectedPhotos.map(file => URL.createObjectURL(file));
    setPhotoUrls(newUrls);
    
    // Принудительно обновляем компонент
    setForceUpdate(prev => prev + 1);
    
    // Очистка при размонтировании
    return () => {
      newUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [selectedPhotos]);

  // Добавление фото
  const handleAddPhotos = (files: FileList) => {
    const newFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    const totalPhotos = selectedPhotos.length + newFiles.length;
    
    if (totalPhotos > maxPhotos) {
      console.warn(`Максимальное количество фото: ${maxPhotos}`);
      return;
    }
    
    const updatedPhotos = [...selectedPhotos, ...newFiles];
    console.log('📷 [PhotoUpload] Добавлено фото:', newFiles.length, 'общее количество:', updatedPhotos.length);
    console.log('📷 [PhotoUpload] Новые файлы:', newFiles.map(f => f.name));
    
    // Принудительно обновляем компонент для немедленного отображения
    setForceUpdate(prev => prev + 1);
    
    if (onPhotosChange) {
      // Принудительно вызываем обновление
      onPhotosChange(updatedPhotos);
      console.log('📷 [PhotoUpload] onPhotosChange вызван с', updatedPhotos.length, 'файлами');
    } else {
      console.warn('📷 [PhotoUpload] onPhotosChange не определен!');
    }
  };

  // Удаление фото
  const handleRemovePhoto = (index: number) => {
    console.log('🗑️ [PhotoUpload] Удаление фото по индексу:', index);
    
    // Сначала обновляем локальное состояние URL
    setPhotoUrls(prevUrls => {
      // Очищаем URL удаляемого фото
      if (prevUrls[index]) {
        URL.revokeObjectURL(prevUrls[index]);
      }
      return prevUrls.filter((_, i) => i !== index);
    });
    
    const updatedPhotos = selectedPhotos.filter((_, i) => i !== index);
    console.log('🗑️ [PhotoUpload] Новый массив фото:', updatedPhotos.length, 'файлов');
    
    // Принудительно обновляем компонент
    setForceUpdate(prev => prev + 1);
    
    if (onPhotosChange) {
      onPhotosChange(updatedPhotos);
    }
  };

  // Открытие камеры
  const handleCameraCapture = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  // Открытие галереи
  const handleGallerySelect = () => {
    if (galleryInputRef.current) {
      galleryInputRef.current.click();
    }
  };

  // Обработка изменения файла в инпуте
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleAddPhotos(files);
    }
    // Очищаем input для возможности повторного выбора
    event.target.value = '';
  };

  // Обработка drag & drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleAddPhotos(files);
    }
  };

  // Открытие фото в полноэкранной галерее
  const handlePhotoClick = (index: number) => {
    setGalleryIndex(index);
    setIsGalleryOpen(true);
  };

  const hasPhotos = selectedPhotos.length > 0;
  const canAddMore = selectedPhotos.length < maxPhotos;

  return (
    <section className={styles.photoSection}>
      <label className={styles.photoLabel}>
        {label}
        {isRequired && <span className={styles.required}>*</span>}
        {hasPhotos && (
          <span className={styles.photoCount}>
            ({selectedPhotos.length}/{maxPhotos})
          </span>
        )}
      </label>

      {/* Галерея существующих фото */}
      <AnimatePresence mode="wait">
        {hasPhotos && (
          <motion.div
            key={`gallery-${forceUpdate}`}
            className={styles.photosGallery}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className={styles.photosScroll}>
              <AnimatePresence mode="popLayout">
                {photoUrls.map((url, index) => (
                  <motion.div
                    key={`photo-${index}-${selectedPhotos[index]?.lastModified || Date.now()}-${forceUpdate}`}
                    className={styles.photoThumbnailContainer}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    layout
                  >
                    <PhotoThumbnail
                      src={url}
                      alt={`Фото списания ${index + 1}`}
                      onClick={() => handlePhotoClick(index)}
                      width="80px"
                      height="80px"
                    />
                    <IconButton
                      className={styles.deletePhotoButton}
                      onClick={() => handleRemovePhoto(index)}
                      size="small"
                      aria-label={`Удалить фото ${index + 1}`}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Кнопки добавления фото */}
      {canAddMore && (
        <motion.div
          className={`${styles.uploadContainer} ${isDragOver ? styles.dragOver : ''}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className={styles.uploadArea}>
            <AddAPhotoIcon className={styles.uploadIcon} />
            <p className={styles.uploadText}>
              {isDragOver 
                ? 'Отпустите для загрузки' 
                : hasPhotos 
                  ? 'Добавить еще фото'
                  : 'Добавьте фото списания'
              }
            </p>
            
            <div className={styles.uploadButtons}>
              <Button
                onClick={handleCameraCapture}
                variant="contained"
                startIcon={<CameraAltIcon />}
                className={styles.cameraButton}
                size="large"
              >
                Камера
              </Button>
              
              <Button
                onClick={handleGallerySelect}
                variant="outlined"
                startIcon={<PhotoLibraryIcon />}
                className={styles.galleryButton}
                size="large"
              >
                Галерея
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Сообщение о максимальном количестве фото */}
      {!canAddMore && (
        <motion.div
          className={styles.maxPhotosMessage}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          Достигнуто максимальное количество фото ({maxPhotos})
        </motion.div>
      )}

      {/* Скрытые инпуты для камеры и галереи */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple={false}
        style={{ display: 'none' }}
        onChange={handleInputChange}
      />
      
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleInputChange}
      />

      {/* Полноэкранная галерея */}
      <PhotoGallery
        photos={photoUrls}
        initialIndex={galleryIndex}
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
      />
    </section>
  );
}; 
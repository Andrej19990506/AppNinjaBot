import React from 'react';
import { useSelector } from 'react-redux';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import { RootState } from '@/store';
import { WriteOffItem } from '@/types/writeOff';
import { canEditWriteOffsForDate } from '@/shared/utils/dateUtils';
import styles from '@/features/WriteOff/WriteOffList/WriteOffList.module.css';

interface WriteOffItemMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  selectedItem: WriteOffItem | null;
  onEdit: () => void;
  onDelete: () => void;
  onClone: () => void;
}

/**
 * Компонент меню для элемента списания с опциями редактирования, удаления и клонирования
 */
const WriteOffItemMenu: React.FC<WriteOffItemMenuProps> = ({
  anchorEl,
  open,
  onClose,
  selectedItem,
  onEdit,
  onDelete,
  onClone
}) => {
  const selectedDate = useSelector((state: RootState) => state.writeOff.selectedDate);
  const canEdit = canEditWriteOffsForDate(selectedDate);

  if (!selectedItem) return null;

  // Добавляем обработчики с логированием для отладки
  const handleEditClick = () => {
    console.log('Редактирование элемента из меню:', selectedItem);
    if (canEdit) {
      onEdit();
    }
  };

  const handleCloneClick = () => {
    console.log('Клонирование элемента из меню:', selectedItem);
    if (canEdit) {
      onClone();
    }
  };

  const handleDeleteClick = () => {
    console.log('Удаление элемента из меню:', selectedItem);
    if (canEdit) {
      onDelete();
    }
  };

  return (
    <Menu
      id="write-off-item-menu"
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      elevation={3}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      classes={{
        paper: styles.menuPaper
      }}
    >
      <MenuItem 
        onClick={handleEditClick} 
        className={styles.editMenuItem}
        disabled={!canEdit}
      >
        <ListItemIcon className={styles.menuIcon}>
          <EditIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>
          {canEdit ? 'Редактировать' : 'Нельзя редактировать прошедшие дни'}
        </ListItemText>
      </MenuItem>
      
      <MenuItem 
        onClick={handleCloneClick} 
        className={styles.cloneMenuItem}
        disabled={!canEdit}
      >
        <ListItemIcon className={styles.menuIcon}>
          <FileCopyIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>
          {canEdit ? 'Клонировать' : 'Нельзя клонировать в прошедшие дни'}
        </ListItemText>
      </MenuItem>
      
      <MenuItem 
        onClick={handleDeleteClick} 
        className={styles.deleteMenuItem}
        disabled={!canEdit}
      >
        <ListItemIcon className={styles.menuIcon}>
          <DeleteIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>
          {canEdit ? 'Удалить' : 'Нельзя удалить в прошедшие дни'}
        </ListItemText>
      </MenuItem>
    </Menu>
  );
};

export default WriteOffItemMenu; 
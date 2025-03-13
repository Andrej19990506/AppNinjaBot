import React from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import { WriteOffItem } from '../../../../types/writeOff';
import styles from '../WriteOffList.module.css';

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
  if (!selectedItem) return null;

  // Добавляем обработчики с логированием для отладки
  const handleEditClick = () => {
    console.log('Редактирование элемента из меню:', selectedItem);
    onEdit();
  };

  const handleCloneClick = () => {
    console.log('Клонирование элемента из меню:', selectedItem);
    onClone();
  };

  const handleDeleteClick = () => {
    console.log('Удаление элемента из меню:', selectedItem);
    onDelete();
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
      <MenuItem onClick={handleEditClick} className={styles.editMenuItem}>
        <ListItemIcon className={styles.menuIcon}>
          <EditIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Редактировать</ListItemText>
      </MenuItem>
      
      <MenuItem onClick={handleCloneClick} className={styles.cloneMenuItem}>
        <ListItemIcon className={styles.menuIcon}>
          <FileCopyIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Клонировать</ListItemText>
      </MenuItem>
      
      <MenuItem onClick={handleDeleteClick} className={styles.deleteMenuItem}>
        <ListItemIcon className={styles.menuIcon}>
          <DeleteIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Удалить</ListItemText>
      </MenuItem>
    </Menu>
  );
};

export default WriteOffItemMenu; 
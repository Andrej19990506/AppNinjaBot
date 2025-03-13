import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import Typography from '@mui/material/Typography';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import Button from '@mui/material/Button';
import ChatSelector from '../common/ChatSelector';
import ChatModal from '../Inventory/ChatModal';
import Footer from '../Inventory/Footer';
import AppHeader from '../common/AppHeader';
import EmptyWriteOff from './EmptyWriteOff';
import Skeleton from '../common/Skeleton';
import CreateWriteOffModal from './CreateWriteOffModal/CreateWriteOffModal';
import WriteOffList from './WriteOffList/WriteOffList';
import DocGenerationModal from './DocGenerationModal';
import { RootState } from '../../store';
import { WriteOffChat, WriteOffItem } from '../../types/writeOff';
import { ChatInventory } from '../../types/inventory';
import { useAppDispatch } from '../../store/hooks';
import { 
    selectWriteOffChat, 
    clearSelectedChat, 
    fetchWriteOffChats, 
    createWriteOffItem, 
    deleteWriteOffItem,
    fetchWriteOffs,
    updateWriteOffItem,
    resetModal
} from '../../store/slices/writeOffSlice';
import { initializeFromTelegram } from '../../store/slices/userSlice';
import styles from './WriteOff.module.css';
import { useNavigate } from 'react-router-dom';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import CircularProgress from '@mui/material/CircularProgress';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DialogTitle from '@mui/material/DialogTitle';
import { useWebSocket } from '../../hooks/useWebSocket';
import { socketService } from '../../services/socket';
import { subscribeToEvent, unsubscribeFromEvent, joinChatRoom, leaveChatRoom } from '../../services/websocketHelper';
import config from '../../config';
import useAnimations from './hooks/useGSAPAnimations';

// Добавляем интерфейс для преобразования ChatInventory в Chat
interface Chat {
    id: string;
    name: string;
    type: 'group' | 'supergroup' | 'private';
    created_at: string;
    updated_at: string;
}

// Добавляем интерфейс для причины списания
interface WriteOffReason {
    id: string;
    title: string;
    description: string;
}

// Анимации для переходов
const pageVariants = {
    initial: {
        opacity: 0,
        y: 20,
    },
    in: {
        opacity: 1,
        y: 0,
    },
    out: {
        opacity: 0,
        y: -20,
    }
};

const pageTransition = {
    type: "tween",
    ease: "anticipate",
    duration: 0.5
};

const WriteOff: React.FC = () => {
    const [writeOffItems, setWriteOffItems] = useState<WriteOffItem[]>([]);
    const [selectedChat, setSelectedChat] = useState<WriteOffChat | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCreateWriteOffModalOpen, setIsCreateWriteOffModalOpen] = useState(false);
    const [selectedChatForModal, setSelectedChatForModal] = useState<WriteOffChat | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [writeOffName, setWriteOffName] = useState<string>('');
    const [selectedReason, setSelectedReason] = useState<WriteOffReason | null>(null);
    const [writeOffQuantity, setWriteOffQuantity] = useState<number>(0);
    const [writeOffDescription, setWriteOffDescription] = useState<string>('');
    const [writeOffUnitType, setWriteOffUnitType] = useState<'шт' | 'гр'>('шт');
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [filterText, setFilterText] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    
    // Состояния для модальных окон
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<WriteOffItem | null>(null);
    const [isDeletingItem, setIsDeletingItem] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deletingItem, setDeletingItem] = useState<WriteOffItem | null>(null);
    
    // Состояния для генерации документа
    const [isGeneratingDocument, setIsGeneratingDocument] = useState<boolean>(false);
    const [isDocModalOpen, setIsDocModalOpen] = useState<boolean>(false);
    const [documentUrl, setDocumentUrl] = useState<string | null>(null);
    const [documentName, setDocumentName] = useState<string>('');
    
    const writeOffListRef = useRef<any>(null);
    
    const controls = useAnimation();
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    
    const { chats, isLoading: isChatsLoading, error, selectedChat: selectedWriteOffChat } = useSelector((state: RootState) => state.writeOff);
    const user = useSelector((state: RootState) => state.user);
    const branchName = useSelector((state: RootState) => state.user.branchName || 'Филиал не выбран');

    // Получаем WebSocket методы
    const { joinRoom, leaveRoom } = useWebSocket();

    // Получаем рефы и функции анимаций из хука
    const {
        headerRef,
        listContainerRef,
        footerRef,
        animateNewItem,
        animateItemRemoval,
        animateItemUpdate
    } = useAnimations();

    // Обработчик удаления списания (перемещен на верхний уровень)
    const handleWriteOffDeleted = useCallback((data: any) => {
        console.log('🗑️ [WriteOff Component] Получено уведомление об удалении списания:', data);
        
        if (data.chatId === selectedWriteOffChat?.chat_id) {
            console.log('🔍 [WriteOff Component] Удаление элемента из списка:', data.writeOffId);
            
            // Сначала обновляем состояние, затем анимируем элемент если он есть в DOM
            setWriteOffItems(prevItems => {
                const filteredItems = prevItems.filter(item => item.id !== data.writeOffId);
                
                // После обновления состояния, пытаемся найти элемент в DOM для анимации
                // Используем setTimeout, чтобы дать React время обновить DOM
                setTimeout(() => {
                    const elementToRemove = document.querySelector(`[data-write-off-id="${data.writeOffId}"]`);
                    if (elementToRemove) {
                        animateItemRemoval(elementToRemove as HTMLElement);
                    }
                }, 0);
                
                return filteredItems;
            });
        }
    }, [selectedWriteOffChat?.chat_id, animateItemRemoval]);

    // Обработчик создания нового списания
    const handleWriteOffCreated = useCallback((data: any) => {
        console.log('✨ [WriteOff Component] Получено уведомление о создании списания:', data);
        
        if (data.chatId === selectedWriteOffChat?.chat_id && data.writeOffItem) {
            console.log('✅ [WriteOff Component] Добавление нового элемента в список');
            
            // Проверяем, что элемент еще не существует в списке
            setWriteOffItems(prevItems => {
                if (prevItems.some(item => item.id === data.writeOffItem.id)) {
                    return prevItems;
                }
                
                const newItems = [...prevItems, data.writeOffItem];
                
                // После обновления состояния, пытаемся найти элемент в DOM для анимации
                setTimeout(() => {
                    const newElement = document.querySelector(`[data-write-off-id="${data.writeOffItem.id}"]`);
                    if (newElement) {
                        animateNewItem(newElement as HTMLElement);
                    }
                }, 50);
                
                return newItems;
            });
        }
    }, [selectedWriteOffChat?.chat_id, animateNewItem]);

    // Обработчик обновления списания
    const handleWriteOffUpdated = useCallback((data: any) => {
        console.log('🔄 [WriteOff Component] Получено уведомление об обновлении списания:', data);
        
        if (data.chatId === selectedWriteOffChat?.chat_id && data.writeOffItem) {
            console.log('✅ [WriteOff Component] Обновление элемента в списке:', data.writeOffId);
            
            setWriteOffItems(prevItems => {
                const newItems = prevItems.map(item => 
                    item.id === data.writeOffId ? data.writeOffItem : item
                );
                
                // После обновления состояния, пытаемся найти элемент в DOM для анимации
                setTimeout(() => {
                    const updatedElement = document.querySelector(`[data-write-off-id="${data.writeOffId}"]`);
                    if (updatedElement) {
                        animateItemUpdate(updatedElement as HTMLElement);
                    }
                }, 50);
                
                return newItems;
            });
        }
    }, [selectedWriteOffChat?.chat_id, animateItemUpdate]);

    // Обновляем список элементов только при изменении выбранного чата
    useEffect(() => {
        if (selectedWriteOffChat) {
            console.log('🔄 Обновление списка списаний при изменении выбранного чата', {
                chatId: selectedWriteOffChat.chat_id,
                writeOffsCount: selectedWriteOffChat.writeOffs.length
            });
            setWriteOffItems(selectedWriteOffChat.writeOffs || []);
            
            // Получаем информацию о пользователе
            const userInfo = {
                id: user.id,
                first_name: user.first_name || 'Пользователь',
                last_name: '',
                username: '',
                photo_url: user.photo_url || '',
                is_admin: user.isAdmin
            };
            
            // Используем улучшенные функции подключения к комнате
            joinChatRoom(selectedWriteOffChat.chat_id, userInfo);
            
            // Подписываемся на события
            subscribeToEvent('writeoff_created', handleWriteOffCreated);
            subscribeToEvent('writeoff_updated', handleWriteOffUpdated);
            subscribeToEvent('writeoff_deleted', handleWriteOffDeleted);
            
            // Очистка при размонтировании
            return () => {
                // Отключаемся от комнаты при смене чата
                leaveChatRoom(selectedWriteOffChat.chat_id, userInfo);
                
                // Отписываемся от событий
                unsubscribeFromEvent('writeoff_created', handleWriteOffCreated);
                unsubscribeFromEvent('writeoff_updated', handleWriteOffUpdated);
                unsubscribeFromEvent('writeoff_deleted', handleWriteOffDeleted);
            };
        } else {
            setWriteOffItems([]);
        }
    }, [
        selectedWriteOffChat?.chat_id,
        user,
        handleWriteOffCreated,
        handleWriteOffUpdated,
        handleWriteOffDeleted
    ]);

    // Обновляем список элементов при изменении списаний в выбранном чате
    useEffect(() => {
        if (selectedWriteOffChat && selectedWriteOffChat.writeOffs) {
            console.log('🔄 Обновление списка списаний при изменении данных списаний', {
                chatId: selectedWriteOffChat.chat_id,
                writeOffsCount: selectedWriteOffChat.writeOffs.length,
                writeOffs: selectedWriteOffChat.writeOffs
            });
            
            // Синхронизируем локальный список с Redux-состоянием
            setWriteOffItems(selectedWriteOffChat.writeOffs);
        }
    }, [selectedWriteOffChat?.writeOffs]);

    // Добавляем логирование для отладки WebSocket событий
    useEffect(() => {
        // Настраиваем логирование всех WebSocket-событий для отладки
        const logAllEvents = (eventName: string, data: any) => {
            console.log(`🔔 [DEBUG] WebSocket Event: ${eventName}`, data);
        };
        
        // Подписываемся на все основные события WebSocket
        socketService.subscribe('connect', data => logAllEvents('connect', data));
        socketService.subscribe('disconnect', data => logAllEvents('disconnect', data));
        socketService.subscribe('join', data => logAllEvents('join', data));
        socketService.subscribe('leave', data => logAllEvents('leave', data));
        socketService.subscribe('joined', data => logAllEvents('joined', data));
        socketService.subscribe('writeoff_created', data => logAllEvents('writeoff_created', data));
        socketService.subscribe('writeoff_updated', data => logAllEvents('writeoff_updated', data));
        socketService.subscribe('writeoff_deleted', data => logAllEvents('writeoff_deleted', data));
        
        return () => {
            // Отписываемся от всех событий при размонтировании
            socketService.unsubscribe('connect');
            socketService.unsubscribe('disconnect');
            socketService.unsubscribe('join');
            socketService.unsubscribe('leave');
            socketService.unsubscribe('joined');
            socketService.unsubscribe('writeoff_created');
            socketService.unsubscribe('writeoff_updated');
            socketService.unsubscribe('writeoff_deleted');
        };
    }, []);

    const handleCreateWriteOff = () => {
        // Сбрасываем режим редактирования при создании нового списания
        setEditingItemId(null);
        // Очищаем форму
        setWriteOffName('');
        setSelectedReason(null);
        setWriteOffQuantity(0);
        setWriteOffDescription('');
        setWriteOffUnitType('шт');
        // Открываем модальное окно
        setIsCreateWriteOffModalOpen(true);
    };

    const handleChatSelect = async (chatId: string, chat: ChatInventory) => {
        // Анимация перед выбором чата
        await controls.start({
            opacity: 0,
            y: -20,
            transition: { duration: 0.3 }
        });
        
        // Преобразуем ChatInventory в WriteOffChat
        const writeOffChat: WriteOffChat = {
            ...chat,
            metadata: {
                lastUpdated: new Date().toISOString(),
                progress: 0,
                chat_id: chat.chat_id,
                totalWriteOffs: 0,
                pendingWriteOffs: 0
            },
            writeOffs: []
        };
        
        setSelectedChatForModal(writeOffChat);
        setIsModalOpen(true);
        
        try {
            await dispatch(selectWriteOffChat(chatId)).unwrap();
            
            // Анимация после выбора чата
            await controls.start({
                opacity: 1,
                y: 0,
                transition: { duration: 0.3 }
            });
        } catch (error) {
            console.error('Ошибка при выборе чата:', error);
        }
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setSelectedChatForModal(null);
        dispatch(clearSelectedChat());
    };

    const handleStartWriteOff = async () => {
        if (selectedChatForModal) {
            // Сначала устанавливаем выбранный чат для отображения футера
            setSelectedChat(selectedChatForModal as WriteOffChat);
            // Затем закрываем модальное окно выбора чата
            setIsModalOpen(false);
            
            try {
                console.log('🔄 Загрузка списаний для чата:', selectedChatForModal.chat_id);
                // Устанавливаем состояние загрузки
                setIsLoading(true);
                // Загружаем данные списаний
                await dispatch(fetchWriteOffs(selectedChatForModal.chat_id)).unwrap();
                console.log('✅ Списания загружены успешно');
            } catch (error) {
                console.error('❌ Ошибка при загрузке списаний:', error);
            } finally {
                // В любом случае завершаем загрузку
                setIsLoading(false);
            }
        }
    };

    const handleBackToChats = () => {
        console.log('🔄 Возврат к списку чатов');
        
        // Очищаем состояние
        setSelectedChat(null);
        setWriteOffItems([]);
        dispatch(clearSelectedChat());
        
        // Перенаправляем пользователя на главную страницу
        navigate('/');
    };

    const handleRetry = async () => {
        setIsLoading(true);
        setLoadingProgress(0);
        
        // Имитация прогресса загрузки
        const interval = setInterval(() => {
            setLoadingProgress(prev => {
                if (prev >= 90) {
                    clearInterval(interval);
                    return prev;
                }
                return prev + 10;
            });
        }, 300);
        
        try {
            await dispatch(fetchWriteOffChats()).unwrap();
        } catch (error) {
            console.error('Ошибка при повторной загрузке данных:', error);
        } finally {
            clearInterval(interval);
            setLoadingProgress(100);
            
            // Небольшая задержка перед скрытием загрузки
            setTimeout(() => {
                setIsLoading(false);
            }, 300);
        }
    };

    const handleCreateWriteOffSubmit = async (
        name: string, 
        reason: WriteOffReason | null, 
        quantity: number,
        description: string = '',
        unitType: 'шт' | 'гр' = 'шт'
    ) => {
        if (!reason || !selectedWriteOffChat) return;
        
        console.log('⭐ [handleCreateWriteOffSubmit] Начало создания/обновления списания');
        
        try {
            // Режим редактирования
            if (editingItemId) {
                console.log('⭐ Обновление существующего списания:', { 
                    id: editingItemId,
                    name, 
                    reason: reason.id, 
                    quantity,
                    description,
                    unitType
                });
                
                const updatedItem = await dispatch(updateWriteOffItem({
                    chatId: selectedWriteOffChat.chat_id,
                    itemId: editingItemId,
                    name,
                    reason,
                    quantity,
                    description,
                    unitType
                })).unwrap();
                
                // Обновляем UI инициатора без ожидания WebSocket
                // Это обеспечит мгновенную обратную связь
                setWriteOffItems(prevItems => {
                    const newItems = prevItems.map(item => 
                        item.id === editingItemId ? updatedItem : item
                    );
                    
                    // После обновления состояния, пытаемся найти элемент в DOM для анимации
                    setTimeout(() => {
                        const updatedElement = document.querySelector(`[data-write-off-id="${editingItemId}"]`);
                        if (updatedElement) {
                            animateItemUpdate(updatedElement as HTMLElement);
                        }
                    }, 50);
                    
                    return newItems;
                });
                
                // Сбрасываем режим редактирования
                setEditingItemId(null);
            }
            // Режим создания
            else {
                console.log('⭐ Создание нового списания:', { 
                    name, 
                    reason: reason.id, 
                    quantity,
                    description,
                    chat: selectedWriteOffChat.chat_title,
                    unitType
                });
                
                const newItem = await dispatch(createWriteOffItem({
                    chatId: selectedWriteOffChat.chat_id,
                    name,
                    reason,
                    quantity,
                    description,
                    unitType
                })).unwrap();
                
                // Обновляем UI инициатора без ожидания WebSocket
                if (newItem) {
                    setWriteOffItems(prevItems => {
                        // Убедимся, что элемент еще не существует в списке
                        if (prevItems.some(item => item.id === newItem.id)) {
                            return prevItems;
                        }
                        
                        const newItems = [...prevItems, newItem];
                        
                        // После обновления состояния, пытаемся найти элемент в DOM для анимации
                        setTimeout(() => {
                            const newElement = document.querySelector(`[data-write-off-id="${newItem.id}"]`);
                            if (newElement) {
                                animateNewItem(newElement as HTMLElement);
                            }
                        }, 50);
                        
                        return newItems;
                    });
                }
            }
            
            console.log('✅ [handleCreateWriteOffSubmit] Успешное создание/обновление списания');
            
            // Сбрасываем локальное состояние но НЕ закрываем модальное окно
            // это будет сделано через компонент CreateWriteOffModal
            setWriteOffName('');
            setSelectedReason(null);
            setWriteOffQuantity(0);
            setWriteOffDescription('');
            setWriteOffUnitType('шт');
            
        } catch (error) {
            console.error('❌ Ошибка при создании/обновлении списания:', error);
            alert('Произошла ошибка. Пожалуйста, попробуйте еще раз.');
        }
    };

    // Добавляем useEffect для отслеживания открытия модального окна
    useEffect(() => {
        console.log('🔄 [EFFECT] Изменение состояния модального окна:', {
            isOpen: isCreateWriteOffModalOpen,
            editingItemId,
            name: writeOffName,
            reasonId: selectedReason?.id,
            quantity: writeOffQuantity
        });
        
        // Если модальное окно открыто, проверяем состояние формы
        if (isCreateWriteOffModalOpen) {
            console.log('✅ [EFFECT] Состояние формы при открытии модального окна:', {
                name: writeOffName,
                reason: selectedReason,
                quantity: writeOffQuantity,
                description: writeOffDescription,
                unitType: writeOffUnitType,
                isEditMode: !!editingItemId
            });
            
            // Проверяем, что все необходимые данные для редактирования существуют
            if (editingItemId && (!writeOffName || !selectedReason)) {
                console.error('❌ [EFFECT] Ошибка: неполные данные для редактирования элемента:', {
                    editingItemId,
                    name: writeOffName,
                    reason: selectedReason
                });
            }
        }
    }, [isCreateWriteOffModalOpen, editingItemId, writeOffName, selectedReason, writeOffQuantity, writeOffDescription, writeOffUnitType]);
    
    // Обновляем функцию закрытия модального окна для лучшей диагностики
    const handleCloseCreateWriteOffModal = useCallback(() => {
        console.log('🔄 [handleCloseCreateWriteOffModal] Закрытие модального окна списания, текущие данные:', {
            editingItemId,
            name: writeOffName,
            reason: selectedReason?.title
        });
        
        // Закрываем модальное окно
        setIsCreateWriteOffModalOpen(false);
        
        // Сбрасываем локальное состояние
        setWriteOffName('');
        setSelectedReason(null);
        setWriteOffQuantity(0);
        setWriteOffDescription('');
        setWriteOffUnitType('шт');
        setEditingItemId(null);
        
        console.log('✅ [handleCloseCreateWriteOffModal] Состояние сброшено после закрытия модального окна');
        
        // Сбрасываем Redux-состояние модального окна
        dispatch(resetModal());
    }, [dispatch, editingItemId, writeOffName, selectedReason]);

    // Проверка наличия элементов списания для генерации документа
    const hasWriteOffItems = writeOffItems && writeOffItems.length > 0;

    // Преобразуем ChatInventory в Chat для Footer
    const chatForFooter: Chat | null = selectedChat ? {
        id: selectedChat.chat_id,
        name: selectedChat.chat_title,
        type: 'group',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    } : null;

    // Обработчик для кнопки "Создать" в футере
    const handleFooterCreateClick = () => {
        if (writeOffName && selectedReason) {
            handleCreateWriteOffSubmit(writeOffName, selectedReason, writeOffQuantity, writeOffDescription, writeOffUnitType);
        } else {
            // Если не все поля заполнены, фокусируемся на контейнере создания
            // Здесь можно добавить дополнительную логику, например, показать уведомление
            setIsCreateWriteOffModalOpen(true);
        }
    };

    // Обработчик для установки имени списания
    const handleWriteOffNameChange = useCallback((name: string) => {
        console.log('📝 [handleWriteOffNameChange] Новое имя:', name);
        setWriteOffName(name);
    }, []);

    // Обработчик для установки причины списания
    const handleWriteOffReasonChange = useCallback((reason: WriteOffReason) => {
        console.log('📝 [handleWriteOffReasonChange] Новая причина:', reason.title);
        setSelectedReason(reason);
    }, []);

    // Обработчик для установки количества
    const handleWriteOffQuantityChange = useCallback((quantity: number) => {
        console.log('📝 [handleWriteOffQuantityChange] Новое количество:', quantity);
        setWriteOffQuantity(quantity);
    }, []);

    // Обработчик для установки описания
    const handleWriteOffDescriptionChange = useCallback((description: string) => {
        console.log('📝 [handleWriteOffDescriptionChange] Новое описание:', description);
        setWriteOffDescription(description);
    }, []);

    // Обработчик для установки единицы измерения
    const handleWriteOffUnitTypeChange = useCallback((unitType: 'шт' | 'гр') => {
        console.log('📝 [handleWriteOffUnitTypeChange] Новая единица измерения:', unitType);
        setWriteOffUnitType(unitType);
    }, []);

    // Обработчик редактирования элемента списания
    const handleEditWriteOff = (item: WriteOffItem) => {
        console.log('✏️ [DEBUGGING] handleEditWriteOff вызван с элементом:', JSON.stringify(item, null, 2));
        
        // Проверяем, что все необходимые данные существуют
        if (!item) {
            console.error('❌ [DEBUGGING] Ошибка: элемент для редактирования отсутствует');
            return;
        }
        
        if (!item.id) {
            console.error('❌ [DEBUGGING] Ошибка: ID элемента отсутствует', item);
            return;
        }
        
        if (!item.reason) {
            console.error('❌ [DEBUGGING] Ошибка: причина списания отсутствует', item);
            return;
        }
        
        // Устанавливаем id элемента для редактирования
        setEditingItemId(item.id);
        console.log('✅ [DEBUGGING] Установлен editingItemId:', item.id);
        
        // Предзаполняем форму данными редактируемого элемента
        handleWriteOffNameChange(item.name);
        handleWriteOffReasonChange(item.reason);
        handleWriteOffQuantityChange(item.quantity);
        handleWriteOffDescriptionChange(item.description || '');
        handleWriteOffUnitTypeChange(item.unitType as 'шт' | 'гр');
        
        console.log('✅ [DEBUGGING] Форма предзаполнена данными элемента:', {
            name: item.name,
            reason: item.reason,
            quantity: item.quantity,
            description: item.description || '',
            unitType: item.unitType || 'шт'
        });
        
        // Открываем модальное окно
        console.log('🔄 [DEBUGGING] Открываем модальное окно для редактирования...');
        setIsCreateWriteOffModalOpen(true);
        
        // Проверяем состояние после открытия модального окна
        setTimeout(() => {
            console.log('🔍 [DEBUGGING] Состояние после открытия модального окна:', {
                isModalOpen: isCreateWriteOffModalOpen,
                editingItemId,
                writeOffName,
                selectedReason: selectedReason ? selectedReason.title : 'не выбрана',
                writeOffQuantity,
                writeOffDescription,
                writeOffUnitType
            });
        }, 100);
    };

    // Обработчик клонирования списания (новая функция)
    const handleCloneWriteOff = (item: WriteOffItem) => {
        console.log('🔄 [DEBUGGING] handleCloneWriteOff вызван с элементом:', JSON.stringify(item, null, 2));
        
        // Проверяем, что все необходимые данные существуют
        if (!item) {
            console.error('❌ [DEBUGGING] Ошибка: элемент для клонирования отсутствует');
            return;
        }
        
        if (!item.reason) {
            console.error('❌ [DEBUGGING] Ошибка: причина списания отсутствует', item);
            return;
        }
        
        // Сбрасываем ID редактирования, чтобы указать, что это создание нового элемента
        setEditingItemId(null);
        console.log('✅ [DEBUGGING] Сброшен editingItemId для клонирования');
        
        // Предзаполняем форму данными из оригинального элемента
        handleWriteOffNameChange(`${item.name} (копия)`);
        handleWriteOffReasonChange(item.reason);
        handleWriteOffQuantityChange(item.quantity);
        handleWriteOffDescriptionChange(item.description || '');
        handleWriteOffUnitTypeChange(item.unitType as 'шт' | 'гр');
        
        console.log('✅ [DEBUGGING] Форма предзаполнена данными для клонирования:', {
            name: `${item.name} (копия)`,
            reason: item.reason,
            quantity: item.quantity,
            description: item.description || '',
            unitType: item.unitType || 'шт'
        });
        
        // Открываем модальное окно
        console.log('🔄 [DEBUGGING] Открываем модальное окно для клонирования...');
        setIsCreateWriteOffModalOpen(true);
        
        // Проверяем состояние после открытия модального окна
        setTimeout(() => {
            console.log('🔍 [DEBUGGING] Состояние после открытия модального окна для клонирования:', {
                isModalOpen: isCreateWriteOffModalOpen,
                editingItemId,
                writeOffName,
                selectedReason: selectedReason ? selectedReason.title : 'не выбрана',
                writeOffQuantity,
                writeOffDescription,
                writeOffUnitType
            });
        }, 100);
    };

    // Обработчик удаления элемента списания
    const handleDeleteWriteOff = async (item: WriteOffItem) => {
        console.log('🗑️ Подготовка к удалению списания:', item);
        
        // Устанавливаем элемент для удаления
        setItemToDelete(item);
        
        // Открываем диалог подтверждения
        setDeleteDialogOpen(true);
    };
    
    // Обработчик для кнопки Отмена в диалоге подтверждения
    const handleCancelDelete = () => {
        setDeleteDialogOpen(false);
        setItemToDelete(null);
    };
    
    // Обработчик для кнопки Удалить в диалоге подтверждения
    const handleConfirmDelete = async () => {
        if (!itemToDelete || !selectedWriteOffChat) return;
        
        // Закрываем диалог
        setDeleteDialogOpen(false);
        
        // Запускаем анимацию удаления
        if (writeOffListRef.current) {
            writeOffListRef.current.startRemoveAnimation(itemToDelete.id);
        }
        
        // Показываем спиннер загрузки
        setIsDeletingItem(true);
        
        try {
            // Небольшая задержка для визуального эффекта
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Запоминаем ID удаляемого элемента
            const itemIdToDelete = itemToDelete.id;
            
            // Отправляем запрос на удаление в API через Redux-thunk
            await dispatch(deleteWriteOffItem({
                chatId: selectedWriteOffChat.chat_id,
                itemId: itemIdToDelete
            })).unwrap();
            
            // Используем локальное обновление списка у инициатора удаления
            setWriteOffItems(prevItems => 
                prevItems.filter(item => item.id !== itemIdToDelete)
            );
            
            // Отмечаем элемент как окончательно удаленный после успешного удаления
            if (writeOffListRef.current) {
                writeOffListRef.current.markItemAsPermanentlyRemoved(itemIdToDelete);
            }
            
            console.log('✅ Списание успешно удалено');
        } catch (error) {
            console.error('❌ Ошибка при удалении списания:', error);
            
            // Отменяем анимацию удаления
            if (writeOffListRef.current) {
                writeOffListRef.current.cancelRemoveAnimation(itemToDelete.id);
            }
            
            // Показываем сообщение об ошибке
            alert('Не удалось удалить списание. Пожалуйста, попробуйте еще раз.');
        } finally {
            // Скрываем спиннер загрузки
            setIsDeletingItem(false);
            setItemToDelete(null);
        }
    };

    // Обработчик для формирования документа акта списания
    const handleGenerateDocument = async () => {
        try {
            console.log('📄 [handleGenerateDocument] Начинаем формирование документа');
            setIsDocModalOpen(true);
            setIsGeneratingDocument(true);
            
            // Форматируем имя файла для документа
            const date = new Date();
            const formattedDate = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
            const fileName = `Акт_списания_${selectedChat?.chat_title?.replace(/\s+/g, '_')}_${formattedDate}.docx`;
            setDocumentName(fileName);
            
            // Готовим URL для запроса - ПРЯМОЙ URL ДЛЯ СКАЧИВАНИЯ
            const apiBase = config.API_URL.endsWith('/api') 
                ? config.API_URL
                : `${config.API_URL}/api`;
            
            // Проверяем наличие chat_id
            if (!selectedChat?.chat_id) {
                throw new Error('Отсутствует ID чата для формирования документа');
            }
            
            // Формируем данные для запроса
            const requestData = {
                chatId: selectedChat?.chat_id,
                chatTitle: selectedChat?.chat_title,
                date: new Date().toISOString(),
                items: writeOffItems.map(item => ({
                    id: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    reason: { 
                        id: item.reason.id,
                        title: item.reason.title
                    },
                    unitType: item.unitType || 'шт',
                    description: item.description || ''
                }))
            };
            
            // Кодируем данные для передачи в URL
            const encodedData = encodeURIComponent(JSON.stringify(requestData));
            
            // Формируем прямой URL с данными в параметре
            const uploadUrl = `${apiBase}/write-offs/generate-document?download=true&filename=${encodeURIComponent(fileName)}&data=${encodedData}`;
            
            // Для POST запроса используем базовый URL
            const postUrl = `${apiBase}/write-offs/generate-document`;
            
            // Сохраняем URL и данные для модального окна
            setDocumentUrl(postUrl);
            // Сохраняем оригинальные данные запроса для форм
            const formData = {
                download: 'true',
                filename: fileName,
                data: JSON.stringify(requestData)
            };
            
            // Устанавливаем данные формы в window для доступа из модального окна
            (window as any).__writeOffFormData = formData;
            
            // Проверяем, есть ли специальный обработчик в Telegram WebApp
            const isTelegramWebApp = !!(window as any).Telegram?.WebApp;
            console.log(`📄 [handleGenerateDocument] Выполняется в Telegram WebApp: ${isTelegramWebApp}`);
            
            // Логируем URL и данные для отладки
            console.log(`📄 [handleGenerateDocument] Данные формы:`, formData);
            console.log(`📄 [handleGenerateDocument] URL для скачивания:`, postUrl);
            
            // Отключаем индикатор загрузки и показываем модальное окно
            setIsGeneratingDocument(false);
            
            // Раньше здесь мы отправляли форму автоматически, но это может вызывать проблемы в Telegram WebApp
            // Теперь скачивание будет инициироваться пользователем через кнопку в модальном окне
            // с использованием метода handleDownload в DocGenerationModal
            
        } catch (err: any) {
            const error = err as Error;
            console.error('❌ [handleGenerateDocument] Ошибка при формировании документа:', error);
            alert(`Произошла ошибка при формировании документа: ${error.message}. Пожалуйста, попробуйте еще раз.`);
            setIsDocModalOpen(false);
            setIsGeneratingDocument(false);
        }
    };

    // Обработчик закрытия модального окна генерации документа
    const handleCloseDocModal = React.useCallback(() => {
        console.log('📋 [handleCloseDocModal] Закрытие модального окна документа');
        setIsDocModalOpen(false);
        setDocumentUrl(null);
    }, []);

    // Логирование состояния валидации полей
    useEffect(() => {
        console.log('Состояние валидации для кнопки создания:', {
            writeOffName,
            hasName: !!writeOffName,
            selectedReason,
            hasReason: !!selectedReason,
            isActive: !!(writeOffName && selectedReason)
        });
    }, [writeOffName, selectedReason]);

    useEffect(() => {
        const initializeData = async () => {
            setIsLoading(true);
            
            // Имитация прогресса загрузки
            const interval = setInterval(() => {
                setLoadingProgress(prev => {
                    if (prev >= 90) {
                        clearInterval(interval);
                        return prev;
                    }
                    return prev + 10;
                });
            }, 300);
            
            try {
                await dispatch(initializeFromTelegram()).unwrap();
                await dispatch(fetchWriteOffChats()).unwrap();
                
                // Анимация появления контента
                controls.start({
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.5, delay: 0.2 }
                });
                
            } catch (error) {
                console.error('Ошибка при инициализации данных:', error);
            } finally {
                clearInterval(interval);
                setLoadingProgress(100);
                
                // Небольшая задержка перед скрытием загрузки
                setTimeout(() => {
                    setIsLoading(false);
                }, 300);
            }
        };
        
        initializeData();
    }, [dispatch, controls]);

    // Альтернативный способ скачивания через POST форму
    const handleAlternativeDocDownload = () => {
        try {
            console.log('📄 [handleAlternativeDocDownload] Используем альтернативное скачивание через POST форму');
            
            if (!documentUrl) {
                throw new Error('URL документа отсутствует');
            }
            
            // Получаем данные формы
            const formData = (window as any).__writeOffFormData || {};
            
            // Создаем форму для POST запроса
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = documentUrl;
            form.target = '_blank';
            form.style.display = 'none';
            
            // Добавляем все параметры из формы
            Object.entries(formData).forEach(([key, value]) => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = value as string;
                form.appendChild(input);
            });
            
            // Явно добавляем параметры скачивания
            const downloadInput = document.createElement('input');
            downloadInput.type = 'hidden';
            downloadInput.name = 'download';
            downloadInput.value = 'true';
            form.appendChild(downloadInput);
            
            const forceDownloadInput = document.createElement('input');
            forceDownloadInput.type = 'hidden';
            forceDownloadInput.name = 'force_download';
            forceDownloadInput.value = 'true';
            form.appendChild(forceDownloadInput);
            
            const timestampInput = document.createElement('input');
            timestampInput.type = 'hidden';
            timestampInput.name = '_t';
            timestampInput.value = Date.now().toString();
            form.appendChild(timestampInput);
            
            // Добавляем форму в DOM и отправляем
            document.body.appendChild(form);
            console.log('📄 [handleAlternativeDocDownload] Отправляем POST форму...');
            form.submit();
            
            // Удаляем форму из DOM
            setTimeout(() => {
                document.body.removeChild(form);
            }, 100);
            
        } catch (error: any) {
            console.error('❌ [handleAlternativeDocDownload] Ошибка при альтернативном скачивании:', error);
            alert(`Ошибка при скачивании документа: ${error.message}. Пожалуйста, попробуйте еще раз.`);
        }
    };

    if (!user.id || isLoading || isChatsLoading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingWrapper}>
                    {[1, 2, 3].map((item) => (
                        <div key={item} className={styles.skeletonItem}>
                            <Skeleton 
                                variant="rectangular" 
                                className={styles.skeletonHeader}
                                animation="wave"
                            />
                            <div className={styles.skeletonContent}>
                                <Skeleton 
                                    variant="text" 
                                    className={styles.skeletonText}
                                    animation="wave"
                                />
                                <Skeleton 
                                    variant="text" 
                                    className={styles.skeletonText}
                                    animation="wave"
                                />
                            </div>
                        </div>
                    ))}
                    
                    {/* Индикатор прогресса загрузки */}
                    <motion.div 
                        style={{ 
                            width: '200px', 
                            height: '4px', 
                            background: 'rgba(255, 95, 31, 0.2)',
                            borderRadius: '2px',
                            marginTop: '2rem',
                            overflow: 'hidden',
                            position: 'relative'
                        }}
                    >
                        <motion.div 
                            style={{ 
                                height: '100%', 
                                background: 'var(--orange-primary)',
                                borderRadius: '2px',
                                position: 'absolute',
                                left: 0,
                                top: 0
                            }}
                            initial={{ width: '0%' }}
                            animate={{ width: `${loadingProgress}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    </motion.div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.container}>
                <div className={styles.errorWrapper}>
                    <ErrorOutlineIcon className={styles.errorIcon} />
                    <Typography variant="h6" className={styles.errorTitle}>
                        Ошибка
                    </Typography>
                    <Typography variant="body1" className={styles.errorMessage}>
                        Произошла ошибка при загрузке данных. Пожалуйста, попробуйте еще раз.
                    </Typography>
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <Button 
                            variant="contained" 
                            color="primary" 
                            startIcon={<RefreshIcon />}
                            onClick={handleRetry}
                            sx={{ 
                                mt: 2, 
                                background: 'var(--gradient-primary)',
                                boxShadow: '0 4px 10px rgba(255, 95, 31, 0.3)',
                                '&:hover': {
                                    boxShadow: '0 6px 15px rgba(255, 95, 31, 0.4)'
                                }
                            }}
                        >
                            Повторить
                        </Button>
                    </motion.div>
                </div>
            </div>
        );
    }

    return (
        <motion.div 
            className={styles.writeOffContainer}
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
        >
            {selectedChat ? (
                <>
                    <div ref={headerRef} className={styles.header}>
                        <AppHeader
                            title="Списания"
                            mode="writeoff"
                            progress={loadingProgress}
                            isLoading={isLoading}
                        />
                    </div>

                    <div ref={listContainerRef} className={styles.content}>
                        <motion.div 
                            className={`${styles.mainSection} ${styles.withHeaderAndFooter}`}
                            animate={controls}
                        >
                            <motion.div 
                                className={styles.writeOffContent}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.5 }}
                            >
                                {writeOffItems.length === 0 ? (
                                    <EmptyWriteOff
                                        branchName={branchName}
                                        onCreateWriteOff={handleCreateWriteOff}
                                    />
                                ) : (
                                    <motion.div 
                                        className={styles.writeOffItems}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.5, delay: 0.3 }}
                                    >
                                        <WriteOffList 
                                            items={writeOffItems}
                                            onEdit={handleEditWriteOff}
                                            onDelete={handleDeleteWriteOff}
                                            onClone={handleCloneWriteOff}
                                            onAddNew={handleCreateWriteOff}
                                            ref={writeOffListRef}
                                        />
                                    </motion.div>
                                )}
                            </motion.div>
                        </motion.div>
                    </div>
                </>
            ) : (
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className={styles.chatSelectorWrapper}
                >
                    {chats && chats.length > 0 ? (
                        <ChatSelector
                            chats={chats}
                            onChatSelect={handleChatSelect}
                            mode="write-off"
                        />
                    ) : (
                        <div className={styles.noChatsMessage}>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3, duration: 0.5 }}
                                className={styles.noChatsContent}
                            >
                                <Typography variant="h5" className={styles.noChatsTitle}>
                                    Нет доступных чатов
                                </Typography>
                                <Typography variant="body1" className={styles.noChatsSubtitle}>
                                    У вас нет доступа к чатам для списания товаров
                                </Typography>
                                <Button 
                                    variant="contained" 
                                    color="primary" 
                                    startIcon={<RefreshIcon />}
                                    onClick={handleRetry}
                                    className={styles.refreshButton}
                                >
                                    Обновить список
                                </Button>
                            </motion.div>
                        </div>
                    )}
                </motion.div>
            )}

            <AnimatePresence>
                {chatForFooter && (
                    <motion.div 
                        className="footer-container"
                        initial={{ y: 100 }}
                        animate={{ y: 0 }}
                        exit={{ y: 100 }}
                        transition={{ 
                            type: "spring", 
                            stiffness: 400, 
                            damping: 30
                        }}
                    >
                        <Footer
                            selectedChat={chatForFooter}
                            onBack={handleBackToChats}
                            onChatSelect={handleModalClose}
                            showCreateButton={isCreateWriteOffModalOpen}
                            onCreateClick={handleFooterCreateClick}
                            isCreateButtonActive={!!(writeOffName && selectedReason)}
                            createButtonText={editingItemId ? 'Обновить' : 'Создать'}
                            showGenerateDocButton={!!selectedChat && !isCreateWriteOffModalOpen}
                            onGenerateDocClick={handleGenerateDocument}
                            isGeneratingDocument={isGeneratingDocument}
                            hasWriteOffItems={hasWriteOffItems}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Модальное окно выбора чата */}
            <ChatModal
                open={isModalOpen}
                onClose={handleModalClose}
                onStartInventory={handleStartWriteOff}
                chat={selectedChatForModal as WriteOffChat}
                isAdmin={!!selectedWriteOffChat}
                mode="write-off"
            />
            
            {/* Модальное окно подтверждения удаления */}
            <Dialog
                open={deleteDialogOpen}
                onClose={handleCancelDelete}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
                PaperProps={{
                    style: {
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden',
                        background: 'transparent',
                        boxShadow: 'none',
                        margin: '0 auto',
                        maxWidth: '100%'
                    }
                }}
                fullWidth={false}
                maxWidth="xs"
                className={styles.deleteDialog}
            >
                <div className={styles.deleteDialogContent}>
                    <div className={styles.deleteDialogIcon}>
                        <DeleteOutlineIcon />
                    </div>
                    <Typography variant="h6" className={styles.deleteDialogTitle}>
                        Подтверждение удаления
                    </Typography>
                    <Typography variant="body1" className={styles.deleteDialogMessage}>
                        Вы уверены, что хотите удалить списание <strong>"{itemToDelete?.name}"</strong>?
                        <br />
                        Это действие нельзя будет отменить.
                    </Typography>
                    <div className={styles.deleteDialogActions}>
                        <Button 
                            onClick={handleCancelDelete} 
                            className={styles.cancelButton}
                        >
                            Отмена
                        </Button>
                        <Button 
                            onClick={handleConfirmDelete} 
                            className={styles.deleteButton}
                            autoFocus
                        >
                            Удалить
                        </Button>
                    </div>
                </div>
            </Dialog>
            
            {/* Спиннер удаления элемента */}
            <Dialog
                open={isDeletingItem}
                PaperProps={{
                    style: {
                        backgroundColor: 'transparent',
                        boxShadow: 'none',
                        overflow: 'hidden',
                        margin: '0 auto',
                        maxWidth: '100%'
                    }
                }}
                fullWidth={false}
                maxWidth="xs"
                className={styles.spinnerDialog}
            >
                <div className={styles.spinnerContainer}>
                    <div className={styles.spinnerWrapper}>
                        <CircularProgress className={styles.spinner} size={56} />
                    </div>
                    <Typography variant="body1" className={styles.spinnerText}>
                        Удаление<span className={styles.dots}></span>
                    </Typography>
                </div>
            </Dialog>
            
            {/* Выдвижной контейнер создания списания */}
            <AnimatePresence>
                {isCreateWriteOffModalOpen && (
                    <CreateWriteOffModal
                        isOpen={isCreateWriteOffModalOpen}
                        onClose={handleCloseCreateWriteOffModal}
                        onSubmit={handleCreateWriteOffSubmit}
                        initialName={writeOffName}
                        initialReason={selectedReason}
                        initialQuantity={writeOffQuantity}
                        initialDescription={writeOffDescription}
                        initialUnitType={writeOffUnitType}
                        onNameChange={handleWriteOffNameChange}
                        onReasonChange={handleWriteOffReasonChange}
                        onQuantityChange={handleWriteOffQuantityChange}
                        onDescriptionChange={handleWriteOffDescriptionChange}
                        onUnitTypeChange={handleWriteOffUnitTypeChange}
                        isEditMode={!!editingItemId}
                    />
                )}
            </AnimatePresence>
            
            {/* Модальное окно генерации документа */}
            <DocGenerationModal 
                isOpen={isDocModalOpen}
                onClose={handleCloseDocModal}
                documentUrl={documentUrl}
                documentName={documentName}
                isLoading={isGeneratingDocument}
                onError={handleAlternativeDocDownload}
            />
        </motion.div>
    );
};

export default WriteOff; 
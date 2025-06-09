// @ts-nocheck
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Inventory from '@features/Inventory/Inventory';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';
import { fetchInventory, selectInventoryChats, selectInventoryLoading, selectInventoryError } from '@/store/slices/inventorySlice';
import { selectActiveRole, selectUser } from '@/shared/store/userSlice/userSelectors';

const InventoryPage: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const dispatch = useAppDispatch();
  const chats = useAppSelector(selectInventoryChats);
  const isLoading = useAppSelector(selectInventoryLoading);
  const error = useAppSelector(selectInventoryError);
  const activeRole = useAppSelector(selectActiveRole);
  const user = useAppSelector(selectUser);

  useEffect(() => {
    if (activeRole === 'chef' && user?.id && chats.length === 0 && !isLoading && !error) {
      dispatch(fetchInventory({ userId: user.id, role: 'chef' }));
    }
  }, [activeRole, user?.id, chats.length, isLoading, error, dispatch]);

  return (
    <div className="inventory-page">
      <Inventory chatId={chatId} />
    </div>
  );
};

export default InventoryPage; 
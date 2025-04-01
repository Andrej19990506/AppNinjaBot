// @ts-nocheck
import React from 'react';
import { useParams } from 'react-router-dom';
import Inventory from '../components/Inventory/Inventory';

const InventoryPage: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  
  return (
    <div className="inventory-page">
      <Inventory chatId={chatId} />
    </div>
  );
};

export default InventoryPage; 
import api from './api';
import config from '../config';
import inventoryTemplate from '../data/inventoryTemplate.json';

class InventoryService {
    constructor() {
        this.pendingChanges = new Map();
        this.syncTimeout = null;
    }

    // Получение инвентаря
    async getInventory(chatId) {
        try {
            // Сначала проверяем локальное хранилище
            const cachedData = localStorage.getItem(`inventory_${chatId}`);
            if (cachedData) {
                return JSON.parse(cachedData);
            }

            // Пытаемся получить с сервера
            try {
                const response = await api.get(`/inventory/${chatId}`);
                const inventory = response.data;
                
                // Проверяем валидность данных
                if (this.isValidInventory(inventory)) {
                    localStorage.setItem(`inventory_${chatId}`, JSON.stringify(inventory));
                    return inventory;
                }
            } catch (error) {
                console.error('Ошибка получения инвентаря:', error);
            }

            // Если нет данных или они невалидны, возвращаем шаблон
            return this.getNewInventory();
        } catch (error) {
            if (error.offline) {
                const cachedData = localStorage.getItem(`inventory_${chatId}`);
                if (cachedData) {
                    return JSON.parse(cachedData);
                }
                return this.getNewInventory();
            }
            throw error;
        }
    }

    // Создание нового инвентаря из шаблона
    getNewInventory() {
        return JSON.parse(JSON.stringify(inventoryTemplate));
    }

    // Проверка валидности структуры инвентаря
    isValidInventory(inventory) {
        if (!inventory || typeof inventory !== 'object') return false;

        // Проверяем соответствие структуры шаблону
        for (const category in inventoryTemplate) {
            if (!inventory[category]) return false;

            for (const item in inventoryTemplate[category]) {
                if (!inventory[category][item]) return false;

                for (const type in inventoryTemplate[category][item]) {
                    if (!inventory[category][item][type] ||
                        typeof inventory[category][item][type].quantity !== 'number' ||
                        typeof inventory[category][item][type].filled !== 'boolean') {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    // Сохранение инвентаря
    async saveInventory({ chatId, inventory }) {
        try {
            // Сохраняем локально
            localStorage.setItem(`inventory_${chatId}`, JSON.stringify(inventory));

            // В разработке добавляем задержку
            if (config.DEBUG) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Отправляем на сервер
            await api.post(`/inventory/${chatId}`, { inventory });

            return true;
        } catch (error) {
            if (error.offline) {
                // Если офлайн, добавляем в очередь для синхронизации
                this.pendingChanges.set(chatId, inventory);
                return true;
            }
            throw error;
        }
    }

    // Синхронизация с сервером
    async syncWithServer() {
        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
        }

        this.syncTimeout = setTimeout(async () => {
            if (!navigator.onLine) return;

            for (const [chatId, inventory] of this.pendingChanges) {
                try {
                    await api.post(`/inventory/${chatId}`, { inventory });
                    this.pendingChanges.delete(chatId);
                } catch (error) {
                    console.error('Sync error:', error);
                }
            }
        }, config.AUTO_SAVE_DELAY);
    }
}

export default new InventoryService(); 
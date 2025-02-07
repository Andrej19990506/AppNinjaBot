import api from './api';
import config from '../config';

class InventoryService {
    constructor() {
        this.pendingChanges = new Map();
        this.syncTimeout = null;
        this.templateCache = null;
        this.templateLastFetch = null;
    }

    async getInventory(chatId) {
        try {
            console.log('=== Получение инвентаря ===');
            console.log('Chat ID:', chatId);
            
            // Сначала пытаемся получить данные с сервера
            try {
                console.log('Загружаем инвентарь с сервера...');
                const response = await fetch(`${config.API_URL}/inventory/${chatId}`);
                if (response.ok) {
                    const data = await response.json();
                    console.log('Получены данные с сервера:', data);
                    
                    if (data && data.inventory) {
                        // Сохраняем полученные данные в CloudStorage
                        try {
                            await window.Telegram.WebApp.CloudStorage.setItem(
                                `inventory_${chatId}`, 
                                JSON.stringify(data)
                            );
                        } catch (e) {
                            console.error('Ошибка при сохранении в CloudStorage:', e);
                        }
                        
                        return data;
                    }
                }
            } catch (e) {
                console.error('Ошибка при получении данных с сервера:', e);
            }
            
            // Если не удалось получить данные с сервера, пробуем CloudStorage
            try {
                console.log('Пытаемся получить данные из CloudStorage...');
                const cachedData = await window.Telegram.WebApp.CloudStorage.getItem(`inventory_${chatId}`);
                console.log('Данные из CloudStorage:', cachedData);
                
                if (cachedData) {
                    const parsed = JSON.parse(cachedData);
                    console.log('Распарсенные данные:', parsed);
                    
                    if (parsed && parsed.inventory && parsed.metadata) {
                        console.log('Найдены валидные данные в CloudStorage');
                        return parsed;
                    }
                }
                console.log('Данные в CloudStorage отсутствуют или невалидны');
            } catch (e) {
                console.error('Ошибка при получении данных из CloudStorage:', e);
            }

            // Если нигде нет данных, создаем новый инвентарь из шаблона
            console.log('Создаем новый инвентарь из шаблона...');
            const template = await this.getNewInventory();
            console.log('Получен шаблон:', template);
            
            const wrappedTemplate = {
                inventory: template,
                metadata: {
                    lastUpdated: new Date().toISOString(),
                    progress: 0
                }
            };
            console.log('Подготовленный шаблон:', wrappedTemplate);
            
            try {
                console.log('Сохраняем шаблон в CloudStorage...');
                await window.Telegram.WebApp.CloudStorage.setItem(
                    `inventory_${chatId}`, 
                    JSON.stringify(wrappedTemplate)
                );
                console.log('Шаблон успешно сохранен в CloudStorage');
            } catch (e) {
                console.error('Ошибка при сохранении в CloudStorage:', e);
            }
            
            return wrappedTemplate;
        } catch (error) {
            console.error('Критическая ошибка при получении инвентаря:', error);
            throw error;
        }
    }

    // Создание нового инвентаря из шаблона
    async getNewInventory() {
        try {
            console.log('=== Загрузка шаблона с сервера ===');
            const url = `${config.API_URL}/templates/inventory_template`;
            console.log('URL запроса:', url);
            
            const response = await fetch(url);
            console.log('Статус ответа:', response.status);
            
            if (!response.ok) {
                console.error('Ошибка при загрузке шаблона:', response.status, response.statusText);
                throw new Error('Failed to fetch template');
            }
            
            const template = await response.json();
            console.log('Получен шаблон с сервера:', template);

            // Создаем новый инвентарь, точно копируя структуру шаблона
            const newInventory = {};
            for (const [category, items] of Object.entries(template)) {
                newInventory[category] = {};
                for (const [itemName, itemData] of Object.entries(items)) {
                    newInventory[category][itemName] = {};
                    
                    // Копируем только существующие типы
                    if (itemData.raw) {
                        newInventory[category][itemName].raw = {
                            quantity: 0,
                            filled: false
                        };
                    }
                    
                    // Добавляем semifinished только если он есть в шаблоне
                    if (itemData.semifinished) {
                        newInventory[category][itemName].semifinished = {
                            quantity: 0,
                            filled: false
                        };
                    }
                }
            }

            return newInventory;
        } catch (error) {
            console.error('Error fetching inventory template:', error);
            throw error;
        }
    }

    async saveInventory(chatId, data) {
        try {
            // Очищаем данные перед сохранением
            const cleanedData = {
                inventory: {},
                metadata: data.metadata
            };

            // Проходим по всем категориям и товарам
            Object.entries(data.inventory).forEach(([category, items]) => {
                cleanedData.inventory[category] = {};
                
                Object.entries(items).forEach(([itemName, itemData]) => {
                    cleanedData.inventory[category][itemName] = {};
                    
                    // Добавляем только существующие типы с данными
                    if (itemData.raw && typeof itemData.raw === 'object') {
                        cleanedData.inventory[category][itemName].raw = {
                            quantity: Number(itemData.raw.quantity) || 0,
                            filled: Boolean(itemData.raw.quantity > 0)
                        };
                    }
                    
                    if (itemData.semifinished && 
                        typeof itemData.semifinished === 'object' && 
                        'quantity' in itemData.semifinished) {
                        cleanedData.inventory[category][itemName].semifinished = {
                            quantity: Number(itemData.semifinished.quantity) || 0,
                            filled: Boolean(itemData.semifinished.quantity > 0)
                        };
                    }
                });
            });

            console.log('Сохраняем очищенные данные:', cleanedData);

            const response = await fetch(`${config.API_URL}/inventory/${chatId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(cleanedData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                const error = new Error('Failed to save inventory');
                error.status = response.status;
                error.data = errorData;
                throw error;
            }
            
            try {
                await window.Telegram.WebApp.CloudStorage.setItem(
                    `inventory_${chatId}`, 
                    JSON.stringify(cleanedData)
                );
            } catch (e) {
                console.error('Ошибка при сохранении в CloudStorage:', e);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error saving inventory:', error);
            throw error;
        }
    }

    // Проверка валидности структуры инвентаря
    isValidInventory(inventory) {
        if (!inventory || typeof inventory !== 'object') {
            console.log('Инвентарь отсутствует или не является объектом');
            return false;
        }

        // Проверяем, есть ли хотя бы одна категория
        const categories = Object.entries(inventory)
            .filter(([key, value]) => 
                key !== 'metadata' && 
                typeof value === 'object' && 
                value !== null
            );

        if (categories.length === 0) {
            console.log('Нет категорий в инвентаре');
            return false;
        }

        // Проверяем структуру каждой категории
        for (const [category, items] of categories) {
            if (typeof items !== 'object') {
                console.log(`Категория ${category} имеет неверный формат`);
                return false;
            }

            for (const [item, types] of Object.entries(items)) {
                if (typeof types !== 'object') {
                    console.log(`Товар ${item} в категории ${category} имеет неверный формат`);
                    return false;
                }

                // Проверяем только тип raw
                const rawData = types['raw'];
                if (!rawData || 
                    typeof rawData !== 'object' ||
                    typeof rawData.quantity !== 'number') {
                    console.log(`Тип raw для товара ${item} в категории ${category} имеет неверный формат`);
                    return false;
                }
            }
        }

        console.log('Структура инвентаря валидна');
        return true;
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

    // Получение и кэширование шаблона
    async getTemplate(forceRefresh = false) {
        // Если кэш актуален (не старше 5 минут) и не требуется принудительное обновление
        if (!forceRefresh && this.templateCache && this.templateLastFetch && 
            (Date.now() - this.templateLastFetch) < 300000) {
            return this.templateCache;
        }

        try {
            const response = await fetch(`${config.API_URL}/templates/inventory_template`);
            if (!response.ok) {
                throw new Error('Failed to fetch template');
            }
            
            const template = await response.json();
            this.templateCache = template;
            this.templateLastFetch = Date.now();
            return template;
        } catch (error) {
            console.error('Error fetching template:', error);
            throw error;
        }
    }

    // Проверка наличия полуфабриката в шаблоне
    async hasSemifinishedInTemplate(category, item) {
        try {
            const template = await this.getTemplate();
            return template[category]?.[item]?.semifinished !== undefined;
        } catch (error) {
            console.error('Error checking semifinished in template:', error);
            return false;
        }
    }

    // Обновление шаблона при добавлении полуфабриката
    async updateTemplateWithSemifinished(category, item) {
        try {
            console.log('=== Обновление шаблона с полуфабрикатом ===');
            console.log('Категория:', category);
            console.log('Товар:', item);

            const response = await fetch(`${config.API_URL}/templates/inventory_template`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    category,
                    item,
                    action: 'add_semifinished'
                })
            });

            const data = await response.json();
            console.log('Ответ сервера:', data);

            if (!response.ok) {
                const error = new Error(data.error || 'Failed to update template');
                error.status = response.status;
                error.details = data;
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Error updating template:', error);
            console.error('Error details:', error.details);
            throw error;
        }
    }

    async removeSemifinishedFromTemplate(category, item) {
        try {
            console.log('=== Удаление полуфабриката из шаблона ===');
            console.log('Категория:', category);
            console.log('Товар:', item);

            const response = await fetch(`${config.API_URL}/templates/inventory_template`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    category,
                    item,
                    action: 'remove_semifinished'
                })
            });

            const data = await response.json();
            console.log('Ответ сервера:', data);

            if (!response.ok) {
                const error = new Error(data.error || 'Failed to update template');
                error.status = response.status;
                error.details = data;
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Error removing semifinished from template:', error);
            console.error('Error details:', error.details);
            throw error;
        }
    }
}

export default new InventoryService(); 
import inventoryService from '../services/inventoryService';

// Получение списка категорий из инвентаря
export const getCategories = (inventory) => {
    if (!inventory) return [];
    
    // Исключаем служебные поля
    const serviceFields = ['metadata', 'id', 'chat_id', 'created_at', 'updated_at'];
    
    return Object.entries(inventory)
        .filter(([key, value]) => 
            !serviceFields.includes(key) && 
            typeof value === 'object' && 
            value !== null
        )
        .map(([key]) => key);
};

// Получение списка товаров в категории
export const getItems = (inventory, category) => {
    if (!inventory || !category || !inventory[category]) return [];
    return Object.keys(inventory[category]);
};

// Получение типов для товара (raw, semifinished)
export const getTypes = async (inventory, category, item) => {
    console.log('=== getTypes вызван ===');
    console.log('Параметры:', { category, item });
    
    if (!inventory || !category || !item || !inventory[category]?.[item]) {
        console.log('Ранний выход: отсутствуют необходимые данные');
        return ['raw'];
    }
    
    const itemData = inventory[category][item];
    console.log('Данные товара:', itemData);
    
    const types = ['raw']; // raw тип всегда доступен
    
    try {
        // Проверяем наличие полуфабриката в шаблоне
        const hasSemifinished = await inventoryService.hasSemifinishedInTemplate(category, item);
        console.log('Наличие полуфабриката в шаблоне:', hasSemifinished);
        
        if (hasSemifinished) {
            types.push('semifinished');
        }
    } catch (error) {
        console.error('Ошибка при проверке полуфабриката в шаблоне:', error);
    }
    
    console.log('Итоговые типы:', types);
    return types;
};

// Расчет прогресса инвентаризации
export const calculateProgress = async (inventory) => {
    if (!inventory) return 0;

    let filledCount = 0;
    let totalCount = 0;

    console.log('=== Расчет прогресса инвентаризации ===');

    // Исключаем служебные поля
    const categories = getCategories(inventory);
    console.log('Найденные категории:', categories);

    for (const category of categories) {
        const items = getItems(inventory, category);
        
        for (const item of items) {
            const types = await getTypes(inventory, category, item); // Используем await
            
            for (const type of types) {
                const itemData = inventory[category][item][type];
                if (itemData) {
                    totalCount++;
                    // Обновляем quantity и filled
                    itemData.quantity = Number(itemData.quantity) || 0;
                    const wasFilled = itemData.filled;
                    itemData.filled = itemData.quantity > 0;
                    
                    if (itemData.filled) {
                        filledCount++;
                        if (!wasFilled) {
                            console.log(`[${category}][${item}][${type}] теперь заполнено (${itemData.quantity})`);
                        }
                    } else if (wasFilled) {
                        console.log(`[${category}][${item}][${type}] больше не заполнено (${itemData.quantity})`);
                    }
                }
            }
        }
    }

    const progress = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;
    console.log('Итоги расчета прогресса:', {
        totalCount,
        filledCount,
        progress
    });
    
    return progress;
}; 
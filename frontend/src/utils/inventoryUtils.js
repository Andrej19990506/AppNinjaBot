export const getCategories = (inventory) => {
    return Object.keys(inventory);
};

export const getItems = (inventory, category) => {
    return Object.keys(inventory[category] || {});
};

export const getTypes = (inventory, category, item) => {
    return Object.keys(inventory[category]?.[item] || {});
};

export const isCategoryComplete = (inventory, category) => {
    if (!inventory[category]) return false;
    
    return Object.values(inventory[category]).every(item =>
        Object.values(item).every(type => type.filled)
    );
};

export const isItemComplete = (inventory, category, item) => {
    if (!inventory[category]?.[item]) return false;
    
    return Object.values(inventory[category][item]).every(type => type.filled);
};

export const calculateProgress = (inventory) => {
    let total = 0;
    let filled = 0;

    Object.values(inventory).forEach(category => {
        Object.values(category).forEach(item => {
            Object.values(item).forEach(type => {
                total++;
                if (type.filled) filled++;
            });
        });
    });

    return total > 0 ? Math.round((filled / total) * 100) : 0;
}; 
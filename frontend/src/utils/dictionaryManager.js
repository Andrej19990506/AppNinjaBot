const DICTIONARIES_KEY = 'search_dictionaries';

// Загрузка словарей из localStorage
export function loadDictionaries() {
    console.log('=== loadDictionaries ===');
    const saved = localStorage.getItem(DICTIONARIES_KEY);
    console.log('Загруженные словари:', saved);
    if (!saved) {
        console.log('Словари не найдены, создаем новые');
        return {
            synonyms: {},
            typos: {}
        };
    }
    return JSON.parse(saved);
}

// Сохранение словарей в localStorage
function saveDictionaries(dictionaries) {
    console.log('=== saveDictionaries ===');
    console.log('Сохраняем словари:', dictionaries);
    localStorage.setItem(DICTIONARIES_KEY, JSON.stringify(dictionaries));
}

// Добавление синонима
export function addSynonym(word, synonyms) {
    console.log('=== addSynonym ===');
    console.log('Слово:', word);
    console.log('Синонимы:', synonyms);
    const dictionaries = loadDictionaries();
    
    if (!dictionaries.synonyms[word]) {
        dictionaries.synonyms[word] = [];
    }
    
    synonyms.forEach(synonym => {
        if (!dictionaries.synonyms[word].includes(synonym)) {
            dictionaries.synonyms[word].push(synonym);
        }
    });
    
    saveDictionaries(dictionaries);
}

// Добавление опечатки
export function addTypo(correct, typos) {
    const dictionaries = loadDictionaries();
    
    if (!dictionaries.typos[correct]) {
        dictionaries.typos[correct] = [];
    }
    
    typos.forEach(typo => {
        if (!dictionaries.typos[correct].includes(typo)) {
            dictionaries.typos[correct].push(typo);
        }
    });
    
    saveDictionaries(dictionaries);
}

// Обновление словарей на основе инвентаря
export function updateDictionariesFromInventory(inventory) {
    if (!inventory) return;
    
    const dictionaries = loadDictionaries();
    
    // Обработка категорий
    Object.keys(inventory).forEach(category => {
        const words = category.toLowerCase().split(/\s+/);
        words.forEach(word => {
            if (word.length > 3) {
                // Добавляем базовые синонимы для слов
                const basicSynonyms = generateBasicSynonyms(word);
                if (basicSynonyms.length > 0) {
                    addSynonym(word, basicSynonyms);
                }
            }
        });
        
        // Обработка элементов
        Object.keys(inventory[category]).forEach(item => {
            const itemWords = item.toLowerCase().split(/\s+/);
            itemWords.forEach(word => {
                if (word.length > 3) {
                    const basicSynonyms = generateBasicSynonyms(word);
                    if (basicSynonyms.length > 0) {
                        addSynonym(word, basicSynonyms);
                    }
                }
            });
        });
    });
    
    saveDictionaries(dictionaries);
}

// Генерация базовых синонимов для слова
function generateBasicSynonyms(word) {
    const synonyms = new Set();
    
    // Добавляем вариации с заменой букв
    const replacements = {
        'а': 'о', 'о': 'а',
        'е': 'и', 'и': 'е',
        'з': 'с', 'с': 'з',
        'б': 'п', 'п': 'б',
        'д': 'т', 'т': 'д',
        'ж': 'ш', 'ш': 'ж',
        'в': 'ф', 'ф': 'в'
    };
    
    for (let i = 0; i < word.length; i++) {
        const char = word[i];
        if (replacements[char]) {
            synonyms.add(word.slice(0, i) + replacements[char] + word.slice(i + 1));
        }
    }
    
    return Array.from(synonyms);
} 
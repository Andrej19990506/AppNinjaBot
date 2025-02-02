import { levenshteinDistance, normalizeText } from './textUtils';
import { 
    loadDictionaries, 
    updateDictionariesFromInventory,
    addSynonym,
    addTypo
} from './dictionaryManager';

// Кэш для динамических синонимов
let synonymsCache = null;
let lastInventoryHash = '';

// Функция для создания хэша инвентаря
function getInventoryHash(inventory) {
    console.log('=== getInventoryHash ===');
    const hash = JSON.stringify(inventory);
    console.log('Создан хэш инвентаря:', hash.substring(0, 50) + '...');
    return hash;
}

// Функция для создания динамического словаря синонимов на основе инвентаря
function generateDynamicSynonyms(inventory) {
    console.log('=== generateDynamicSynonyms ===');
    const currentHash = getInventoryHash(inventory);
    
    if (synonymsCache && currentHash === lastInventoryHash) {
        console.log('Используем кэшированные синонимы');
        return synonymsCache;
    }

    console.log('Генерируем новые синонимы');
    const synonyms = new Map();
    
    if (!inventory) {
        console.log('Инвентарь пустой, возвращаем пустой Map');
        return synonyms;
    }

    // Загружаем сохраненные словари
    const savedDictionaries = loadDictionaries();
    console.log('Загруженные словари:', savedDictionaries);
    
    // Добавляем сохраненные данные
    Object.entries(savedDictionaries.typos).forEach(([correct, typos]) => {
        console.log(`Добавляем опечатки для ${correct}:`, typos);
        typos.forEach(typo => {
            if (!synonyms.has(typo)) {
                synonyms.set(typo, new Set([correct]));
            } else {
                synonyms.get(typo).add(correct);
            }
        });
    });

    Object.entries(savedDictionaries.synonyms).forEach(([word, wordSynonyms]) => {
        console.log(`Добавляем синонимы для ${word}:`, wordSynonyms);
        wordSynonyms.forEach(synonym => {
            if (!synonyms.has(synonym)) {
                synonyms.set(synonym, new Set([word]));
            } else {
                synonyms.get(synonym).add(word);
            }
            
            if (!synonyms.has(word)) {
                synonyms.set(word, new Set([synonym]));
            } else {
                synonyms.get(word).add(synonym);
            }
        });
    });

    // Обновляем кэш
    synonymsCache = synonyms;
    lastInventoryHash = currentHash;
    console.log('Сгенерированные синонимы:', synonyms);

    return synonyms;
}

// Кэш для вариаций слов
const wordVariationsCache = new Map();

// Функция для генерации вариаций слова
function generateWordVariations(word) {
    // Проверяем кэш
    if (wordVariationsCache.has(word)) {
        return wordVariationsCache.get(word);
    }

    const variations = new Set([word]);
    
    // Генерируем вариации только для слов длиннее 3 символов
    if (word.length <= 3) {
        wordVariationsCache.set(word, variations);
        return variations;
    }

    const replacements = {
        'а': 'о', 'о': 'а',
        'е': 'и', 'и': 'е',
        'з': 'с', 'с': 'з',
        'б': 'п', 'п': 'б',
        'д': 'т', 'т': 'д',
        'ж': 'ш', 'ш': 'ж',
        'в': 'ф', 'ф': 'в'
    };

    // Оптимизированная генерация вариаций
    for (let i = 0; i < word.length; i++) {
        const char = word[i];
        if (replacements[char]) {
            variations.add(
                word.slice(0, i) + replacements[char] + word.slice(i + 1)
            );
        }
    }

    // Сохраняем в кэш
    wordVariationsCache.set(word, variations);
    return variations;
}

// Функция для проверки схожести текста с учетом динамических синонимов
function isSimilar(text, search, inventory) {
    console.log('=== isSimilar ===');
    console.log('Текст:', text);
    console.log('Поиск:', search);
    if (!text || !search || search.length <= 2) return false;

    const normalizedText = normalizeText(text);
    const normalizedSearch = normalizeText(search);

    if (normalizedText.includes(normalizedSearch)) return true;

    const words = normalizedSearch.split(/\s+/);
    const textWords = normalizedText.split(/\s+/);
    const dynamicSynonyms = generateDynamicSynonyms(inventory);

    return words.every(searchWord => {
        return textWords.some(textWord => {
            if (textWord === searchWord) return true;

            // Проверяем расстояние Левенштейна только для слов длиннее 3 символов
            if (searchWord.length > 3) {
                const distance = levenshteinDistance(textWord, searchWord);
                if (distance <= Math.min(2, Math.floor(searchWord.length / 3))) {
                    return true;
                }
            }

            const synonyms = dynamicSynonyms.get(searchWord);
            return synonyms && synonyms.has(textWord);
        });
    });
}

// Функция для расчета релевантности с учетом динамических синонимов
function calculateRelevance(text, search, inventory) {
    console.log('=== calculateRelevance ===');
    console.log('Текст:', text);
    console.log('Поиск:', search);
    if (!text || !search) return 0;

    const normalizedText = normalizeText(text.toLowerCase());
    const normalizedSearch = normalizeText(search.toLowerCase());

    // Прямое совпадение
    if (normalizedText === normalizedSearch) return 1;

    const words = normalizedSearch.split(/\s+/);
    const textWords = normalizedText.split(/\s+/);
    const dynamicSynonyms = generateDynamicSynonyms(inventory);

    let totalRelevance = 0;
    let matchedWords = 0;

    words.forEach(searchWord => {
        textWords.forEach(textWord => {
            // Проверяем прямое совпадение
            if (textWord === searchWord) {
                totalRelevance += 1;
                matchedWords++;
                return;
            }

            // Проверяем через расстояние Левенштейна
            const distance = levenshteinDistance(textWord, searchWord);
            const maxDistance = Math.min(2, Math.floor(searchWord.length / 3));
            if (distance <= maxDistance) {
                totalRelevance += 1 - (distance / (maxDistance + 1));
                matchedWords++;
                return;
            }

            // Проверяем через динамические синонимы
            const synonyms = dynamicSynonyms.get(searchWord);
            if (synonyms && synonyms.has(textWord)) {
                totalRelevance += 0.8; // Немного меньший вес для синонимов
                matchedWords++;
            }
        });
    });

    return matchedWords > 0 ? totalRelevance / words.length : 0;
}

// Функция для проверки опечаток с использованием как словаря, так и динамических синонимов
function checkTypos(text, inventory) {
    console.log('=== checkTypos ===');
    console.log('Текст:', text);
    
    if (!text) return '';

    const normalizedText = normalizeText(text.toLowerCase());
    const words = normalizedText.split(/\s+/);
    const dynamicSynonyms = generateDynamicSynonyms(inventory);
    const savedDictionaries = loadDictionaries();
    
    let hasCorrections = false;
    const correctedWords = words.map(word => {
        // Игнорируем слова короче 3 букв
        if (word.length < 3) return word;

        // Сначала проверяем в сохраненных опечатках
        for (const [correct, typos] of Object.entries(savedDictionaries.typos)) {
            if (typos.includes(word)) {
                hasCorrections = true;
                return correct;
            }
        }

        // Проверяем через расстояние Левенштейна
        let bestMatch = word;
        let minDistance = Infinity;
        
        // Проверяем все слова из инвентаря
        Object.entries(inventory).forEach(([category, items]) => {
            // Проверяем названия категорий
            const distance = levenshteinDistance(word, category.toLowerCase());
            if (distance < minDistance && distance <= Math.min(2, Math.floor(word.length / 3))) {
                minDistance = distance;
                bestMatch = category.toLowerCase();
            }

            // Проверяем названия товаров
            Object.keys(items).forEach(itemName => {
                const itemWords = itemName.toLowerCase().split(/\s+/);
                itemWords.forEach(itemWord => {
                    const distance = levenshteinDistance(word, itemWord);
                    if (distance < minDistance && distance <= Math.min(2, Math.floor(word.length / 3))) {
                        minDistance = distance;
                        bestMatch = itemWord;
                    }
                });
            });
        });

        if (bestMatch !== word) {
            hasCorrections = true;
            return bestMatch;
        }

        return word;
    });

    return hasCorrections ? correctedWords.join(' ') : '';
}

// Функция для автоматического обучения на основе успешных поисков
function learnFromSuccessfulSearch(searchQuery, foundItem, inventory) {
    if (!searchQuery || !foundItem) return null;

    const normalizedQuery = normalizeText(searchQuery.toLowerCase());
    const normalizedItem = normalizeText(foundItem.toLowerCase());

    // Если запрос не совпадает с точным названием товара
    if (normalizedQuery !== normalizedItem) {
        // Проверяем расстояние Левенштейна
        const distance = levenshteinDistance(normalizedQuery, normalizedItem);
        
        // Если расстояние небольшое (возможная опечатка)
        if (distance <= Math.min(2, Math.floor(normalizedItem.length / 3))) {
            addTypo(normalizedItem, [normalizedQuery]);
            return {
                type: 'typo',
                original: normalizedQuery,
                corrected: normalizedItem
            };
        } 
        // Если расстояние больше (возможный синоним)
        else {
            addSynonym(normalizedItem, [normalizedQuery]);
            return {
                type: 'synonym',
                original: normalizedQuery,
                word: normalizedItem
            };
        }

        // Обновляем словари в localStorage
        updateDictionariesFromInventory(inventory);
    }
    
    return null;
}

// Экспортируем все функции в одном месте
export {
    isSimilar,
    calculateRelevance,
    checkTypos,
    learnFromSuccessfulSearch,
    loadDictionaries,
    updateDictionariesFromInventory
}; 

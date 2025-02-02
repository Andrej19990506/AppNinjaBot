// Функция для нормализации текста
export function normalizeText(text) {
    if (!text) return '';
    
    return text
        .toLowerCase()
        .replace(/[ёе]/g, 'е')
        .replace(/[ъь]/g, '')
        .replace(/[^а-яa-z0-9\s]/g, '')
        .trim();
}

// Функция для расчета расстояния Левенштейна
export function levenshteinDistance(a, b) {
    if (!a || !b) return 0;
    
    const matrix = Array(b.length + 1).fill().map(() => Array(a.length + 1).fill(0));

    for (let i = 0; i <= a.length; i++) {
        matrix[0][i] = i;
    }
    
    for (let j = 0; j <= b.length; j++) {
        matrix[j][0] = j;
    }

    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,
                matrix[j - 1][i] + 1,
                matrix[j - 1][i - 1] + substitutionCost
            );
        }
    }

    return matrix[b.length][a.length];
} 
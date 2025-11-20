-- Скрипт для создания дефолтной роли "Общая" для существующих компаний
-- Выполнить один раз для добавления дефолтных ролей к существующим компаниям

-- Создаем дефолтную роль "Общая" для каждой компании, у которой её ещё нет
INSERT INTO company_roles (company_bot_id, role_name, role_code, description, is_active, display_order)
SELECT 
    cb.id,
    'Общая',
    'general',
    'Дефолтная роль для автоматической привязки групп к компании',
    true,
    0
FROM company_bots cb
WHERE NOT EXISTS (
    SELECT 1 
    FROM company_roles cr 
    WHERE cr.company_bot_id = cb.id 
    AND cr.role_code = 'general'
)
AND cb.is_active = true;

-- Проверка результата
SELECT 
    cb.id as company_bot_id,
    cb.company_name,
    cr.id as role_id,
    cr.role_name,
    cr.role_code
FROM company_bots cb
LEFT JOIN company_roles cr ON cr.company_bot_id = cb.id AND cr.role_code = 'general'
WHERE cb.is_active = true
ORDER BY cb.id;


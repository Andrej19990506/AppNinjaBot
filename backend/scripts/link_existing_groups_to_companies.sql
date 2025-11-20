-- Скрипт для проверки и ручной привязки существующих групп к компаниям
-- ВНИМАНИЕ: Этот скрипт требует ручного указания соответствий между группами и компаниями

-- 1. Показываем все группы без привязки
SELECT 
    g.id,
    g.group_id,
    g.title,
    g.group_type,
    'НЕ ПРИВЯЗАНА' as status
FROM groups g
LEFT JOIN group_role_mappings crm ON g.group_id = crm.group_id
WHERE crm.id IS NULL
ORDER BY g.id;

-- 2. Показываем все компании с ботами
SELECT 
    cb.id as company_bot_id,
    cb.bot_id,
    cb.bot_username,
    cb.company_name,
    cb.is_active
FROM company_bots cb
WHERE cb.is_active = true
ORDER BY cb.id;

-- 3. Пример: Привязка группы к компании (замените значения на реальные)
-- Для группы "Повара Мате Залки" (group_id = -1004917263769) к компании "Ниндзя пицца тест" (company_bot_id = 1)
-- 
-- Шаг 1: Найти или создать роль "Повар" для компании
-- INSERT INTO company_roles (company_bot_id, role_name, role_code, description, is_active, display_order)
-- VALUES (1, 'Повар', 'chef', 'Роль для поваров', true, 0)
-- ON CONFLICT (company_bot_id, role_code) DO NOTHING
-- RETURNING id;
--
-- Шаг 2: Получить ID созданной роли (или найти существующую)
-- SELECT id FROM company_roles WHERE company_bot_id = 1 AND role_code = 'chef';
--
-- Шаг 3: Создать привязку группы к роли
-- INSERT INTO group_role_mappings (group_id, company_role_id, is_working_group)
-- VALUES (-1004917263769, <role_id>, true)
-- ON CONFLICT (group_id, company_role_id) DO NOTHING;

-- 4. Проверка результата после привязки
SELECT 
    g.id,
    g.group_id,
    g.title,
    g.group_type,
    crm.id as mapping_id,
    cr.role_name,
    cr.role_code,
    cb.company_name
FROM groups g
LEFT JOIN group_role_mappings crm ON g.group_id = crm.group_id
LEFT JOIN company_roles cr ON crm.company_role_id = cr.id
LEFT JOIN company_bots cb ON cr.company_bot_id = cb.id
ORDER BY g.id;


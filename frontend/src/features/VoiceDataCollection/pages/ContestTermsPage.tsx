/**
 * Страница с условиями конкурса и политикой конфиденциальности
 */

import React from 'react';
import { Container, Typography, Box, Paper, List, ListItem, ListItemText, Divider } from '@mui/material';

const ContestTermsPage: React.FC = () => {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={2} sx={{ p: { xs: 3, md: 5 }, borderRadius: 2, bgcolor: '#ffffff' }}>
        {/* Заголовок */}
        <Box sx={{ textAlign: 'center', mb: 5, pb: 3, borderBottom: '2px solid #e0e0e0' }}>
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 700, 
              mb: 1.5,
              color: '#1a1a1a',
              fontSize: { xs: '1.75rem', md: '2.125rem' },
              letterSpacing: '-0.02em',
            }}
          >
            Условия конкурса и политика конфиденциальности
          </Typography>
          <Typography 
            variant="subtitle1" 
            sx={{ 
              color: '#666666',
              fontSize: '1rem',
              fontWeight: 400,
            }}
          >
            Конкурс по сбору голосовых данных для обучения ассистента "Лола"
          </Typography>
        </Box>

        <Divider sx={{ my: 4 }} />

        {/* Условия конкурса */}
        <Box sx={{ mb: 5 }}>
          <Typography 
            variant="h5" 
            sx={{ 
              fontWeight: 700,
              mb: 3,
              color: '#1a1a1a',
              fontSize: { xs: '1.5rem', md: '1.75rem' },
              borderLeft: '4px solid #1976d2',
              pl: 2,
            }}
          >
            1. Условия участия в конкурсе
          </Typography>

          <Typography variant="body1" paragraph sx={{ mb: 2, fontSize: '1rem', lineHeight: 1.7 }}>
            <strong>Призовой фонд:</strong> 25,000 рублей
          </Typography>

          <List sx={{ mb: 3, pl: 0 }}>
            <ListItem sx={{ pl: 0, py: 1 }}>
              <ListItemText 
                primary="Первое место: 7,000 рублей"
                secondary="Победитель определяется через рандомайзер"
                primaryTypographyProps={{ 
                  sx: { fontWeight: 600, fontSize: '1rem', color: '#1a1a1a' },
                }}
                secondaryTypographyProps={{ 
                  sx: { fontSize: '0.875rem', color: '#666666', mt: 0.5 },
                }}
              />
            </ListItem>
            <ListItem sx={{ pl: 0, py: 1 }}>
              <ListItemText 
                primary="Второе место: 5,000 рублей"
                secondary="Победитель определяется через рандомайзер"
                primaryTypographyProps={{ 
                  sx: { fontWeight: 600, fontSize: '1rem', color: '#1a1a1a' },
                }}
                secondaryTypographyProps={{ 
                  sx: { fontSize: '0.875rem', color: '#666666', mt: 0.5 },
                }}
              />
            </ListItem>
            <ListItem sx={{ pl: 0, py: 1 }}>
              <ListItemText 
                primary="Третье место: 3,000 рублей"
                secondary="Победитель определяется через рандомайзер"
                primaryTypographyProps={{ 
                  sx: { fontWeight: 600, fontSize: '1rem', color: '#1a1a1a' },
                }}
                secondaryTypographyProps={{ 
                  sx: { fontSize: '0.875rem', color: '#666666', mt: 0.5 },
                }}
              />
            </ListItem>
          </List>

          <Typography variant="body1" paragraph sx={{ mt: 3, mb: 1, fontSize: '1rem', lineHeight: 1.7 }}>
            <strong>Минимальное количество записей:</strong> 2,500 аудиофайлов
          </Typography>

          <Typography variant="body2" sx={{ color: '#666666', mb: 3, fontSize: '0.9375rem', lineHeight: 1.7 }} paragraph>
            Для участия в розыгрыше необходимо записать минимум 2,500 аудиофайлов в период с момента старта конкурса до 15 февраля 2026 года включительно.
          </Typography>

          <Typography variant="body1" paragraph sx={{ mt: 3, mb: 1, fontSize: '1rem', lineHeight: 1.7 }}>
            <strong>Модерация данных:</strong>
          </Typography>
          <Typography variant="body2" sx={{ color: '#666666', mb: 2, fontSize: '0.9375rem', lineHeight: 1.7 }} paragraph>
            Все предоставленные аудиозаписи проходят обязательную модерацию перед засчитыванием в конкурс. Записи, не соответствующие содержанию (тексту команды), не засчитываются в общий счет участника.
          </Typography>
          <Typography variant="body2" sx={{ color: '#666666', mb: 3, fontSize: '0.9375rem', lineHeight: 1.7 }} paragraph>
            Критерий модерации: соответствие произнесенного текста заданной команде. Помехи, шумы и особенности произношения не являются основанием для отклонения записи. Попытки обойти систему модерации (например, запись несоответствующих фраз, произнесение других команд вместо заданной) не допускаются и приводят к исключению таких записей из конкурса.
          </Typography>

          <Typography variant="body1" paragraph sx={{ mt: 3, mb: 1, fontSize: '1rem', lineHeight: 1.7 }}>
            <strong>Распределение записей:</strong>
          </Typography>
          <List sx={{ mb: 3, pl: 0 }}>
            <ListItem sx={{ pl: 0, py: 0.5 }}>
              <ListItemText 
                primary="30% — Хотворд «Лола» (активация ассистента)"
                primaryTypographyProps={{ sx: { fontSize: '0.9375rem', color: '#1a1a1a' } }}
              />
            </ListItem>
            <ListItem sx={{ pl: 0, py: 0.5 }}>
              <ListItemText 
                primary="60% — Команды для управления (поиск, количество, навигация и т.д.)"
                primaryTypographyProps={{ sx: { fontSize: '0.9375rem', color: '#1a1a1a' } }}
              />
            </ListItem>
            <ListItem sx={{ pl: 0, py: 0.5 }}>
              <ListItemText 
                primary="10% — Негативные примеры (фразы, не связанные с ассистентом)"
                primaryTypographyProps={{ sx: { fontSize: '0.9375rem', color: '#1a1a1a' } }}
              />
            </ListItem>
          </List>

          <Typography variant="body1" paragraph sx={{ mt: 3, mb: 1, fontSize: '1rem', lineHeight: 1.7 }}>
            <strong>Определение победителей:</strong>
          </Typography>
          <Typography variant="body2" sx={{ color: '#666666', mb: 3, fontSize: '0.9375rem', lineHeight: 1.7 }} paragraph>
            Победители определяются через генератор случайных чисел (рандомайзер) среди всех участников, выполнивших условия конкурса (записавших минимум 2,500 аудиофайлов, прошедших модерацию).
          </Typography>

          <Typography variant="body1" paragraph sx={{ mt: 3, fontSize: '1rem', lineHeight: 1.7 }}>
            <strong>Срок проведения конкурса:</strong> до 15 февраля 2026 года
          </Typography>
        </Box>

        <Divider sx={{ my: 4 }} />

        {/* Политика конфиденциальности */}
        <Box sx={{ mb: 5 }}>
          <Typography 
            variant="h5" 
            sx={{ 
              fontWeight: 700,
              mb: 3,
              color: '#1a1a1a',
              fontSize: { xs: '1.5rem', md: '1.75rem' },
              borderLeft: '4px solid #1976d2',
              pl: 2,
            }}
          >
            2. Политика конфиденциальности
          </Typography>

          <Typography variant="h6" sx={{ fontWeight: 600, mt: 3, mb: 1.5, color: '#1a1a1a', fontSize: '1.125rem' }}>
            2.1. Сбор и использование данных
          </Typography>
          <Typography variant="body2" sx={{ color: '#666666', mb: 3, fontSize: '0.9375rem', lineHeight: 1.7 }} paragraph>
            Мы собираем только голосовые аудиозаписи, которые вы добровольно предоставляете в рамках конкурса. Записи используются исключительно для обучения и улучшения голосового ассистента "Лола".
          </Typography>

          <Typography variant="h6" sx={{ fontWeight: 600, mt: 3, mb: 1.5, color: '#1a1a1a', fontSize: '1.125rem' }}>
            2.2. Анонимность и персональные данные
          </Typography>
          <Typography variant="body2" sx={{ color: '#666666', mb: 2, fontSize: '0.9375rem', lineHeight: 1.7 }} paragraph>
            Все аудиозаписи обрабатываются анонимно. Мы не собираем и не храним информацию, которая могла бы идентифицировать вас лично (ФИО, адрес, телефон и т.д.). Для организации конкурса используется только идентификатор участника (user_id), который не позволяет установить вашу личность.
          </Typography>
          <Typography variant="body2" sx={{ color: '#666666', mb: 3, fontSize: '0.9375rem', lineHeight: 1.7 }} paragraph>
            Предоставляя аудиозаписи, вы даете согласие на обработку персональных данных (голосовых записей) в соответствии с Федеральным законом № 152-ФЗ "О персональных данных" для целей обучения голосового ассистента "Лола".
          </Typography>

          <Typography variant="h6" sx={{ fontWeight: 600, mt: 3, mb: 1.5, color: '#1a1a1a', fontSize: '1.125rem' }}>
            2.3. Безопасность микрофона
          </Typography>
          <List sx={{ mb: 3, pl: 0 }}>
            <ListItem sx={{ pl: 0, py: 1 }}>
              <ListItemText 
                primary="Микрофон активируется ТОЛЬКО при нажатии кнопки «Готов»"
                secondary="Фоновая запись полностью исключена"
                primaryTypographyProps={{ 
                  sx: { fontWeight: 500, fontSize: '0.9375rem', color: '#1a1a1a' },
                }}
                secondaryTypographyProps={{ 
                  sx: { fontSize: '0.875rem', color: '#666666', mt: 0.5 },
                }}
              />
            </ListItem>
            <ListItem sx={{ pl: 0, py: 1 }}>
              <ListItemText 
                primary="Автоматическое отключение через 5 секунд"
                secondary="Микрофон не может работать дольше установленного времени"
                primaryTypographyProps={{ 
                  sx: { fontWeight: 500, fontSize: '0.9375rem', color: '#1a1a1a' },
                }}
                secondaryTypographyProps={{ 
                  sx: { fontSize: '0.875rem', color: '#666666', mt: 0.5 },
                }}
              />
            </ListItem>
            <ListItem sx={{ pl: 0, py: 1 }}>
              <ListItemText 
                primary="Контроль записи"
                secondary="Вы видите когда микрофон включен (индикатор записи)"
                primaryTypographyProps={{ 
                  sx: { fontWeight: 500, fontSize: '0.9375rem', color: '#1a1a1a' },
                }}
                secondaryTypographyProps={{ 
                  sx: { fontSize: '0.875rem', color: '#666666', mt: 0.5 },
                }}
              />
            </ListItem>
            <ListItem sx={{ pl: 0, py: 1 }}>
              <ListItemText 
                primary="Прозрачность"
                secondary="Вы знаете, какую фразу записываете перед началом записи"
                primaryTypographyProps={{ 
                  sx: { fontWeight: 500, fontSize: '0.9375rem', color: '#1a1a1a' },
                }}
                secondaryTypographyProps={{ 
                  sx: { fontSize: '0.875rem', color: '#666666', mt: 0.5 },
                }}
              />
            </ListItem>
          </List>

          <Typography variant="h6" sx={{ fontWeight: 600, mt: 3, mb: 1.5, color: '#1a1a1a', fontSize: '1.125rem' }}>
            2.4. Хранение данных
          </Typography>
          <Typography variant="body2" sx={{ color: '#666666', mb: 3, fontSize: '0.9375rem', lineHeight: 1.7 }} paragraph>
            Аудиозаписи хранятся на защищенных облачных серверах (Яндекс.Диск) с ограниченным доступом. Доступ имеют только авторизованные специалисты, занимающиеся обучением модели. Использование облачного хранилища необходимо для обеспечения надежности хранения и доступности данных для обучения модели.
          </Typography>

          <Typography variant="h6" sx={{ fontWeight: 600, mt: 3, mb: 1.5, color: '#1a1a1a', fontSize: '1.125rem' }}>
            2.5. Срок хранения
          </Typography>
          <Typography variant="body2" sx={{ color: '#666666', mb: 3, fontSize: '0.9375rem', lineHeight: 1.7 }} paragraph>
            Аудиозаписи хранятся в течение времени, необходимого для обучения модели, и могут быть удалены по вашему запросу.
          </Typography>

          <Typography variant="h6" sx={{ fontWeight: 600, mt: 3, mb: 1.5, color: '#1a1a1a', fontSize: '1.125rem' }}>
            2.6. Передача данных третьим лицам
          </Typography>
          <Typography variant="body2" sx={{ color: '#666666', mb: 2, fontSize: '0.9375rem', lineHeight: 1.7 }} paragraph>
            Мы НЕ передаем, НЕ продаем и НЕ предоставляем ваши аудиозаписи третьим лицам для коммерческих или иных целей, не связанных с обучением модели.
          </Typography>
          <Typography variant="body2" sx={{ color: '#666666', mb: 3, fontSize: '0.9375rem', lineHeight: 1.7 }} paragraph>
            Использование облачного хранилища (Яндекс.Диск) для технического хранения данных не является передачей данных третьим лицам в смысле настоящей политики, так как провайдер облачного хранилища не имеет доступа к содержимому файлов и не использует их в своих целях.
          </Typography>
        </Box>

        <Divider sx={{ my: 4 }} />

        {/* Права участников */}
        <Box sx={{ mb: 5 }}>
          <Typography 
            variant="h5" 
            sx={{ 
              fontWeight: 700,
              mb: 3,
              color: '#1a1a1a',
              fontSize: { xs: '1.5rem', md: '1.75rem' },
              borderLeft: '4px solid #1976d2',
              pl: 2,
            }}
          >
            3. Права участников
          </Typography>

          <List sx={{ pl: 0 }}>
            <ListItem sx={{ pl: 0, py: 1.5 }}>
              <ListItemText 
                primary="Право на удаление данных"
                secondary="Вы можете запросить удаление своих аудиозаписей в любое время"
                primaryTypographyProps={{ 
                  sx: { fontWeight: 500, fontSize: '0.9375rem', color: '#1a1a1a' },
                }}
                secondaryTypographyProps={{ 
                  sx: { fontSize: '0.875rem', color: '#666666', mt: 0.5 },
                }}
              />
            </ListItem>
            <ListItem sx={{ pl: 0, py: 1.5 }}>
              <ListItemText 
                primary="Право на отказ от участия"
                secondary="Вы можете прекратить участие в конкурсе в любой момент без объяснения причин"
                primaryTypographyProps={{ 
                  sx: { fontWeight: 500, fontSize: '0.9375rem', color: '#1a1a1a' },
                }}
                secondaryTypographyProps={{ 
                  sx: { fontSize: '0.875rem', color: '#666666', mt: 0.5 },
                }}
              />
            </ListItem>
            <ListItem sx={{ pl: 0, py: 1.5 }}>
              <ListItemText 
                primary="Право на информацию"
                secondary="Вы имеете право получить информацию о том, как используются ваши данные"
                primaryTypographyProps={{ 
                  sx: { fontWeight: 500, fontSize: '0.9375rem', color: '#1a1a1a' },
                }}
                secondaryTypographyProps={{ 
                  sx: { fontSize: '0.875rem', color: '#666666', mt: 0.5 },
                }}
              />
            </ListItem>
          </List>
        </Box>

        <Divider sx={{ my: 4 }} />

        {/* Дополнительная информация */}
        <Box>
          <Typography 
            variant="h5" 
            sx={{ 
              fontWeight: 700,
              mb: 3,
              color: '#1a1a1a',
              fontSize: { xs: '1.5rem', md: '1.75rem' },
              borderLeft: '4px solid #1976d2',
              pl: 2,
            }}
          >
            4. Дополнительная информация
          </Typography>

          <Typography variant="body2" sx={{ color: '#666666', mb: 2, fontSize: '0.9375rem', lineHeight: 1.7 }} paragraph>
            Принимая участие в конкурсе, вы подтверждаете, что:
          </Typography>
          <List sx={{ mb: 3, pl: 0 }}>
            <ListItem sx={{ pl: 0, py: 0.75 }}>
              <ListItemText 
                primary="Вы прочитали и поняли условия конкурса и политику конфиденциальности"
                primaryTypographyProps={{ sx: { fontSize: '0.9375rem', color: '#1a1a1a' } }}
              />
            </ListItem>
            <ListItem sx={{ pl: 0, py: 0.75 }}>
              <ListItemText 
                primary="Вы добровольно предоставляете аудиозаписи для обучения модели"
                primaryTypographyProps={{ sx: { fontSize: '0.9375rem', color: '#1a1a1a' } }}
              />
            </ListItem>
            <ListItem sx={{ pl: 0, py: 0.75 }}>
              <ListItemText 
                primary="Вы даете согласие на обработку персональных данных (голосовых записей) в соответствии с Федеральным законом № 152-ФЗ и описанной политикой конфиденциальности"
                primaryTypographyProps={{ sx: { fontSize: '0.9375rem', color: '#1a1a1a' } }}
              />
            </ListItem>
            <ListItem sx={{ pl: 0, py: 0.75 }}>
              <ListItemText 
                primary="Вы понимаете механику розыгрыша призов через рандомайзер"
                primaryTypographyProps={{ sx: { fontSize: '0.9375rem', color: '#1a1a1a' } }}
              />
            </ListItem>
            <ListItem sx={{ pl: 0, py: 0.75 }}>
              <ListItemText 
                primary="Вы понимаете, что все записи проходят модерацию на соответствие содержанию (тексту команды)"
                primaryTypographyProps={{ sx: { fontSize: '0.9375rem', color: '#1a1a1a' } }}
              />
            </ListItem>
          </List>

          <Typography variant="body2" sx={{ color: '#666666', mb: 1, mt: 3, fontSize: '0.9375rem', lineHeight: 1.7, fontWeight: 600 }} paragraph>
            <strong>Контакты для связи:</strong>
          </Typography>
          <Typography variant="body2" sx={{ color: '#666666', mb: 3, fontSize: '0.9375rem', lineHeight: 1.7 }}>
            По всем вопросам, связанным с конкурсом, политикой конфиденциальности или удалением данных, обращайтесь к администратору системы.
          </Typography>
        </Box>

        {/* Дата обновления */}
        <Box sx={{ mt: 5, pt: 3, borderTop: '2px solid #e0e0e0' }}>
          <Typography variant="caption" sx={{ color: '#999999', fontSize: '0.8125rem' }}>
            Последнее обновление: 26 января 2026
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default ContestTermsPage;




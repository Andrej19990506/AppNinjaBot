import logging
import os

# Определяем текущее окружение
ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')

def setup_logging():
    """Настраивает конфигурацию логирования для всего приложения."""

    # Настраиваем базовое логирование на уровне INFO
    # Уровень ERROR для всех окружений - это слишком тихо, INFO лучше для отладки
    log_level = logging.INFO if ENVIRONMENT == 'development' else logging.INFO
    logging.basicConfig(
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        level=log_level,
        # force=True # Используйте force=True, если настройки не применяются из-за предыдущих вызовов basicConfig
    )

    # Отключаем или понижаем уровень для слишком "болтливых" библиотек
    logging.getLogger('httpx').setLevel(logging.WARNING)
    logging.getLogger('telegram.ext').setLevel(logging.WARNING)
    logging.getLogger('telegram.bot').setLevel(logging.WARNING) # Добавим и основной telegram.bot
    logging.getLogger('apscheduler').setLevel(logging.WARNING)
    logging.getLogger('asyncio').setLevel(logging.WARNING)
  
    # Логгер для инициализации
    init_logger = logging.getLogger(__name__)
    init_logger.info(f"Конфигурация логирования настроена. Уровень: {logging.getLevelName(log_level)}. Окружение: {ENVIRONMENT}") 
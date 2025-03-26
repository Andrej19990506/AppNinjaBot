import logging
from pathlib import Path

def setup_logging():
    """Настройка системы логирования"""
    # Создаем директорию для логов
    log_dir = Path('logs')
    log_dir.mkdir(exist_ok=True)
    
    # Настраиваем базовое логирование
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            # Вывод в файл
            logging.FileHandler(
                log_dir / 'app.log',
                encoding='utf-8'
            ),
            # Вывод в консоль
            logging.StreamHandler()
        ]
    )
    
    # Создаем и возвращаем логгер приложения
    logger = logging.getLogger('AppNinjaBot')
    return logger

# Создаем основной логгер приложения
logger = setup_logging() 
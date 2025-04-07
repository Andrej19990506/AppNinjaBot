from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, JSON, UniqueConstraint, BigInteger
)
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func # Для CURRENT_TIMESTAMP

# Базовый класс для наших моделей
Base = declarative_base() 
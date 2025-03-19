from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(Integer, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    first_name = Column(String)
    last_name = Column(String)
    photo_url = Column(String, nullable=True)
    is_admin = Column(Boolean, default=False)
    is_courier = Column(Boolean, default=False)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)

    # Связь со сменами
    shifts = relationship("Shift", back_populates="user", cascade="all, delete-orphan")

    class Config:
        orm_mode = True 
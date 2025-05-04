from pydantic import BaseModel
from typing import Optional, Dict, Any

class SendMessagePayload(BaseModel):
    chat_id: str
    text: str
    parse_mode: str = 'HTML'
    reply_markup: Optional[Dict[str, Any]] = None 
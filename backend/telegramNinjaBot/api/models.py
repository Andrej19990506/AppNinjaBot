from pydantic import BaseModel

class SendMessagePayload(BaseModel):
    chat_id: str
    text: str
    parse_mode: str = 'HTML' 
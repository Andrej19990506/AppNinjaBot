import requests
import json

# URL для отправки сообщения
url = "http://server:8000/api/telegram/send_message"

# Заголовки запроса
headers = {
    "Content-Type": "application/json"
}

# Тестовое сообщение
data = {
    "message": "🎉 <b>Открылась запись на смены на следующую неделю!</b>\n\n📱 Пожалуйста, перейдите в приложение и запишитесь на удобное время:\n1️⃣ Откройте бота @NinjaSlovtsova_bot\n2️⃣ Нажмите кнопку 'Открыть приложение' (можно найти двумя способами):\n   • Нажмите на имя бота и выберите 'Открыть приложение' в информации о боте\n   • Или нажмите кнопку 'Открыть приложение' справа от имени бота в диалоге\n3️⃣ Укажите удобное время\n\n⚠️ Важно: Чем раньше укажете доступность, тем больше шансов получить удобное время!\n\nСпешите записаться на удобное время! 🚀",
    "chat_ids": ["-1004721237800"]  # Тестовая группа курьеров
}

try:
    # Отправляем POST запрос
    response = requests.post(url, headers=headers, json=data)
    
    # Выводим статус ответа
    print(f"Status Code: {response.status_code}")
    
    # Выводим ответ сервера
    print("Response:")
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    
except Exception as e:
    print(f"Error: {str(e)}") 
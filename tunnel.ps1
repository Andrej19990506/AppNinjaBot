Write-Host "Starting tunnels..."

# Запускаем туннель для фронтенда
Write-Host "Starting frontend tunnel..."
Start-Process -NoNewWindow -FilePath "cloudflared.exe" -ArgumentList "tunnel --url http://localhost:3000"

# Запускаем туннель для API
Write-Host "Starting API tunnel..."
Start-Process -NoNewWindow -FilePath "cloudflared.exe" -ArgumentList "tunnel --url http://localhost:8000"

Write-Host "`nTunnel URLs:"
Write-Host "Frontend URL (for BotFather):"
Write-Host "API URL (for docker-compose.yml):"
Write-Host "`nTo stop tunnels, press Ctrl+C" 
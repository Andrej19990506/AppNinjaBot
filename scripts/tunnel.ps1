# Проверяем наличие cloudflared
if (!(Test-Path ".\cloudflared.exe")) {
    Write-Host "Скачиваем cloudflared..."
    Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile "cloudflared.exe"
}

# Функция для проверки доступности сервиса
function Test-ServiceAvailable {
    param (
        [string]$Url,
        [string]$ServiceName
    )
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "$ServiceName is available." -ForegroundColor Green
            return $true
        }
    }
    catch {
        Write-Host "$ServiceName is not available at $Url" -ForegroundColor Red
        Write-Host "Make sure docker containers are running: docker-compose up -d" -ForegroundColor Yellow
        return $false
    }
}

# Проверяем доступность сервисов
Write-Host "Checking services availability..."
$frontendAvailable = Test-ServiceAvailable -Url "http://localhost:3000" -ServiceName "Frontend"
$apiAvailable = Test-ServiceAvailable -Url "http://localhost:8000/api/chats" -ServiceName "API"

if (-not ($frontendAvailable -and $apiAvailable)) {
    Write-Host "Please start the services first with: docker-compose up -d" -ForegroundColor Red
    exit 1
}

# Запускаем туннели
Write-Host "`nStarting tunnels..." -ForegroundColor Cyan

# Туннель для фронтенда
Write-Host "Starting frontend tunnel..."
Start-Process -FilePath ".\cloudflared.exe" -ArgumentList "tunnel --url http://localhost:3000" -NoNewWindow -RedirectStandardOutput "frontend_tunnel.log"

# Ждем немного
Start-Sleep -Seconds 3

# Туннель для API
Write-Host "Starting API tunnel..."
Start-Process -FilePath ".\cloudflared.exe" -ArgumentList "tunnel --url http://localhost:8000" -NoNewWindow -RedirectStandardOutput "api_tunnel.log"

# Читаем URL из логов
Start-Sleep -Seconds 5
Write-Host "`nTunnel URLs:" -ForegroundColor Green
Write-Host "Frontend URL (for BotFather):" -ForegroundColor Yellow
Get-Content "frontend_tunnel.log" | Select-String "https://"
Write-Host "`nAPI URL (for docker-compose.yml):" -ForegroundColor Yellow
Get-Content "api_tunnel.log" | Select-String "https://"

Write-Host "`nTo stop tunnels, press Ctrl+C" -ForegroundColor Cyan

# Ожидаем Ctrl+C
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
}
finally {
    # Очистка при завершении
    Stop-Process -Name "cloudflared" -Force -ErrorAction SilentlyContinue
    Remove-Item "frontend_tunnel.log" -ErrorAction SilentlyContinue
    Remove-Item "api_tunnel.log" -ErrorAction SilentlyContinue
} 
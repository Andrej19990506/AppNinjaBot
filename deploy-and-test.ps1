# AppNinjaBot - Deploy and Test Script (PowerShell)
param(
    [string]$Command = "deploy",
    [string]$Environment = "dev",
    [string]$Url = "http://localhost"
)

Write-Host "AppNinjaBot - Deploy and Test Script" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# Functions for logging
function Write-Info {
    param([string]$Message)
    Write-Host "INFO: $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "SUCCESS: $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "WARNING: $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "ERROR: $Message" -ForegroundColor Red
}

# Check that we are in the correct directory
if (-not (Test-Path "docker-compose.yml")) {
    Write-Error "Script must be run from project root directory (where docker-compose.yml is located)"
    exit 1
}

# Function to check service availability
function Test-Service {
    param(
        [string]$Url,
        [string]$ServiceName,
        [int]$MaxAttempts = 30
    )
    
    Write-Info "Checking $ServiceName ($Url)..."
    
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 5 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Success "$ServiceName is working!"
                return $true
            }
        }
        catch {
            Write-Host "." -NoNewline
            Start-Sleep -Seconds 2
        }
    }
    
    Write-Error "$ServiceName is not available after $MaxAttempts attempts"
    return $false
}

# Function to test config.js
function Test-ConfigJs {
    param([string]$BaseUrl)
    
    Write-Info "Testing config.js..."
    
    # Test 1: Direct access to config.js
    try {
        $configContent = Invoke-WebRequest -Uri "$BaseUrl/config.js" -UseBasicParsing
        Write-Success "config.js is accessible"
        Write-Host "Config.js content:"
        Write-Host $configContent.Content -ForegroundColor Gray
    }
    catch {
        Write-Error "config.js is not accessible!"
        Write-Host $_.Exception.Message -ForegroundColor Red
        return $false
    }
    
    # Test 2: Check diagnostic endpoint
    try {
        $statusResponse = Invoke-WebRequest -Uri "$BaseUrl/debug/config-status" -UseBasicParsing
        Write-Success "Diagnostic endpoint is working"
        Write-Host "Config.js status:"
        Write-Host $statusResponse.Content -ForegroundColor Gray
    }
    catch {
        Write-Warning "Diagnostic endpoint is not available"
    }
    
    # Test 3: Check headers
    Write-Info "Checking HTTP headers..."
    try {
        $headResponse = Invoke-WebRequest -Uri "$BaseUrl/config.js" -Method HEAD -UseBasicParsing
        Write-Host "Status: $($headResponse.StatusCode)"
        foreach ($header in $headResponse.Headers.GetEnumerator()) {
            Write-Host "$($header.Key): $($header.Value)" -ForegroundColor Gray
        }
    }
    catch {
        Write-Warning "Could not get headers"
    }
    
    return $true
}

# Function to check logs
function Show-Logs {
    param([string]$Service = "nginx")
    
    Write-Info "Checking $Service logs..."
    
    try {
        $logs = docker compose logs $Service --tail 20
        Write-Success "$Service logs:"
        Write-Host $logs -ForegroundColor Gray
    }
    catch {
        Write-Warning "Could not get $Service logs"
    }
}

# Main deployment function
function Start-Deployment {
    param([string]$Env = "dev")
    
    Write-Info "Starting deployment in mode: $Env"
    
    # Stop existing containers
    Write-Info "Stopping existing containers..."
    try {
        docker compose down
    }
    catch {
        Write-Warning "Error stopping containers (maybe they are already stopped)"
    }
    
    # Remove old images (optional)
    $cleanImages = Read-Host "Remove old images? (y/N)"
    if ($cleanImages -eq "y" -or $cleanImages -eq "Y") {
        Write-Info "Removing old images..."
        try {
            docker compose down --rmi all --volumes --remove-orphans
        }
        catch {
            Write-Warning "Error removing images"
        }
    }
    
    # Build and run
    if ($Env -eq "prod") {
        Write-Info "Production deployment..."
        docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
        $baseUrl = "https://appninjabot.ru"
    } else {
        Write-Info "Development deployment..."
        docker compose up --build -d
        $baseUrl = "http://localhost"
    }
    
    # Wait for services to start
    Write-Info "Waiting for services to start..."
    Start-Sleep -Seconds 10
    
    # Check container status
    Write-Info "Container status:"
    docker compose ps
    
    # Check services
    if ($Env -eq "dev") {
        Test-Service -Url "http://localhost" -ServiceName "Frontend"
        Test-Service -Url "http://localhost/api/health" -ServiceName "API"
    }
    
    # Test config.js
    Test-ConfigJs -BaseUrl $baseUrl
    
    # Check logs
    Show-Logs
    
    Write-Success "Deployment completed!"
    Write-Info "Available URLs:"
    Write-Host "  Main application: $baseUrl" -ForegroundColor Cyan
    Write-Host "  Debug page: $baseUrl/debug.html" -ForegroundColor Cyan
    Write-Host "  Config.js status: $baseUrl/debug/config-status" -ForegroundColor Cyan
    Write-Host "  Direct config.js: $baseUrl/config.js" -ForegroundColor Cyan
    
    if ($Env -eq "dev") {
        Write-Host "  Adminer (DB): http://localhost:8080" -ForegroundColor Cyan
    }
}

# Function to show help
function Show-Help {
    Write-Host "Usage: .\deploy-and-test.ps1 -Command [command] [parameters]"
    Write-Host ""
    Write-Host "Parameters:"
    Write-Host "  -Command [deploy|test|logs|help]  - Command to execute"
    Write-Host "  -Environment [dev|prod]           - Environment for deployment"
    Write-Host "  -Url [url]                        - URL for testing"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\deploy-and-test.ps1 -Command deploy -Environment dev"
    Write-Host "  .\deploy-and-test.ps1 -Command deploy -Environment prod"
    Write-Host "  .\deploy-and-test.ps1 -Command test"
    Write-Host "  .\deploy-and-test.ps1 -Command test -Url https://appninjabot.ru"
    Write-Host "  .\deploy-and-test.ps1 -Command logs"
}

# Command processing
switch ($Command.ToLower()) {
    "deploy" {
        Start-Deployment -Env $Environment
    }
    "test" {
        Write-Info "Quick config.js testing..."
        Test-ConfigJs -BaseUrl $Url
    }
    "logs" {
        Show-Logs -Service $Environment
    }
    "help" {
        Show-Help
    }
    default {
        Write-Error "Unknown command: $Command"
        Show-Help
        exit 1
    }
} 
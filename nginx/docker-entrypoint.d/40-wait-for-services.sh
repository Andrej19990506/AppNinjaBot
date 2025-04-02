#!/bin/sh
set -e

# Install curl if not present
apk add --no-cache curl 2>/dev/null || true

echo "Waiting for frontend service..."
until curl -s http://frontend/ >/dev/null 2>&1; do
    echo "Waiting for frontend..."
    sleep 2
done
echo "Frontend service is up"

echo "Waiting for server service..."
until curl -s http://server:8000/health >/dev/null 2>&1; do
    echo "Waiting for server..."
    sleep 2
done
echo "Server service is up"

echo "Waiting for websocket service..."
until curl -s http://websocket:8001/health >/dev/null 2>&1; do
    echo "Waiting for websocket..."
    sleep 2
done
echo "Websocket service is up" 
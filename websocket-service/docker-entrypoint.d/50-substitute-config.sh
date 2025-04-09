#!/bin/sh
set -e

echo "Generating runtime configuration..."

if [ -e "/usr/share/nginx/html/config.template.js" ]; then
    echo "Found config template, substituting environment variables..."
    envsubst '${API_URL} ${WS_URL} ${ENV}' < /usr/share/nginx/html/config.template.js > /usr/share/nginx/html/config.js
    echo "Configuration generated successfully"
else
    echo "Warning: config.template.js not found, skipping configuration generation"
fi

exec "$@" 
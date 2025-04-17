#!/bin/sh
set -e

sh -c "echo \"Generating runtime configuration...\""

if [ -e "/usr/share/nginx/html/config.template.js" ]; then
    sh -c "echo \"Found config template, substituting environment variables...\""
    envsubst '${API_URL} ${WS_URL} ${ENV}' < /usr/share/nginx/html/config.template.js > /usr/share/nginx/html/config.js
    sh -c "echo \"Configuration generated successfully\""
else
    sh -c "echo \"Warning: config.template.js not found, skipping configuration generation\""
fi

exec "$@" 
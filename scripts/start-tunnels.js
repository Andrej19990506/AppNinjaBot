const localtunnel = require('localtunnel');

async function startTunnels() {
    try {
        // Туннель для фронтенда
        const frontendTunnel = await localtunnel({ 
            port: 3000,
            subdomain: 'ninja-admin-frontend' // Можно указать желаемый поддомен
        });
        console.log('Фронтенд доступен по адресу:', frontendTunnel.url);

        // Туннель для API
        const apiTunnel = await localtunnel({ 
            port: 8000,
            subdomain: 'ninja-admin-api'
        });
        console.log('API доступен по адресу:', apiTunnel.url);

        // Обработка закрытия туннелей
        frontendTunnel.on('close', () => {
            console.log('Туннель фронтенда закрыт');
        });

        apiTunnel.on('close', () => {
            console.log('Туннель API закрыт');
        });

    } catch (err) {
        console.error('Ошибка при создании туннелей:', err);
    }
}

startTunnels(); 
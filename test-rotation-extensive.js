const axios = require('axios');

async function checkIp(username, password, label) {
    try {
        const res = await axios.get('http://ip-api.com/json', {
            proxy: {
                protocol: 'http',
                host: 'p2.mangoproxy.com',
                port: 2333,
                auth: { username, password }
            },
            timeout: 5000
        });
        console.log(`${label}: ${res.data.query} (${res.data.city}, ${res.data.regionName})`);
        return res.data.query;
    } catch (e) {
        console.log(`${label} Error: ${e.message}`);
        return null;
    }
}

async function run() {
    const password = 'pompbza2v7efm';
    const baseUser = 'xhv18ztqs15-zone-static-region-ru';

    console.log('Testing with different session IDs (should rotate):');
    for (let i = 1; i <= 5; i++) {
        const sessionUser = `${baseUser}-session-${Math.floor(Math.random() * 1000000)}`;
        await checkIp(sessionUser, password, `Session ${i}`);
    }
}

run();

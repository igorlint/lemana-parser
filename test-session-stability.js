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
        console.log(`${label}: ${res.data.query} (${res.data.city})`);
        return res.data.query;
    } catch (e) {
        console.log(`${label} Error: ${e.message}`);
        return null;
    }
}

async function run() {
    const password = 'pompbza2v7efm';
    const baseUser = 'xhv18ztqs15-zone-static-region-ru';
    const sessionId = 'test' + Math.floor(Math.random() * 1000);
    const sessionUser = `${baseUser}-session-${sessionId}`;

    console.log('Testing without session (should rotate):');
    await checkIp(baseUser, password, 'Attempt 1');
    await checkIp(baseUser, password, 'Attempt 2');

    console.log('\nTesting with session (should stay same):');
    await checkIp(sessionUser, password, 'Attempt 1');
    await checkIp(sessionUser, password, 'Attempt 2');
    await checkIp(sessionUser, password, 'Attempt 3');
}

run();

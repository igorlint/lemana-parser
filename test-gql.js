const axios = require('axios');

async function testGql(url) {
    try {
        console.log(`Testing GraphQL: ${url}`);
        const response = await axios.post(url, {
            query: '{ __schema { queryType { name } } }'
        }, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 5000
        });
        console.log(`Found GQL: ${url} (Status: ${response.status})`);
        return true;
    } catch (e) {
        console.log(`Failed GQL: ${url} (Status: ${e.response?.status || 'No response'})`);
        return false;
    }
}

async function run() {
    const endpoints = [
        'https://pskov.lemanapro.ru/api/v1/graphql',
        'https://pskov.lemanapro.ru/api/graphql',
        'https://pskov.lemanapro.ru/graphql',
        'https://lemanapro.ru/api/v1/graphql',
        'https://lemanapro.ru/api/graphql',
        'https://lemanapro.ru/graphql'
    ];

    for (const url of endpoints) {
        await testGql(url);
    }
}

run();

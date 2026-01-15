const axios = require('axios');

async function testApi(url) {
    try {
        console.log(`Testing: ${url}`);
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
                'Accept': 'application/json'
            },
            timeout: 5000
        });
        console.log(`Success: ${url} (Status: ${response.status})`);
        console.log('Preview:', JSON.stringify(response.data).substring(0, 200));
        return true;
    } catch (e) {
        console.log(`Error: ${url} (Status: ${e.response?.status || 'No response'})`);
        return false;
    }
}

async function run() {
    const sku = '82471809';
    const endpoints = [
        `https://lemanapro.ru/api/v1/products/${sku}`,
        `https://lemanapro.ru/api/v2/products/${sku}`,
        `https://lemanapro.ru/api/product/${sku}`,
        `https://lemanapro.ru/api/search/suggestions?q=${sku}`,
        `https://public-api.lemanapro.ru/v1/products/${sku}`,
        `https://api.lemanapro.ru/v1/products/${sku}`
    ];

    for (const url of endpoints) {
        await testApi(url);
    }
}

run();

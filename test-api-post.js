const axios = require('axios');

async function run() {
    const sku = '82471809';
    const regionId = '506'; // Pskov from user's link

    const host = 'p2.mangoproxy.com';
    const port = 2333;
    const username = 'xhv18ztqs15-zone-static-region-ru';
    const password = 'pompbza2v7efm';

    const url = 'https://pskov.lemanapro.ru/api/v1/products/prices';

    try {
        console.log(`Testing API POST to ${url} with SKU ${sku} and Region ${regionId}...`);
        const response = await axios.post(url, {
            skus: [sku]
        }, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Origin': 'https://pskov.lemanapro.ru',
                'Referer': `https://pskov.lemanapro.ru/product/elektricheskaya-varochnaya-panel-hansa-bhc36106-30-sm-2-konforki-cvet-chernyy-82471809/?fromRegion=${regionId}`
            },
            proxy: {
                protocol: 'http',
                host,
                port,
                auth: { username, password }
            },
            timeout: 10000
        });

        console.log('Success:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.log('Error Type:', e.response ? 'API Error' : 'Network/Proxy Error');
        console.log('Status:', e.response?.status);
        console.log('Data Preview:', JSON.stringify(e.response?.data).substring(0, 500));
    }
}

run();

const axios = require('axios');

async function testUrl(url, label) {
    try {
        console.log(`Testing ${label}: ${url}`);
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'X-Requested-With': 'XMLHttpRequest'
            },
            timeout: 5000
        });
        console.log(`Success ${label}: ${url} (Status: ${response.status})`);
        console.log('Preview:', JSON.stringify(response.data).substring(0, 200));
        return true;
    } catch (e) {
        console.log(`Error ${label}: ${url} (Status: ${e.response?.status || 'No response'})`);
        return false;
    }
}

async function run() {
    const slug = 'elektricheskaya-varochnaya-panel-hansa-bhc36106-30-sm-2-konforki-cvet-chernyy-82471809';
    const urls = [
        { label: 'JSON Suffix', url: `https://pskov.lemanapro.ru/product/${slug}.json` },
        { label: 'Ajax Header', url: `https://pskov.lemanapro.ru/product/${slug}/` },
        { label: 'Internal API', url: `https://pskov.lemanapro.ru/api/product/${slug}` }
    ];

    for (const item of urls) {
        await testUrl(item.url, item.label);
    }
}

run();

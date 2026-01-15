import { fetchPrice } from './lib/parser';

async function test() {
    console.log("🚀 Starting parallel test...");

    const items = [
        { sku: '82471809', subdomain: 'pskov', url: 'https://pskov.lemanapro.ru/product/elektricheskaya-varochnaya-panel-hansa-bhc36106-30-sm-2-konforki-cvet-chernyy-82471809/' },
        { sku: '82471809', subdomain: 'moscow', url: 'https://lemanapro.ru/product/elektricheskaya-varochnaya-panel-hansa-bhc36106-30-sm-2-konforki-cvet-chernyy-82471809/' }
    ];

    console.time("Parallel Parsing");

    const results = await Promise.all(items.map(item =>
        fetchPrice(item.sku, item.subdomain, item.url, true)
    ));

    console.timeEnd("Parallel Parsing");
    console.log("📊 Results:", JSON.stringify(results, null, 2));
}

test().catch(console.error);

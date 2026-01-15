const CDP = require('chrome-remote-interface');
const { spawn } = require('child_process');

async function run() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log(JSON.stringify({ status: 'error', error: 'Missing arguments' }));
        return;
    }

    const sku = args[0];
    const subdomain = args[1];
    const originalUrl = args[2] || '';
    const useProxy = args[3] === 'true';

    const regionPrefix = ['moscow', ''].includes(subdomain) ? '' : `${subdomain}.`;
    const regId = subdomain === 'pskov' ? '506' : '34';

    let url;
    if (originalUrl && originalUrl.includes('/product/')) {
        const parts = originalUrl.split('/product/');
        const slugAndRest = parts[1];
        url = `https://${regionPrefix}lemanapro.ru/product/${slugAndRest}`;
        if (!url.includes('fromRegion')) {
            url += (url.includes('?') ? '&' : '?') + `fromRegion=${regId}`;
        }
    } else {
        url = `https://${regionPrefix}lemanapro.ru/search/?q=${sku}&fromRegion=${regId}`;
    }

    const PROXY_USER = `xhv18ztqs15-zone-static-region-ru-session-${Math.floor(Math.random() * 1000000)}`;
    const PROXY_PASS = 'pompbza2v7efm';
    const PROXY_HOST = 'p2.mangoproxy.com';
    const PROXY_PORT = '2333';

    const chromeArgs = [
        '--headless=new',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--remote-debugging-port=9223',
        '--window-size=1920,1080',
        '--user-data-dir=/tmp/chrome-raw-' + Date.now()
    ];

    // Add proxy with auth directly in args (Chrome supports this format)
    if (useProxy) {
        chromeArgs.push(`--proxy-server=http://${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_PORT}`);
    }

    console.log('🚀 Starting RAW Chrome (no Puppeteer)...');
    console.log(`📍 URL: ${url}`);
    console.log(`🔐 Proxy: ${useProxy ? PROXY_USER : 'Disabled'}`);

    // Start Chrome manually
    const chrome = spawn('/usr/bin/google-chrome-stable', chromeArgs);

    // Wait for Chrome to start
    await new Promise(r => setTimeout(r, 3000));

    let client;
    try {
        // Connect via CDP
        client = await CDP({ port: 9223 });
        const { Network, Page, Runtime } = client;

        // Enable domains
        await Network.enable();
        await Page.enable();
        await Runtime.enable();

        console.log('✅ Connected to Chrome via CDP');

        // Navigate
        console.log('🌐 Navigating...');
        await Page.navigate({ url });

        // Wait for page load
        await Page.loadEventFired();
        console.log('📄 Page loaded, waiting for challenge...');

        // Wait for Qrator challenge
        await new Promise(r => setTimeout(r, 90000)); // Wait 90 seconds

        // Get page title
        const titleResult = await Runtime.evaluate({
            expression: 'document.title'
        });
        const title = titleResult.result.value;
        console.log(`📄 Title: "${title}"`);

        // Get HTML for debugging
        const htmlResult = await Runtime.evaluate({
            expression: 'document.documentElement.outerHTML'
        });
        const html = htmlResult.result.value;
        require('fs').writeFileSync(`raw_chrome_${sku}.html`, html);
        console.log(`💾 HTML saved: raw_chrome_${sku}.html`);

        if (title.toLowerCase().includes('server error')) {
            console.log('❌ Still blocked');
            console.log(JSON.stringify({ status: 'error', error: 'Qrator blocking', title }));
        } else {
            console.log('✅ Challenge bypassed! Extracting price...');

            // Extract price
            const priceResult = await Runtime.evaluate({
                expression: `
                    (() => {
                        const selectors = [
                            'span[data-testid="price-integer"]',
                            '.price-integer',
                            '[data-qa="price-integer"]',
                            'span[class*="price-integer"]'
                        ];
                        
                        for (const sel of selectors) {
                            const elem = document.querySelector(sel);
                            if (elem) {
                                let price = elem.innerText.trim().replace(/\\s/g, '').replace(/\\xa0/g, '');
                                const fracElem = document.querySelector('[data-testid="price-fraction"], .price-fraction');
                                if (fracElem) {
                                    price += '.' + fracElem.innerText.trim();
                                }
                                return price;
                            }
                        }
                        return null;
                    })()
                `
            });

            const price = priceResult.result.value;
            if (price) {
                console.log(`💰 SUCCESS! Price: ${price}`);
                console.log(JSON.stringify({ status: 'success', price, title, method: 'raw_chrome_cdp' }));
            } else {
                console.log('⚠️  Price not found');
                console.log(JSON.stringify({ status: 'error', error: 'Price not found', title }));
            }
        }

        await client.close();
        chrome.kill();

    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        console.log(JSON.stringify({ status: 'error', error: error.message }));
        if (client) await client.close();
        chrome.kill();
    }
}

run();

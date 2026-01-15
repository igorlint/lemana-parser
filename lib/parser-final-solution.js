const CDP = require('chrome-remote-interface');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function createProxyExtension(host, port, username, password) {
    const extDir = `/tmp/proxy-ext-${Date.now()}`;
    fs.mkdirSync(extDir, { recursive: true });

    const manifest = {
        version: '1.0.0',
        manifest_version: 2,
        name: 'Proxy Auth',
        permissions: ['proxy', 'tabs', 'unlimitedStorage', 'storage', '<all_urls>', 'webRequest', 'webRequestBlocking'],
        background: { scripts: ['background.js'] },
        minimum_chrome_version: '22.0.0'
    };

    const background = `
        var config = {
            mode: "fixed_servers",
            rules: {
                singleProxy: {
                    scheme: "http",
                    host: "${host}",
                    port: ${port}
                },
                bypassList: ["localhost"]
            }
        };

        chrome.proxy.settings.set({value: config, scope: "regular"}, function() {});

        function callbackFn(details) {
            return {
                authCredentials: {
                    username: "${username}",
                    password: "${password}"
                }
            };
        }

        chrome.webRequest.onAuthRequired.addListener(
            callbackFn,
            { urls: ["<all_urls>"] },
            ['blocking']
        );
    `;

    fs.writeFileSync(path.join(extDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(extDir, 'background.js'), background);

    return extDir;
}

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
        '--remote-debugging-port=9224',
        '--window-size=1920,1080',
        '--user-data-dir=/tmp/chrome-final-' + Date.now()
    ];

    let extDir;
    if (useProxy) {
        extDir = createProxyExtension(PROXY_HOST, PROXY_PORT, PROXY_USER, PROXY_PASS);
        chromeArgs.push(`--load-extension=${extDir}`);
        chromeArgs.push('--disable-extensions-except=' + extDir);
        console.log(`🔌 Proxy extension created: ${extDir}`);
    }

    console.log('🚀 Starting FINAL Chrome with proxy extension...');
    console.log(`📍 URL: ${url}`);
    console.log(`🔐 Proxy: ${useProxy ? PROXY_USER : 'Disabled'}`);

    // Start Chrome
    const chrome = spawn('/usr/bin/google-chrome-stable', chromeArgs);

    // Wait for Chrome to start
    await new Promise(r => setTimeout(r, 5000));

    let client;
    try {
        // Connect via CDP
        client = await CDP({ port: 9224 });
        const { Network, Page, Runtime } = client;

        await Network.enable();
        await Page.enable();
        await Runtime.enable();

        console.log('✅ Connected to Chrome via CDP');

        // Navigate
        console.log('🌐 Navigating...');
        await Page.navigate({ url });
        await Page.loadEventFired();

        console.log('⏳ Waiting for Qrator challenge (90s)...');
        await new Promise(r => setTimeout(r, 90000));

        // Get title
        const titleResult = await Runtime.evaluate({ expression: 'document.title' });
        const title = titleResult.result.value;
        console.log(`📄 Title: "${title}"`);

        // Save HTML
        const htmlResult = await Runtime.evaluate({ expression: 'document.documentElement.outerHTML' });
        const html = htmlResult.result.value;
        fs.writeFileSync(`final_${sku}.html`, html);
        console.log(`💾 HTML saved: final_${sku}.html`);

        if (title.toLowerCase().includes('server error') || title.toLowerCase().includes('err_')) {
            console.log('❌ Still blocked or error');
            console.log(JSON.stringify({ status: 'error', error: 'Blocked or Chrome error', title }));
        } else {
            console.log('✅ Page loaded! Extracting price...');

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
                console.log(`💰 ✅ SUCCESS! Price: ${price}`);
                console.log(JSON.stringify({ status: 'success', price, title, method: 'raw_chrome_with_extension' }));
            } else {
                console.log('⚠️  Price not found in page');
                console.log(JSON.stringify({ status: 'error', error: 'Price not found', title, html_file: `final_${sku}.html` }));
            }
        }

        await client.close();
        chrome.kill();

        // Cleanup
        if (extDir && fs.existsSync(extDir)) {
            fs.rmSync(extDir, { recursive: true, force: true });
        }

    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        console.log(JSON.stringify({ status: 'error', error: error.message }));
        if (client) await client.close();
        chrome.kill();
        if (extDir && fs.existsSync(extDir)) {
            fs.rmSync(extDir, { recursive: true, force: true });
        }
    }
}

run();

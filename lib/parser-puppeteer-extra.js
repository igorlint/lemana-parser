const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const useProxy = require('puppeteer-page-proxy');

puppeteer.use(StealthPlugin());

async function run() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log(JSON.stringify({ status: 'error', error: 'Missing arguments' }));
        return;
    }

    const sku = args[0];
    const subdomain = args[1];
    const originalUrl = args[2] || '';
    const enableProxy = args[3] === 'true';

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

    const launchOptions = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--window-size=1920,1080'
        ]
    };

    let proxyUrl = null;
    if (enableProxy) {
        const username = 'xhv18ztqs15-zone-static-region-ru';
        const password = 'pompbza2v7efm';
        const host = 'p2.mangoproxy.com';
        const port = 2333;

        const sessionId = Math.floor(Math.random() * 900000) + 100000;
        const proxyUser = `${username}-session-${sessionId}`;

        proxyUrl = `http://${proxyUser}:${password}@${host}:${port}`;
    }

    let browser;
    try {
        browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();

        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

        await page.setExtraHTTPHeaders({
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
        });

        // Navigate with retry logic
        let retries = 3;
        for (let attempt = 0; attempt < retries; attempt++) {
            if (proxyUrl) {
                await useProxy(page, proxyUrl);
            }

            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await new Promise(r => setTimeout(r, 5000));

            const title = await page.title();
            const content = await page.content();

            if (title.toLowerCase().includes('server error') || title.includes('403') ||
                content.toLowerCase().includes('__qrator') || content.toLowerCase().includes('vpn')) {
                if (attempt < retries - 1) {
                    await new Promise(r => setTimeout(r, 20000));
                    await page.reload();
                } else {
                    break;
                }
            } else {
                break;
            }
        }

        await new Promise(r => setTimeout(r, 10000));

        // Extract price
        const selectors = [
            'span[data-testid="price-integer"]',
            '.price-integer',
            '[data-qa="price-integer"]',
            'span[class*="price-integer"]'
        ];

        let price = null;
        for (const sel of selectors) {
            try {
                const priceInt = await page.$eval(sel, el => el.innerText);
                if (priceInt) {
                    let cleanPrice = priceInt.trim().replace(/\s/g, '').replace(/\xa0/g, '');

                    try {
                        const priceFrac = await page.$eval('[data-testid="price-fraction"], .price-fraction', el => el.innerText);
                        if (priceFrac) {
                            price = `${cleanPrice}.${priceFrac.trim()}`;
                        } else {
                            price = cleanPrice;
                        }
                    } catch {
                        price = cleanPrice;
                    }
                    break;
                }
            } catch {
                continue;
            }
        }

        if (price) {
            console.log(JSON.stringify({ status: 'success', price: price }));
        } else {
            await page.screenshot({ path: 'puppeteer_extra_fail.png' });
            const title = await page.title();
            const content = await page.content();
            console.log(JSON.stringify({
                status: 'error',
                error: 'Price not found',
                title: title,
                screenshot: 'puppeteer_extra_fail.png',
                source_snippet: content.substring(0, 500)
            }));
        }

    } catch (error) {
        console.log(JSON.stringify({ status: 'error', error: error.message }));
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

run();

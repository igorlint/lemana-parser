const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

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

    const PROXY_HOST = 'p2.mangoproxy.com';
    const PROXY_PORT = '2333';
    const PROXY_USER_BASE = 'xhv18ztqs15-zone-static-region-ru';
    const PROXY_PASS = 'pompbza2v7efm';
    const sessionId = Math.floor(Math.random() * 1000000);
    const PROXY_USER = `${PROXY_USER_BASE}-session-${sessionId}`;

    const launchArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled'
    ];

    if (useProxy) {
        launchArgs.push(`--proxy-server=${PROXY_HOST}:${PROXY_PORT}`);
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: launchArgs
        });

        const page = await browser.newPage();

        if (useProxy) {
            await page.authenticate({
                username: PROXY_USER,
                password: PROXY_PASS
            });
        }

        // Set realistic headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'ru-RU,ru;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

        console.log(`Navigating to ${url}...`);

        // Navigate with longer timeout
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });

        // Wait for page to settle
        await new Promise(r => setTimeout(r, 15000));

        const title = await page.title();
        console.log(`Title: ${title}`);

        // Check for Qrator
        const content = await page.content();
        if (title.toLowerCase().includes('server error') || content.toLowerCase().includes('__qrator')) {
            await page.screenshot({ path: 'final_fail.png' });
            console.log(JSON.stringify({
                status: 'error',
                error: 'Qrator detected',
                title: title,
                screenshot: 'final_fail.png'
            }));
            await browser.close();
            return;
        }

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
            await page.screenshot({ path: 'no_price.png' });
            console.log(JSON.stringify({
                status: 'error',
                error: 'Price not found',
                title: title,
                screenshot: 'no_price.png',
                source_snippet: content.substring(0, 500)
            }));
        }

        await browser.close();

    } catch (error) {
        console.log(JSON.stringify({ status: 'error', error: error.message }));
        if (browser) {
            await browser.close();
        }
    }
}

run();

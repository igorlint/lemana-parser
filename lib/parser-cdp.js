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

    let browser;
    try {
        // Connect to existing Chrome instance via CDP
        browser = await puppeteer.connect({
            browserURL: 'http://127.0.0.1:9222',
            defaultViewport: null
        });

        const pages = await browser.pages();
        const page = pages[0] || await browser.newPage();

        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for potential Qrator challenge
        await new Promise(r => setTimeout(r, 10000));

        const title = await page.title();
        console.log(`Page title: ${title}`);

        // Check for Qrator block
        const content = await page.content();
        if (title.toLowerCase().includes('server error') || content.toLowerCase().includes('__qrator')) {
            console.log(JSON.stringify({
                status: 'error',
                error: 'Qrator block detected',
                title: title
            }));
            await browser.disconnect();
            return;
        }

        // Wait a bit more for dynamic content
        await new Promise(r => setTimeout(r, 5000));

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
            await page.screenshot({ path: 'cdp_fail.png' });
            console.log(JSON.stringify({
                status: 'error',
                error: 'Price not found',
                title: title,
                screenshot: 'cdp_fail.png',
                source_snippet: content.substring(0, 500)
            }));
        }

        await browser.disconnect();

    } catch (error) {
        console.log(JSON.stringify({ status: 'error', error: error.message }));
        if (browser) {
            await browser.disconnect();
        }
    }
}

run();

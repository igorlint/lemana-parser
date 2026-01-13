const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function run() {
    const sku = '82471809';
    const subdomain = 'tula';
    const url = `https://${subdomain}.lemanapro.ru/search/?q=${sku}`;

    console.log('Launching browser with Stealth Plugin (headless: false)...');

    const browser = await puppeteer.launch({
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1920,1080'
        ],
        ignoreDefaultArgs: ['--enable-automation']
    });

    try {
        const page = await browser.newPage();

        // Extensive realistic headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1'
        });

        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });

        console.log(`Navigating to homepage first...`);
        await page.goto('https://lemanapro.ru/', { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Random mouse movement to simulate human
        await page.mouse.move(100, 100);
        await page.mouse.down();
        await new Promise(r => setTimeout(r, 200));
        await page.mouse.up();
        await new Promise(r => setTimeout(r, 2000));

        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for price element
        try {
            await page.waitForSelector('[data-testid="price-integer"]', { timeout: 30000 });
            const price = await page.evaluate(() => {
                const intEl = document.querySelector('[data-testid="price-integer"]');
                const fracEl = document.querySelector('[data-testid="price-fraction"]');
                if (intEl) return intEl.textContent + (fracEl ? '.' + fracEl.textContent : '');
                return null;
            });
            console.log(`SUCCESS! Price found: ${price}`);
        } catch (e) {
            console.log('Timeout waiting for price.');
            const title = await page.title();
            console.log(`Current page title: ${title}`);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        // Keep browser open for a bit to let user see
        await new Promise(r => setTimeout(r, 10000));
        await browser.close();
    }
}

run();

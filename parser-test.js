const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function run() {
    const sku = '82471809';
    const subdomain = 'tula';
    const url = `https://${subdomain}.lemanapro.ru/search/?q=${sku}`;

    console.log('Launching browser (headless: false)...');
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });

        console.log(`Navigating to homepage first...`);
        await page.goto('https://lemanapro.ru', { waitUntil: 'domcontentloaded', timeout: 60000 });

        console.log('Please solve any CAPTCHA or Qrator challenge on the screen!');
        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for price element for 120s to give user time to solve captcha
        try {
            await page.waitForSelector('[data-testid="price-integer"]', { timeout: 120000 });
        } catch (e) {
            console.log('Timeout waiting for price (120s).');
        }

        const title = await page.title();
        console.log(`Page title: ${title}`);

        const content = await page.content();
        console.log(`Page content length: ${content.length}`);
        console.log(`Page content preview: ${content.substring(0, 500)}`);

        await page.screenshot({ path: 'debug_standalone.png' });
        console.log('Screenshot saved to debug_standalone.png');

        const price = await page.evaluate(() => {
            const intEl = document.querySelector('[data-testid="price-integer"]');
            if (intEl) return intEl.textContent;
            return null;
        });

        console.log(`Price found: ${price}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await browser.close();
    }
}

run();

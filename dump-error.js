const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function run() {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        console.log('Navigating to Moscow...');
        await page.goto('https://lemanapro.ru/search/?q=82471809', { waitUntil: 'networkidle2' });

        await new Promise(r => setTimeout(r, 10000));

        const content = await page.content();
        console.log('CONTENT START');
        console.log(content.substring(0, 2000));
        console.log('CONTENT END');

    } catch (err) {
        console.error(err);
    } finally {
        await browser.close();
    }
}

run();

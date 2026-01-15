const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const Xvfb = require('xvfb');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function run() {
    const xvfb = new Xvfb({
        silent: true,
        xvfb_args: ["-screen", "0", "1920x1080x24", "-ac"]
    });
    xvfb.startSync();

    const host = 'p2.mangoproxy.com';
    const port = 2333;
    const username = 'xhv18ztqs15-zone-static-region-ru';
    const password = 'pompbza2v7efm';

    const browser = await puppeteer.launch({
        headless: false,
        executablePath: '/usr/bin/google-chrome-stable',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            `--proxy-server=${host}:${port}`,
            '--disable-blink-features=AutomationControlled'
        ]
    });

    try {
        const page = await browser.newPage();
        await page.authenticate({ username, password });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

        console.log('Navigating to root page to get baseline cookies...');
        await page.goto('https://lemanapro.ru/', { waitUntil: 'networkidle2', timeout: 60000 });

        console.log('Navigating to product page...');
        const url = 'https://pskov.lemanapro.ru/product/elektricheskaya-varochnaya-panel-hansa-bhc36106-30-sm-2-konforki-cvet-chernyy-82471809/?fromRegion=506';
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        console.log('Status:', response.status());
        await new Promise(r => setTimeout(r, 10000));

        const data = await page.evaluate(() => {
            return {
                title: document.title,
                initialState: typeof window.INITIAL_STATE !== 'undefined' ? 'Found' : 'Not Found',
                scripts: Array.from(document.querySelectorAll('script')).map(s => s.src || 'inline'),
                bodyTextLength: document.body.innerText.length
            };
        });

        console.log('Extracted Data:', JSON.stringify(data, null, 2));

        if (data.initialState === 'Found') {
            const fullState = await page.evaluate(() => window.INITIAL_STATE);
            fs.writeFileSync('initial_state.json', JSON.stringify(fullState, null, 2));
            console.log('Saved window.INITIAL_STATE to initial_state.json');
        }

        const html = await page.content();
        fs.writeFileSync('page_content.html', html);
        console.log('Saved full HTML to page_content.html');

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await browser.close();
        xvfb.stopSync();
    }
}

run();

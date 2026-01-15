const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const Xvfb = require('xvfb');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

async function run() {
    const xvfb = new Xvfb({
        silent: true,
        xvfb_args: ["-screen", "0", "1920x1080x24", "-ac"]
    });
    xvfb.startSync();

    const browser = await puppeteer.launch({
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        const requests = [];
        page.on('response', response => {
            const url = response.url();
            if (url.includes('api') || url.includes('json') || url.includes('gql') || url.includes('graphql')) {
                requests.push({
                    url: url,
                    status: response.status(),
                    type: response.request().resourceType()
                });
            }
        });

        console.log('Navigating to product page...');
        const url = 'https://pskov.lemanapro.ru/product/elektricheskaya-varochnaya-panel-hansa-bhc36106-30-sm-2-konforki-cvet-chernyy-82471809/';
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        await new Promise(r => setTimeout(r, 5000));

        fs.writeFileSync('network_log.json', JSON.stringify(requests, null, 2));
        console.log(`Captured ${requests.length} potential API requests.`);

        const title = await page.title();
        console.log('Final Title:', title);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await browser.close();
        xvfb.stopSync();
    }
}

run();

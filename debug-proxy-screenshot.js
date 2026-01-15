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
    const username = 'xhv18ztqs15-zone-static-region-ru'; // No session for this test
    const password = 'pompbza2v7efm';

    const browser = await puppeteer.launch({
        headless: false,
        executablePath: '/usr/bin/google-chrome-stable',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            `--proxy-server=${host}:${port}`
        ]
    });

    try {
        const page = await browser.newPage();
        await page.authenticate({ username, password });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log('Navigating...');
        const url = 'https://pskov.lemanapro.ru/product/elektricheskaya-varochnaya-panel-hansa-bhc36106-30-sm-2-konforki-cvet-chernyy-82471809/?fromRegion=506';
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        console.log('Status:', response.status());
        await new Promise(r => setTimeout(r, 15000)); // Wait for Qrator

        const title = await page.title();
        const content = await page.content();
        console.log('Title:', title);
        console.log('Content Start:', content.substring(0, 500));

        await page.screenshot({ path: 'debug_proxy.png', fullPage: true });
        console.log('Screenshot saved to debug_proxy.png');

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await browser.close();
        xvfb.stopSync();
    }
}

run();

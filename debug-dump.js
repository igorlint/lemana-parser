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
            '--disable-setuid-sandbox',
            '--display=' + process.env.DISPLAY
        ]
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log('Navigating...');
        await page.goto('https://lemanapro.ru/search/?q=82471809', { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for a bit for challenges
        await new Promise(r => setTimeout(r, 10000));

        const html = await page.content();
        fs.writeFileSync('page_dump.html', html);

        const title = await page.title();
        console.log('Title:', title);

        await page.screenshot({ path: 'debug_screenshot.png' });
        console.log('Screenshot saved.');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await browser.close();
        xvfb.stopSync();
    }
}

run();

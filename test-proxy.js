const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function testProxy() {
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
        `--proxy-server=${PROXY_HOST}:${PROXY_PORT}`
    ];

    const browser = await puppeteer.launch({
        headless: true,
        args: launchArgs
    });

    const page = await browser.newPage();

    await page.authenticate({
        username: PROXY_USER,
        password: PROXY_PASS
    });

    console.log('Testing proxy connection...');
    await page.goto('https://api.ipify.org?format=json');
    const content = await page.content();
    console.log('IP Response:', content);

    await browser.close();
}

testProxy().catch(console.error);

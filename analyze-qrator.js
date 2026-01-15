const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function analyzeQrator() {
    const PROXY_HOST = 'p2.mangoproxy.com';
    const PROXY_PORT = '2333';
    const PROXY_USER = `xhv18ztqs15-zone-static-region-ru-session-${Math.floor(Math.random() * 1000000)}`;
    const PROXY_PASS = 'pompbza2v7efm';

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            `--proxy-server=${PROXY_HOST}:${PROXY_PORT}`
        ]
    });

    const page = await browser.newPage();
    await page.authenticate({ username: PROXY_USER, password: PROXY_PASS });

    // Intercept all requests to see what Qrator is doing
    await page.setRequestInterception(true);
    const requests = [];

    page.on('request', request => {
        requests.push({
            url: request.url(),
            method: request.method(),
            headers: request.headers(),
            postData: request.postData()
        });
        request.continue();
    });

    page.on('response', async response => {
        const url = response.url();
        if (url.includes('qrator') || url.includes('challenge')) {
            console.log('\n=== QRATOR RESPONSE ===');
            console.log('URL:', url);
            console.log('Status:', response.status());
            console.log('Headers:', response.headers());
            try {
                const text = await response.text();
                console.log('Body:', text.substring(0, 500));
            } catch (e) { }
        }
    });

    console.log('Navigating to Lemana Pro...');
    await page.goto('https://pskov.lemanapro.ru/product/elektricheskaya-varochnaya-panel-hansa-bhc36106-30-sm-2-konforki-cvet-chernyy-82471809/', {
        waitUntil: 'networkidle0',
        timeout: 60000
    });

    // Wait for potential challenge
    await new Promise(r => setTimeout(r, 5000));

    // Get page content
    const content = await page.content();
    const title = await page.title();

    console.log('\n=== PAGE INFO ===');
    console.log('Title:', title);
    console.log('URL:', page.url());

    // Save full HTML for analysis
    fs.writeFileSync('qrator_page.html', content);
    console.log('Saved page to qrator_page.html');

    // Extract all scripts
    const scripts = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('script')).map(s => ({
            src: s.src,
            content: s.innerHTML.substring(0, 200)
        }));
    });

    console.log('\n=== SCRIPTS ===');
    scripts.forEach((s, i) => {
        console.log(`Script ${i}:`, s.src || 'inline');
        if (s.content) console.log('  Content preview:', s.content);
    });

    // Check for Qrator-specific elements
    const qratorElements = await page.evaluate(() => {
        const elements = [];
        document.querySelectorAll('*').forEach(el => {
            const id = el.id || '';
            const className = el.className || '';
            if (id.includes('qrator') || id.includes('__') || className.includes('qrator')) {
                elements.push({
                    tag: el.tagName,
                    id: el.id,
                    class: el.className,
                    text: el.textContent?.substring(0, 100)
                });
            }
        });
        return elements;
    });

    console.log('\n=== QRATOR ELEMENTS ===');
    console.log(JSON.stringify(qratorElements, null, 2));

    // Check cookies
    const cookies = await page.cookies();
    console.log('\n=== COOKIES ===');
    cookies.forEach(c => {
        console.log(`${c.name}: ${c.value.substring(0, 50)}...`);
    });

    // Save screenshot
    await page.screenshot({ path: 'qrator_analysis.png', fullPage: true });
    console.log('\nScreenshot saved to qrator_analysis.png');

    // Save all requests
    fs.writeFileSync('qrator_requests.json', JSON.stringify(requests, null, 2));
    console.log('Requests saved to qrator_requests.json');

    await browser.close();
}

analyzeQrator().catch(console.error);

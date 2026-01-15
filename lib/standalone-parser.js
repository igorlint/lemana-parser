const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const Xvfb = require('xvfb');
const path = require('path');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    const args = process.argv.slice(2);
    const sku = args[0];
    const subdomain = args[1] || 'moscow';
    const originalUrl = args[2] || '';
    const useProxy = args[3] === 'true';
    const regionPrefix = (subdomain === 'moscow' || !subdomain) ? '' : `${subdomain}.`;

    const PROXY_HOST = 'p2.mangoproxy.com';
    const PROXY_PORT = '2333';
    const PROXY_USER_BASE = 'xhv18ztqs15-zone-static-region-ru';
    const PROXY_PASS = 'pompbza2v7efm';

    // Add random session ID to keep IP sticky for one full page load
    const sessionId = Math.floor(Math.random() * 1000000);
    const PROXY_USER = `${PROXY_USER_BASE}-session-${sessionId}`;

    let url = '';

    // Use direct product URL instead of search, and add region parameter
    if (originalUrl && originalUrl.includes('/product/')) {
        const parts = originalUrl.split('/product/');
        const slugAndRest = parts[1];
        url = `https://${regionPrefix}lemanapro.ru/product/${slugAndRest}`;
        if (!url.includes('fromRegion')) {
            url += (url.includes('?') ? '&' : '?') + 'fromRegion=34';
        }
    } else {
        url = `https://${regionPrefix}lemanapro.ru/search/?q=${sku}&fromRegion=34`;
    }

    let xvfb = null;
    let browser = null;

    try {
        if (process.platform === 'linux') {
            xvfb = new Xvfb({
                silent: true,
                xvfb_args: ["-screen", "0", "1920x1080x24", "-ac"]
            });
            xvfb.startSync();
        }
        const launchArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
            '--window-size=1920,1080'
        ];

        if (useProxy) {
            launchArgs.push(`--proxy-server=${PROXY_HOST}:${PROXY_PORT}`);
        }

        const executablePath = '/usr/bin/google-chrome-stable';
        const launchOptions = {
            headless: false,
            args: launchArgs,
            ignoreDefaultArgs: ['--enable-automation'],
            slowMo: 50 // Subtle delay to look more human
        };

        if (fs.existsSync(executablePath)) {
            launchOptions.executablePath = executablePath;
        }

        browser = await puppeteer.launch(launchOptions);

        const page = await browser.newPage();

        if (useProxy) {
            await page.authenticate({
                username: PROXY_USER,
                password: PROXY_PASS
            });
        }

        // Set realistic headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        });

        // Use a consistent Desktop User-Agent for better stability
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });

        // Step 1: Baseline load of root to clear Qrator initial check
        console.log('Fetching baseline cookies from root...');
        await page.goto('https://lemanapro.ru/', { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => { });
        await delay(5000);

        console.log(`Navigating to target ${url}...`);
        const response = await page.goto(url, {
            waitUntil: 'domcontentloaded', // Use lighter wait initially
            timeout: 90000
        }).catch(e => {
            console.log(`Navigation failed: ${e.message}`);
            return null;
        });

        if (response) {
            console.log(`HTTP Status: ${response.status()}`);
        }

        // Loop to wait for Qrator to resolve or retry
        let retries = 3;
        while (retries > 0) {
            const title = await page.title();
            const content = await page.content();
            console.log(`Current Title: "${title}", Content Length: ${content.length}`);

            if (title.includes('Server error') || title.includes('403') || title === '' || content.includes('__qrator')) {
                console.log(`Challenge detected. Waiting 45s for auto-resolve... (${retries} retries left)`);
                await delay(45000); // 227KB script needs time
                await page.reload({ waitUntil: 'networkidle2' }).catch(() => { });
            } else {
                break;
            }
            retries--;
        }

        // Final wait for JS to render price
        await delay(15000);

        const result = await page.evaluate(() => {
            function extractPrice() {
                // Check for Qrator error
                if (document.title.includes('Server error') || document.title.includes('403') || document.title.includes('Shield')) {
                    return 'ERROR_BOT_DETECTED';
                }

                // Try common selectors
                const selectors = [
                    '[data-testid="price-integer"]',
                    '.price-integer',
                    '[data-qa="price-integer"]',
                    'span[class*="price-integer"]',
                    '[data-qa="product-card-price"]'
                ];

                for (const sel of selectors) {
                    const el = document.querySelector(sel);
                    if (el) {
                        if (sel.includes('card-price')) return el.textContent.trim().replace(/[^\d.,]/g, '').replace(',', '.');
                        const parent = el.parentElement;
                        const fracEl = parent ? parent.querySelector('[data-testid="price-fraction"], .price-fraction, [data-qa="price-fraction"]') : null;
                        return el.textContent.trim().replace(/\s/g, '') + (fracEl ? '.' + fracEl.textContent.trim() : '');
                    }
                }

                // Final fallback - search the whole page for something that looks like a price near currency
                const text = document.body.innerText;
                const priceMatch = text.match(/(\d[\d\s,.]*)[\s]*[₽руб]/);
                if (priceMatch) return priceMatch[1].trim().replace(/\s/g, '').replace(',', '.');

                return null;
            }
            return extractPrice();
        });

        if (result === 'ERROR_BOT_DETECTED') {
            const title = await page.title();
            console.log(JSON.stringify({ status: 'error', error: 'Bot detected by Qrator', title }));
        } else if (result) {
            console.log(JSON.stringify({ status: 'success', price: result }));
        } else {
            const title = await page.title();
            console.log(JSON.stringify({ status: 'error', error: 'Price not found', title }));
        }

    } catch (err) {
        console.log(JSON.stringify({ status: 'error', error: err.message }));
    } finally {
        if (browser) await browser.close();
        if (xvfb) xvfb.stopSync();
    }
}

run();

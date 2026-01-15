const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function run() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log(JSON.stringify({ status: 'error', error: 'Missing arguments' }));
        return;
    }

    const sku = args[0];
    const subdomain = args[1];
    const originalUrl = args[2] || '';
    const useProxy = args[3] === 'true';

    const regionPrefix = ['moscow', ''].includes(subdomain) ? '' : `${subdomain}.`;
    const regId = subdomain === 'pskov' ? '506' : '34';

    let url;
    if (originalUrl && originalUrl.includes('/product/')) {
        const parts = originalUrl.split('/product/');
        const slugAndRest = parts[1];
        url = `https://${regionPrefix}lemanapro.ru/product/${slugAndRest}`;
        if (!url.includes('fromRegion')) {
            url += (url.includes('?') ? '&' : '?') + `fromRegion=${regId}`;
        }
    } else {
        url = `https://${regionPrefix}lemanapro.ru/search/?q=${sku}&fromRegion=${regId}`;
    }

    const PROXY_HOST = 'p2.mangoproxy.com';
    const PROXY_PORT = '2333';
    const PROXY_USER = `xhv18ztqs15-zone-static-region-ru-session-${Math.floor(Math.random() * 1000000)}`;
    const PROXY_PASS = 'pompbza2v7efm';

    const launchArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled'
    ];

    if (useProxy) {
        launchArgs.push(`--proxy-server=${PROXY_HOST}:${PROXY_PORT}`);
    }

    let browser;
    try {
        console.log('🚀 Starting hybrid parser...');
        console.log(`📍 URL: ${url}`);
        console.log(`🔐 Proxy: ${useProxy ? 'Enabled' : 'Disabled'}`);

        browser = await puppeteer.launch({
            headless: true,
            args: launchArgs
        });

        const page = await browser.newPage();

        if (useProxy) {
            await page.authenticate({ username: PROXY_USER, password: PROXY_PASS });
            console.log(`✅ Proxy authenticated: ${PROXY_USER}`);
        }

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'ru-RU,ru;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        });

        console.log('🌐 Navigating to page...');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });

        console.log('⏳ Waiting for Qrator challenge (this may take up to 2 minutes)...');

        // Take screenshots at intervals
        const screenshots = [];
        const waitIntervals = [15, 30, 60, 90]; // seconds

        for (let i = 0; i < waitIntervals.length; i++) {
            const waitTime = i === 0 ? waitIntervals[i] : (waitIntervals[i] - waitIntervals[i - 1]);
            await new Promise(r => setTimeout(r, waitTime * 1000));

            const title = await page.title();
            const screenshotPath = `hybrid_${sku}_${waitIntervals[i]}s.png`;
            await page.screenshot({ path: screenshotPath, fullPage: true });
            screenshots.push(screenshotPath);

            console.log(`📸 Screenshot at ${waitIntervals[i]}s: ${screenshotPath}`);
            console.log(`   Title: "${title}"`);

            // Check if challenge resolved
            if (!title.toLowerCase().includes('server error') && title !== '') {
                console.log('✅ Challenge appears resolved!');
                break;
            }
        }

        // Final wait
        await new Promise(r => setTimeout(r, 5000));

        const finalTitle = await page.title();
        const finalScreenshot = `hybrid_${sku}_final.png`;
        await page.screenshot({ path: finalScreenshot, fullPage: true });

        console.log(`📸 Final screenshot: ${finalScreenshot}`);
        console.log(`📄 Final title: "${finalTitle}"`);

        // Try to extract price
        console.log('💰 Attempting price extraction...');

        const selectors = [
            'span[data-testid="price-integer"]',
            '.price-integer',
            '[data-qa="price-integer"]',
            'span[class*="price-integer"]'
        ];

        let price = null;
        for (const sel of selectors) {
            try {
                const priceInt = await page.$eval(sel, el => el.innerText);
                if (priceInt) {
                    let cleanPrice = priceInt.trim().replace(/\s/g, '').replace(/\xa0/g, '');
                    try {
                        const priceFrac = await page.$eval('[data-testid="price-fraction"], .price-fraction', el => el.innerText);
                        if (priceFrac) {
                            price = `${cleanPrice}.${priceFrac.trim()}`;
                        } else {
                            price = cleanPrice;
                        }
                    } catch {
                        price = cleanPrice;
                    }
                    break;
                }
            } catch {
                continue;
            }
        }

        // Save page HTML for manual inspection
        const html = await page.content();
        fs.writeFileSync(`hybrid_${sku}_page.html`, html);
        console.log(`💾 Page HTML saved: hybrid_${sku}_page.html`);

        if (price) {
            console.log(`✅ SUCCESS! Price found: ${price}`);
            console.log(JSON.stringify({
                status: 'success',
                price: price,
                screenshots: screenshots.concat([finalScreenshot]),
                title: finalTitle
            }));
        } else {
            console.log('⚠️  Price not found automatically');
            console.log('📋 Manual verification required:');
            console.log(`   1. Check screenshots: ${screenshots.join(', ')}`);
            console.log(`   2. Check HTML: hybrid_${sku}_page.html`);
            console.log(`   3. Final title: "${finalTitle}"`);

            const content = await page.content();
            console.log(JSON.stringify({
                status: 'manual_check_required',
                error: 'Price not found automatically',
                title: finalTitle,
                screenshots: screenshots.concat([finalScreenshot]),
                html_file: `hybrid_${sku}_page.html`,
                source_snippet: content.substring(0, 500)
            }));
        }

        await browser.close();

    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        console.log(JSON.stringify({ status: 'error', error: error.message }));
        if (browser) {
            await browser.close();
        }
    }
}

run();

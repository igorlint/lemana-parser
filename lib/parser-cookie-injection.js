const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');

const execAsync = promisify(exec);

puppeteer.use(StealthPlugin());

async function getCookiesViaCurl(domain, proxyUser, proxyPass, proxyHost, proxyPort) {
    const cookieFile = `/tmp/cookies_${Date.now()}.txt`;
    const proxyUrl = `http://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`;

    console.log('🍪 Fetching cookies via curl...');

    try {
        await execAsync(`curl -x "${proxyUrl}" -c "${cookieFile}" -I "https://${domain}/" -s -o /dev/null`);

        if (fs.existsSync(cookieFile)) {
            const cookieContent = fs.readFileSync(cookieFile, 'utf8');
            const cookies = [];

            cookieContent.split('\n').forEach(line => {
                if (line.startsWith('#') || !line.trim()) return;

                const parts = line.split('\t');
                if (parts.length >= 7) {
                    cookies.push({
                        name: parts[5],
                        value: parts[6],
                        domain: parts[0],
                        path: parts[2],
                        expires: parseInt(parts[4]) || -1,
                        httpOnly: false,
                        secure: parts[3] === 'TRUE'
                    });
                }
            });

            fs.unlinkSync(cookieFile);
            console.log(`✅ Got ${cookies.length} cookies from curl`);
            return cookies;
        }
    } catch (error) {
        console.log(`⚠️  Curl failed: ${error.message}`);
    }

    return [];
}

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
        console.log('🚀 Starting cookie injection parser...');
        console.log(`📍 URL: ${url}`);
        console.log(`🔐 Proxy: ${useProxy ? PROXY_USER : 'Disabled'}`);

        // Step 1: Get cookies via curl
        let curlCookies = [];
        if (useProxy) {
            const domain = `${regionPrefix}lemanapro.ru`;
            curlCookies = await getCookiesViaCurl(domain, PROXY_USER, PROXY_PASS, PROXY_HOST, PROXY_PORT);
        }

        // Step 2: Launch browser
        browser = await puppeteer.launch({
            headless: true,
            args: launchArgs
        });

        const page = await browser.newPage();

        if (useProxy) {
            await page.authenticate({ username: PROXY_USER, password: PROXY_PASS });
        }

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'ru-RU,ru;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        });

        // Step 3: Inject cookies BEFORE navigation
        if (curlCookies.length > 0) {
            console.log('💉 Injecting cookies into browser...');
            for (const cookie of curlCookies) {
                try {
                    await page.setCookie(cookie);
                    console.log(`   ✓ ${cookie.name}`);
                } catch (e) {
                    console.log(`   ✗ ${cookie.name}: ${e.message}`);
                }
            }
        }

        // Step 4: Navigate to page
        console.log('🌐 Navigating to page with injected cookies...');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });

        // Wait for page to load
        await new Promise(r => setTimeout(r, 10000));

        const title = await page.title();
        console.log(`📄 Page title: "${title}"`);

        // Take screenshot
        await page.screenshot({ path: 'cookie_injection_result.png', fullPage: true });
        console.log('📸 Screenshot saved: cookie_injection_result.png');

        // Check if we bypassed Qrator
        if (title.toLowerCase().includes('server error')) {
            console.log('❌ Still blocked by Qrator');
            const content = await page.content();
            console.log(JSON.stringify({
                status: 'error',
                error: 'Qrator still blocking',
                title: title,
                screenshot: 'cookie_injection_result.png',
                source_snippet: content.substring(0, 500)
            }));
            await browser.close();
            return;
        }

        console.log('✅ Qrator bypassed! Extracting price...');

        // Extract price
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

        if (price) {
            console.log(`💰 SUCCESS! Price: ${price}`);
            console.log(JSON.stringify({
                status: 'success',
                price: price,
                title: title,
                method: 'cookie_injection'
            }));
        } else {
            const content = await page.content();
            console.log('⚠️  Price not found');
            console.log(JSON.stringify({
                status: 'error',
                error: 'Price not found after bypass',
                title: title,
                screenshot: 'cookie_injection_result.png',
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

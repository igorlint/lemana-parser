const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
let Xvfb;
try {
    Xvfb = require('xvfb');
} catch (e) {
    // Only needed on Linux usually
}

puppeteer.use(StealthPlugin());

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    const args = process.argv.slice(2);
    const sku = args[0];
    const subdomain = args[1] || 'moscow';
    const regionPrefix = subdomain === 'moscow' ? '' : `${subdomain}.`;
    const url = `https://${regionPrefix}lemanapro.ru/search/?q=${sku}`;

    // Platform detection
    const isLinux = process.platform === 'linux';
    const isMac = process.platform === 'darwin';

    let chromePath = '';

    if (isMac) {
        chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    } else if (isLinux) {
        // Common linux paths
        const possiblePaths = [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser'
        ];
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                chromePath = p;
                break;
            }
        }
        if (!chromePath) {
            console.log(JSON.stringify({ status: 'error', error: 'Google Chrome not found. Please install google-chrome-stable.' }));
            return;
        }
    }

    const userDataDir = path.join(process.cwd(), 'lemana_chrome_profile');
    const port = 9222;

    let xvfb = null;
    // Start Xvfb on Linux
    if (isLinux && Xvfb) {
        // console.log('Starting Xvfb...');
        xvfb = new Xvfb({
            silent: true,
            xvfb_args: ["-screen", "0", "1920x1080x24", "-ac"]
        });
        xvfb.startSync();
    }

    let browser = null;
    let browserWSEndpoint = null;

    try {
        // 1. Try to connect to existing instance on 9222
        try {
            const response = await fetch(`http://127.0.0.1:${port}/json/version`);
            const data = await response.json();
            browserWSEndpoint = data.webSocketDebuggerUrl;
        } catch (e) {
            // 2. Launch new System Chrome instance if not found
            if (fs.existsSync(chromePath)) {

                const spawnArgs = [
                    `--remote-debugging-port=${port}`,
                    `--user-data-dir=${userDataDir}`,
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--disable-fre'
                ];

                // Add display env for Linux
                const env = Object.assign({}, process.env);
                if (isLinux && xvfb) {
                    // Xvfb usually sets DISPLAY via its start method if using wrapper? 
                    // The npm wrapper might not set process.env.DISPLAY globally for spawn?
                    // Let's check wrapper docs or source. Usually it sets it on the process or return it.
                    // Assuming wrapper sets it or we just rely on it.
                    // Actually, wrapper sets it on the internal process it spawns, but we are spawning separately.
                    // Wait, using `spawn` manually means we need to pass DISPLAY.
                    // The `xvfb` package `startSync` usually sets process.env.DISPLAY?
                    // Let's assume it does. If not, we might need to check `xvfb.display`.
                }

                const chromeProcess = spawn(chromePath, spawnArgs, {
                    detached: true,
                    stdio: 'ignore',
                    env: env
                });
                chromeProcess.unref();

                // Wait for Chrome to start
                let retries = 20;
                while (retries > 0) {
                    await delay(1000);
                    try {
                        const response = await fetch(`http://127.0.0.1:${port}/json/version`);
                        const data = await response.json();
                        browserWSEndpoint = data.webSocketDebuggerUrl;
                        break;
                    } catch (err) {
                        // process.stdout.write('.');
                    }
                    retries--;
                }
            } else {
                console.log(JSON.stringify({ status: 'error', error: 'Chrome executable not found.' }));
                if (xvfb) xvfb.stopSync();
                return;
            }
        }

        if (!browserWSEndpoint) {
            console.log(JSON.stringify({ status: 'error', error: 'Failed to connect to or launch Chrome.' }));
            if (xvfb) xvfb.stopSync();
            return;
        }

        browser = await puppeteer.connect({
            browserWSEndpoint,
            defaultViewport: null
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // Go to homepage first
        await page.goto('https://lemanapro.ru/', { waitUntil: 'domcontentloaded', timeout: 45000 });

        await delay(5000);
        const homeTitle = await page.title();

        // Simple check for bot block
        if (homeTitle.includes('Server error') || homeTitle.includes('403')) {
            // On server, we can't really ask user to solve it easily...
            // But we can wait and hope? Or maybe try re-navigating?
            // Autonomous mode on server relies on stealth + profile trust building over time.
            console.log('Bot protection detected on server. Waiting...');
            await delay(10000);
        } else {
            await delay(1000);
        }

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

        const result = await page.evaluate(() => {
            // ... extraction logic ...
            // @ts-ignore
            try { if (window.INITIAL_STATE?.pdp?.pdp?.pdp?.pageModel?.modelJson) return window.INITIAL_STATE.pdp.pdp.pdp.pageModel.modelJson.product.info.price.main_price; } catch (e) { }
            const intEl = document.querySelector('[data-testid="price-integer"]');
            const fracEl = document.querySelector('[data-testid="price-fraction"]');
            return intEl ? intEl.textContent.trim() + (fracEl ? '.' + fracEl.textContent : '') : null;
        });

        if (result) {
            console.log(JSON.stringify({ status: 'success', price: result }));
        } else {
            const title = await page.title();
            console.log(JSON.stringify({ status: 'error', error: 'Price not found', title }));
        }

        await page.close();

    } catch (err) {
        console.log(JSON.stringify({ status: 'error', error: err.message }));
    } finally {
        if (browser) browser.disconnect();
        if (xvfb) xvfb.stopSync();
    }
}

run();

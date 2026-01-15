import asyncio
import json
import sys
import random
from playwright.async_api import async_playwright

async def run():
    if len(sys.argv) < 3:
        print(json.dumps({"status": "error", "error": "Missing arguments"}))
        return

    sku = sys.argv[1]
    subdomain = sys.argv[2]
    original_url = sys.argv[3] if len(sys.argv) > 3 else ""
    use_proxy = sys.argv[4].lower() == "true" if len(sys.argv) > 4 else False

    region_prefix = "" if subdomain in ["moscow", ""] else f"{subdomain}."
    reg_id = "506" if subdomain == "pskov" else "34"

    if original_url and "/product/" in original_url:
        parts = original_url.split("/product/")
        slug_and_rest = parts[1]
        url = f"https://{region_prefix}lemanapro.ru/product/{slug_and_rest}"
        if "fromRegion" not in url:
            url += ("&" if "?" in url else "?") + f"fromRegion={reg_id}"
    else:
        url = f"https://{region_prefix}lemanapro.ru/search/?q={sku}&fromRegion={reg_id}"

    proxy_config = None
    if use_proxy:
        username = 'xhv18ztqs15-zone-static-region-ru'
        password = 'pompbza2v7efm'
        host = 'p2.mangoproxy.com'
        port = 2333
        
        session_id = random.randint(100000, 999999)
        proxy_user = f"{username}-session-{session_id}"
        
        proxy_config = {
            "server": f"http://{host}:{port}",
            "username": proxy_user,
            "password": password
        }

    print(f"🦊 REVOLUTIONARY: Playwright + Firefox")
    print(f"📍 URL: {url}")
    print(f"🔐 Proxy: {use_proxy}")

    async with async_playwright() as p:
        browser = await p.firefox.launch(
            headless=True,
            proxy=proxy_config,
            firefox_user_prefs={
                "dom.webdriver.enabled": False,
                "useAutomationExtension": False
            }
        )

        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0"
        )

        page = await context.new_page()

        print("🌐 Navigating...")
        await page.goto(url, wait_until="domcontentloaded", timeout=90000)

        print("⏳ Waiting for Qrator challenge (90s)...")
        await asyncio.sleep(90)

        title = await page.title()
        print(f"📄 Title: {title}")

        # Save HTML and screenshot
        html = await page.content()
        with open(f'playwright_firefox_{sku}.html', 'w', encoding='utf-8') as f:
            f.write(html)
        await page.screenshot(path=f'playwright_firefox_{sku}.png', full_page=True)
        print(f"💾 Saved: playwright_firefox_{sku}.html and .png")

        if "server error" in title.lower() or "err_" in title.lower():
            print("❌ Still blocked")
            print(json.dumps({"status": "error", "error": "Blocked", "title": title}))
        else:
            print("✅ Page loaded! Extracting price...")

            # Extract price
            price = None
            selectors = [
                'span[data-testid="price-integer"]',
                '.price-integer',
                '[data-qa="price-integer"]',
                'span[class*="price-integer"]'
            ]

            for sel in selectors:
                try:
                    elem = await page.query_selector(sel)
                    if elem:
                        price_int = await elem.inner_text()
                        price_int = price_int.strip().replace(" ", "").replace("\xa0", "")
                        
                        try:
                            frac_elem = await page.query_selector('[data-testid="price-fraction"], .price-fraction')
                            if frac_elem:
                                price_frac = await frac_elem.inner_text()
                                price = f"{price_int}.{price_frac.strip()}"
                            else:
                                price = price_int
                        except:
                            price = price_int
                        break
                except:
                    continue

            if price:
                print(f"💰 ✅ SUCCESS! Price: {price}")
                print(json.dumps({"status": "success", "price": price, "title": title, "method": "playwright_firefox"}))
            else:
                print("⚠️  Price not found")
                print(json.dumps({"status": "error", "error": "Price not found", "title": title}))

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())

import sys
import json
import time
import random
import asyncio
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

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            proxy=proxy_config,
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled'
            ]
        )
        
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            locale='ru-RU',
            timezone_id='Europe/Moscow',
            extra_http_headers={
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-User': '?1',
                'Sec-Fetch-Dest': 'document'
            }
        )
        
        page = await context.new_page()
        
        try:
            # Navigate with retry logic
            retries = 3
            for attempt in range(retries):
                await page.goto(url, wait_until='domcontentloaded', timeout=60000)
                await asyncio.sleep(5)
                
                title = await page.title()
                content = await page.content()
                
                if "server error" in title.lower() or "403" in title or "__qrator" in content.lower() or "vpn" in content.lower():
                    if attempt < retries - 1:
                        await asyncio.sleep(20)
                        await page.reload()
                    else:
                        break
                else:
                    break
            
            # Wait a bit more for dynamic content
            await asyncio.sleep(10)
            
            # Try to extract price
            selectors = [
                'span[data-testid="price-integer"]',
                '.price-integer',
                '[data-qa="price-integer"]',
                'span[class*="price-integer"]'
            ]
            
            price = None
            for sel in selectors:
                try:
                    price_elem = await page.query_selector(sel)
                    if price_elem:
                        price_int = await price_elem.inner_text()
                        price_int = price_int.strip().replace(" ", "").replace("\xa0", "")
                        
                        # Try to get fraction
                        frac_elem = await page.query_selector('[data-testid="price-fraction"], .price-fraction')
                        if frac_elem:
                            price_frac = await frac_elem.inner_text()
                            price = f"{price_int}.{price_frac.strip()}"
                        else:
                            price = price_int
                        break
                except:
                    continue
            
            if price:
                print(json.dumps({"status": "success", "price": price}))
            else:
                await page.screenshot(path='playwright_fail.png')
                title = await page.title()
                content = await page.content()
                print(json.dumps({
                    "status": "error",
                    "error": "Price not found",
                    "title": title,
                    "screenshot": "playwright_fail.png",
                    "source_snippet": content[:500]
                }))
                
        except Exception as e:
            print(json.dumps({"status": "error", "error": str(e)}))
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(run())

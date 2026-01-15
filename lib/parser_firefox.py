import sys
import json
import time
import random
from selenium import webdriver
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.proxy import Proxy, ProxyType

def run():
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

    options = Options()
    options.add_argument("--headless")
    options.add_argument("--width=1920")
    options.add_argument("--height=1080")
    
    # Set preferences to look more like a real browser
    options.set_preference("general.useragent.override", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0")
    options.set_preference("dom.webdriver.enabled", False)
    options.set_preference("useAutomationExtension", False)

    if use_proxy:
        username = 'xhv18ztqs15-zone-static-region-ru'
        password = 'pompbza2v7efm'
        host = 'p2.mangoproxy.com'
        port = 2333
        
        session_id = random.randint(100000, 999999)
        proxy_user = f"{username}-session-{session_id}"
        
        # Firefox proxy configuration
        options.set_preference("network.proxy.type", 1)
        options.set_preference("network.proxy.http", host)
        options.set_preference("network.proxy.http_port", port)
        options.set_preference("network.proxy.ssl", host)
        options.set_preference("network.proxy.ssl_port", port)
        options.set_preference("network.proxy.socks_username", proxy_user)
        options.set_preference("network.proxy.socks_password", password)

    driver = None
    try:
        print(f"🦊 Starting Firefox...")
        print(f"📍 URL: {url}")
        print(f"🔐 Proxy: {use_proxy}")
        
        service = Service('/tmp/geckodriver')
        driver = webdriver.Firefox(service=service, options=options)

        print(f"🌐 Navigating...")
        driver.get(url)
        
        print("⏳ Waiting for Qrator challenge (90s)...")
        time.sleep(90)
        
        title = driver.title
        print(f"📄 Title: {title}")
        
        # Save HTML
        with open(f'firefox_{sku}.html', 'w', encoding='utf-8') as f:
            f.write(driver.page_source)
        print(f"💾 HTML saved: firefox_{sku}.html")
        
        if "server error" in title.lower() or "err_" in title.lower():
            print("❌ Still blocked")
            driver.save_screenshot(f'firefox_{sku}_blocked.png')
            print(json.dumps({"status": "error", "error": "Blocked", "title": title}))
        else:
            print("✅ Page loaded! Extracting price...")
            
            # Extract price
            selectors = [
                'span[data-testid="price-integer"]',
                '.price-integer',
                '[data-qa="price-integer"]',
                'span[class*="price-integer"]'
            ]
            
            price = None
            for sel in selectors:
                try:
                    elem = driver.find_element(By.CSS_SELECTOR, sel)
                    if elem:
                        price_int = elem.text.strip().replace(" ", "").replace("\xa0", "")
                        try:
                            frac_elem = driver.find_element(By.CSS_SELECTOR, '[data-testid="price-fraction"], .price-fraction')
                            price_frac = frac_elem.text.strip()
                            price = f"{price_int}.{price_frac}"
                        except:
                            price = price_int
                        break
                except:
                    continue
                    
            if price:
                print(f"💰 ✅ SUCCESS! Price: {price}")
                driver.save_screenshot(f'firefox_{sku}_success.png')
                print(json.dumps({"status": "success", "price": price, "title": title, "method": "firefox"}))
            else:
                print("⚠️  Price not found")
                driver.save_screenshot(f'firefox_{sku}_no_price.png')
                print(json.dumps({"status": "error", "error": "Price not found", "title": title}))

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        print(json.dumps({"status": "error", "error": str(e)}))
        import traceback
        traceback.print_exc()
    finally:
        if driver:
            driver.quit()

if __name__ == "__main__":
    run()

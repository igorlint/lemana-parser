import sys
import json
import time
import random
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.proxy import Proxy, ProxyType
from webdriver_manager.chrome import ChromeDriverManager

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
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-setuid-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)

    if use_proxy:
        username = 'xhv18ztqs15-zone-static-region-ru'
        password = 'pompbza2v7efm'
        host = 'p2.mangoproxy.com'
        port = 2333
        
        session_id = random.randint(100000, 999999)
        proxy_user = f"{username}-session-{session_id}"
        
        # Method 1: Using Selenium Proxy class
        proxy = Proxy()
        proxy.proxy_type = ProxyType.MANUAL
        proxy.http_proxy = f"{proxy_user}:{password}@{host}:{port}"
        proxy.ssl_proxy = f"{proxy_user}:{password}@{host}:{port}"
        
        capabilities = webdriver.DesiredCapabilities.CHROME.copy()
        proxy.add_to_capabilities(capabilities)
        options.set_capability('proxy', capabilities['proxy'])

    driver = None
    try:
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)

        # Mask automation
        driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
            'source': '''
                Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
                Object.defineProperty(navigator, 'languages', {get: () => ['ru-RU', 'ru']});
            '''
        })

        driver.get(url)
        
        # Wait logic for Qrator
        retries = 3
        for attempt in range(retries):
            time.sleep(5)
            title = driver.title
            source = driver.page_source.lower()
            
            if "server error" in title.lower() or "403" in title or "__qrator" in source or "vpn" in source:
                if attempt < retries - 1:
                    time.sleep(20)
                    driver.refresh()
                else:
                    break
            else:
                break
        
        time.sleep(10)
        
        selectors = [
            'span[data-testid="price-integer"]',
            '.price-integer',
            '[data-qa="price-integer"]',
            'span[class*="price-integer"]'
        ]
        
        price = None
        for sel in selectors:
            try:
                p_int = driver.execute_script(f'return document.querySelector("{sel}") ? document.querySelector("{sel}").innerText : null')
                if p_int:
                    p_int = p_int.strip().replace(" ", "").replace("\xa0", "")
                    p_frac = driver.execute_script('return document.querySelector("[data-testid=\\"price-fraction\\"], .price-fraction") ? document.querySelector("[data-testid=\\"price-fraction\\"], .price-fraction").innerText : ""')
                    if p_frac:
                        price = f"{p_int}.{p_frac.strip()}"
                    else:
                        price = p_int
                    break
            except:
                continue
                
        if price:
            print(json.dumps({"status": "success", "price": price}))
        else:
            driver.save_screenshot('selenium_proxy_fail.png')
            print(json.dumps({
                "status": "error", 
                "error": "Price not found", 
                "title": driver.title,
                "screenshot": "selenium_proxy_fail.png",
                "source_snippet": driver.page_source[:500]
            }))

    except Exception as e:
        print(json.dumps({"status": "error", "error": str(e)}))
    finally:
        if driver:
            driver.quit()

if __name__ == "__main__":
    run()

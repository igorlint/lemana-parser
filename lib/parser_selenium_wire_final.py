import sys
import json
import time
import random
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from seleniumwire import webdriver as wire_webdriver
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

    seleniumwire_options = {}
    if use_proxy:
        username = 'xhv18ztqs15-zone-static-region-ru'
        password = 'pompbza2v7efm'
        host = 'p2.mangoproxy.com'
        port = 2333
        
        session_id = random.randint(100000, 999999)
        proxy_user = f"{username}-session-{session_id}"
        
        proxy_url = f'http://{proxy_user}:{password}@{host}:{port}'
        seleniumwire_options = {
            'proxy': {
                'http': proxy_url,
                'https': proxy_url,
                'no_proxy': 'localhost,127.0.0.1'
            }
        }

    driver = None
    try:
        # Use Selenium Wire for proxy support
        driver = wire_webdriver.Chrome(
            service=Service(ChromeDriverManager().install()),
            options=options,
            seleniumwire_options=seleniumwire_options
        )

        # Mask automation markers
        driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
            'source': '''
                Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
                Object.defineProperty(navigator, 'languages', {get: () => ['ru-RU', 'ru']});
                window.chrome = { runtime: {} };
            '''
        })

        print(f"Navigating to {url}...")
        driver.get(url)
        
        # Wait for Qrator challenge to resolve
        print("Waiting for Qrator challenge...")
        max_wait = 60  # Maximum 60 seconds
        start_time = time.time()
        
        while (time.time() - start_time) < max_wait:
            time.sleep(5)
            title = driver.title
            
            print(f"Current title: {title}")
            
            # Check if challenge is resolved
            if "Server error" not in title and title != "":
                print("Challenge appears resolved!")
                break
                
            # Check page source for Qrator markers
            if "__qrator" not in driver.page_source.lower():
                print("No Qrator markers found, proceeding...")
                break
        
        # Additional wait for page to fully load
        time.sleep(10)
        
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
                price_elem = driver.find_element(By.CSS_SELECTOR, sel)
                if price_elem:
                    price_int = price_elem.text.strip().replace(" ", "").replace("\xa0", "")
                    
                    # Try to get fraction
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
            print(json.dumps({"status": "success", "price": price}))
        else:
            driver.save_screenshot('selenium_wire_fail.png')
            print(json.dumps({
                "status": "error", 
                "error": "Price not found", 
                "title": driver.title,
                "screenshot": "selenium_wire_fail.png",
                "source_snippet": driver.page_source[:500]
            }))

    except Exception as e:
        print(json.dumps({"status": "error", "error": str(e)}))
        import traceback
        traceback.print_exc()
    finally:
        if driver:
            driver.quit()

if __name__ == "__main__":
    run()

import sys
import json
import time
import random
import os
import zipfile
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By

def create_proxy_auth_extension(proxy_host, proxy_port, proxy_username, proxy_password, scheme='http', plugin_path='proxy_auth_plugin'):
    if not os.path.exists(plugin_path):
        os.makedirs(plugin_path)
        
    manifest_json = """
    {
        "version": "1.0.0",
        "manifest_version": 2,
        "name": "Chrome Proxy",
        "permissions": [
            "proxy",
            "tabs",
            "unlimitedStorage",
            "storage",
            "<all_urls>",
            "webRequest",
            "webRequestBlocking"
        ],
        "background": {
            "scripts": ["background.js"]
        },
        "minimum_chrome_version":"22.0.0"
    }
    """

    background_js = """
    var config = {
            mode: "fixed_servers",
            rules: {
              singleProxy: {
                scheme: "%s",
                host: "%s",
                port: parseInt(%s)
              },
              bypassList: ["localhost"]
            }
          };

    chrome.proxy.settings.set({value: config, scope: "regular"}, function() {});

    function callbackFn(details) {
        return {
            authCredentials: {
                username: "%s",
                password: "%s"
            }
        };
    }

    chrome.webRequest.onAuthRequired.addListener(
                callbackFn,
                {urls: ["<all_urls>"]},
                ['blocking']
    );
    """ % (scheme, proxy_host, proxy_port, proxy_username, proxy_password)

    with open(os.path.join(plugin_path, "manifest.json"), "w") as f:
        f.write(manifest_json)
    with open(os.path.join(plugin_path, "background.js"), "w") as f:
        f.write(background_js)

    return os.path.abspath(plugin_path)

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

    options = uc.ChromeOptions()
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-setuid-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1920,1080")

    if use_proxy:
        username = 'xhv18ztqs15-zone-static-region-ru'
        password = 'pompbza2v7efm'
        host = 'p2.mangoproxy.com'
        port = 2333
        
        session_id = random.randint(100000, 999999)
        proxy_user = f"{username}-session-{session_id}"
        
        plugin_file = create_proxy_auth_extension(host, port, proxy_user, password)
        options.add_argument(f'--load-extension={plugin_file}')

    driver = None
    try:
        driver = uc.Chrome(
            options=options,
            version_main=131,
            browser_executable_path='/usr/bin/google-chrome-stable',
            headless=False 
        )

        driver.get(url)
        
        # Wait logic for Qrator
        retries = 3
        while retries > 0:
            title = driver.title
            source = driver.page_source.lower()
            if "server error" in title.lower() or "403" in title or not title or "__qrator" in source or "vpn" in source:
                time.sleep(20) 
                driver.refresh()
                retries -= 1
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
            driver.save_screenshot('python_fail_stealth.png')
            print(json.dumps({
                "status": "error", 
                "error": "Price not found", 
                "title": driver.title,
                "screenshot": "python_fail_stealth.png",
                "source_snippet": driver.page_source[:500]
            }))

    except Exception as e:
        print(json.dumps({"status": "error", "error": str(e)}))
    finally:
        if driver:
            driver.quit()

if __name__ == "__main__":
    run()

import undetected_chromedriver as uc
import time
import os
from selenium.webdriver.common.by import By
import zipfile

def create_proxy_auth_extension(proxy_host, proxy_port, proxy_username, proxy_password, scheme='http', plugin_path='proxy_auth_plugin'):
    if not os.path.exists(plugin_path):
        os.makedirs(plugin_path)
    manifest_json = '{"version": "1.0.0", "manifest_version": 2, "name": "Chrome Proxy", "permissions": ["proxy", "tabs", "unlimitedStorage", "storage", "<all_urls>", "webRequest", "webRequestBlocking"], "background": {"scripts": ["background.js"]}}'
    background_js = 'var config = {mode: "fixed_servers", rules: {singleProxy: {scheme: "%s", host: "%s", port: parseInt(%s)}, bypassList: ["localhost"]}}; chrome.proxy.settings.set({value: config, scope: "regular"}, function() {}); function callbackFn(details) { return {authCredentials: {username: "%s", password: "%s"}}; } chrome.webRequest.onAuthRequired.addListener(callbackFn, {urls: ["<all_urls>"]}, ["blocking"]);' % (scheme, proxy_host, proxy_port, proxy_username, proxy_password)
    with open(os.path.join(plugin_path, "manifest.json"), "w") as f: f.write(manifest_json)
    with open(os.path.join(plugin_path, "background.js"), "w") as f: f.write(background_js)
    return os.path.abspath(plugin_path)

options = uc.ChromeOptions()
options.add_argument("--no-sandbox")
options.add_argument("--disable-setuid-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--remote-debugging-port=0")

plugin_file = create_proxy_auth_extension('p2.mangoproxy.com', 2333, 'xhv18ztqs15-zone-static-region-ru', 'pompbza2v7efm')
options.add_argument(f'--load-extension={plugin_file}')

try:
    print("Launching test UC with extension...")
    driver = uc.Chrome(options=options, browser_executable_path='/usr/bin/google-chrome-stable', version_main=131, headless=False)
    print("Navigation...")
    driver.get("https://ipapi.co/json/")
    print("Body:", driver.find_element(By.TAG_NAME, 'body').text)
    driver.quit()
    print("Success")
except Exception as e:
    print("Error:", str(e))

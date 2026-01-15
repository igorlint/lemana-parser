import undetected_chromedriver as uc
import time

options = uc.ChromeOptions()
options.add_argument("--no-sandbox")
options.add_argument("--disable-setuid-sandbox")
options.add_argument("--disable-dev-shm-usage")

try:
    print("Launching UC headless...")
    driver = uc.Chrome(
        options=options,
        version_main=131,
        browser_executable_path='/usr/bin/google-chrome-stable',
        headless=True,
        use_subprocess=False
    )
    print("Navigating...")
    driver.get("https://pskov.lemanapro.ru/product/elektricheskaya-varochnaya-panel-hansa-bhc36106-30-sm-2-konforki-cvet-chernyy-82471809/?fromRegion=506")
    time.sleep(5)
    print("Title:", driver.title)
    print("Body snippet:", driver.page_source[:500])
    driver.quit()
    print("Success")
except Exception as e:
    print("Error:", str(e))
    import traceback
    traceback.print_exc()

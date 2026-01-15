#!/bin/bash
# REVOLUTIONARY SOLUTION: Real Chrome in Xvfb with manual control
# This mimics a REAL user - no automation detection possible!

SKU="$1"
SUBDOMAIN="$2"
URL="$3"
USE_PROXY="$4"

PROXY_USER="xhv18ztqs15-zone-static-region-ru-session-$RANDOM"
PROXY_PASS="pompbza2v7efm"
PROXY_HOST="p2.mangoproxy.com"
PROXY_PORT="2333"

echo "🚀 REVOLUTIONARY APPROACH: Real Chrome + Xvfb"
echo "📍 URL: $URL"

# Create user data dir
USER_DATA_DIR="/tmp/chrome-real-$$"
mkdir -p "$USER_DATA_DIR"

# Prepare Chrome args
CHROME_ARGS="--user-data-dir=$USER_DATA_DIR"
CHROME_ARGS="$CHROME_ARGS --no-first-run"
CHROME_ARGS="$CHROME_ARGS --no-default-browser-check"
CHROME_ARGS="$CHROME_ARGS --window-size=1920,1080"
CHROME_ARGS="$CHROME_ARGS --password-store=basic"
CHROME_ARGS="$CHROME_ARGS --use-mock-keychain"
CHROME_ARGS="$CHROME_ARGS --no-sandbox"
CHROME_ARGS="$CHROME_ARGS --disable-setuid-sandbox"

if [ "$USE_PROXY" = "true" ]; then
    # Create proxy extension
    EXT_DIR="/tmp/proxy-ext-$$"
    mkdir -p "$EXT_DIR"
    
    cat > "$EXT_DIR/manifest.json" <<EOF
{
  "version": "1.0.0",
  "manifest_version": 2,
  "name": "Proxy Auth",
  "permissions": ["proxy", "tabs", "unlimitedStorage", "storage", "<all_urls>", "webRequest", "webRequestBlocking"],
  "background": {"scripts": ["background.js"]},
  "minimum_chrome_version": "22.0.0"
}
EOF

    cat > "$EXT_DIR/background.js" <<EOF
var config = {
    mode: "fixed_servers",
    rules: {
        singleProxy: {
            scheme: "http",
            host: "$PROXY_HOST",
            port: $PROXY_PORT
        },
        bypassList: ["localhost"]
    }
};

chrome.proxy.settings.set({value: config, scope: "regular"}, function() {});

function callbackFn(details) {
    return {
        authCredentials: {
            username: "$PROXY_USER",
            password: "$PROXY_PASS"
        }
    };
}

chrome.webRequest.onAuthRequired.addListener(
    callbackFn,
    {urls: ["<all_urls>"]},
    ['blocking']
);
EOF

    CHROME_ARGS="$CHROME_ARGS --load-extension=$EXT_DIR"
    echo "🔐 Proxy extension created"
fi

# Launch Chrome in Xvfb
echo "🌐 Launching Chrome..."
DISPLAY=:99 /usr/bin/google-chrome-stable $CHROME_ARGS "$URL" &
CHROME_PID=$!

echo "⏳ Waiting 120 seconds for page to load and Qrator to resolve..."
sleep 120

# Take screenshot
echo "📸 Taking screenshot..."
DISPLAY=:99 import -window root "/mnt/data/lemana-parser/revolutionary_${SKU}.png"

# Get page title using xdotool
echo "📄 Getting page title..."
DISPLAY=:99 xdotool search --class chrome getwindowname > "/tmp/title_${SKU}.txt" 2>/dev/null || echo "Unknown" > "/tmp/title_${SKU}.txt"

TITLE=$(head -1 "/tmp/title_${SKU}.txt")
echo "Title: $TITLE"

# Kill Chrome
kill $CHROME_PID 2>/dev/null
sleep 2
pkill -f "chrome.*$USER_DATA_DIR" 2>/dev/null

# Cleanup
rm -rf "$USER_DATA_DIR"
[ -n "$EXT_DIR" ] && rm -rf "$EXT_DIR"

echo "✅ Done! Check revolutionary_${SKU}.png"
echo "Title was: $TITLE"

if echo "$TITLE" | grep -qi "server error"; then
    echo '{"status":"error","error":"Still blocked","title":"'"$TITLE"'"}'
else
    echo '{"status":"success","message":"Page loaded, check screenshot for price","title":"'"$TITLE"'","screenshot":"revolutionary_'"$SKU"'.png"}'
fi

#!/bin/bash
# Start Chrome with remote debugging for CDP connection

CHROME_USER_DATA="/tmp/chrome-cdp-profile-$$"

# Create fresh user data directory
rm -rf "$CHROME_USER_DATA"
mkdir -p "$CHROME_USER_DATA"

# Kill any existing Chrome instances on port 9222
pkill -f "remote-debugging-port=9222" 2>/dev/null || true
sleep 1

# Start Chrome with remote debugging
DISPLAY=:99 /usr/bin/google-chrome-stable \
  --remote-debugging-port=9222 \
  --user-data-dir="$CHROME_USER_DATA" \
  --no-first-run \
  --no-default-browser-check \
  --disable-blink-features=AutomationControlled \
  --disable-features=IsolateOrigins,site-per-process \
  --password-store=basic \
  --use-mock-keychain \
  --no-sandbox \
  --disable-setuid-sandbox \
  --disable-dev-shm-usage \
  --window-size=1920,1080 \
  about:blank > /dev/null 2>&1 &

CHROME_PID=$!
echo "Chrome started with remote debugging on port 9222"
echo "PID: $CHROME_PID"
sleep 3

# Check if Chrome is actually running
if ps -p $CHROME_PID > /dev/null; then
    echo "Chrome is running successfully"
else
    echo "ERROR: Chrome failed to start"
    exit 1
fi

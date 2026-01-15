#!/usr/bin/env python3
"""
Local proxy server that forwards requests to Mangoproxy with authentication.
Usage: python3 local_proxy.py
Then connect Chrome to http://localhost:8899
"""
import sys
import random
from proxy import Proxy

def main():
    # Mangoproxy credentials
    username = 'xhv18ztqs15-zone-static-region-ru'
    password = 'pompbza2v7efm'
    host = 'p2.mangoproxy.com'
    port = 2333
    
    # Add random session for sticky IP
    session_id = random.randint(100000, 999999)
    proxy_user = f"{username}-session-{session_id}"
    
    # Start local proxy on port 8899
    print(f"Starting local proxy on localhost:8899")
    print(f"Forwarding to {host}:{port} with user {proxy_user}")
    print("Press Ctrl+C to stop")
    
    # Configure upstream proxy
    sys.argv = [
        'proxy',
        '--hostname', '127.0.0.1',
        '--port', '8899',
        '--proxy', f'http://{proxy_user}:{password}@{host}:{port}'
    ]
    
    Proxy.main()

if __name__ == '__main__':
    main()

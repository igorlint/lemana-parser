#!/usr/bin/env python3
"""
Simple HTTP proxy that forwards to Mangoproxy with auth.
Based on http.server with upstream proxy support.
"""
import http.server
import socketserver
import urllib.request
import random
import sys

PORT = 8899
UPSTREAM_HOST = 'p2.mangoproxy.com'
UPSTREAM_PORT = 2333
USERNAME = 'xhv18ztqs15-zone-static-region-ru'
PASSWORD = 'pompbza2v7efm'

# Add session for sticky IP
session_id = random.randint(100000, 999999)
PROXY_USER = f"{USERNAME}-session-{session_id}"

class ProxyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        self.proxy_request()
    
    def do_POST(self):
        self.proxy_request()
    
    def do_CONNECT(self):
        # For HTTPS, we need to tunnel
        self.send_response(200, 'Connection Established')
        self.end_headers()
    
    def proxy_request(self):
        try:
            # Build upstream proxy URL
            proxy_url = f'http://{PROXY_USER}:{PASSWORD}@{UPSTREAM_HOST}:{UPSTREAM_PORT}'
            proxy_handler = urllib.request.ProxyHandler({'http': proxy_url, 'https': proxy_url})
            opener = urllib.request.build_opener(proxy_handler)
            
            # Forward request
            response = opener.open(self.path, timeout=30)
            
            # Send response back
            self.send_response(response.getcode())
            for header, value in response.headers.items():
                self.send_header(header, value)
            self.end_headers()
            self.wfile.write(response.read())
            
        except Exception as e:
            self.send_error(500, f"Proxy Error: {str(e)}")

if __name__ == '__main__':
    print(f"Starting local HTTP proxy on localhost:{PORT}")
    print(f"Forwarding to {UPSTREAM_HOST}:{UPSTREAM_PORT}")
    print(f"Using credentials: {PROXY_USER}")
    print("Press Ctrl+C to stop\n")
    
    with socketserver.TCPServer(("127.0.0.1", PORT), ProxyHTTPRequestHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down proxy server...")
            sys.exit(0)

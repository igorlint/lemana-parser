#!/bin/bash
set -e

echo "Installing System Dependencies for Lemana Parser (Ubuntu/Debian)..."

# Update apt
sudo apt-get update

# Install utilities
sudo apt-get install -y wget gnupg xvfb

# Install Google Chrome Stable
echo "Installing Google Chrome..."
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
sudo apt-get update
sudo apt-get install -y google-chrome-stable

# Install fonts (optional but good for rendering)
sudo apt-get install -y fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf --no-install-recommends

echo "System dependencies installed successfully!"
echo "You can now run 'npm install' and start the parser."

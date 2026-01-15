const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = '/usr/bin/google-chrome-stable';
const userDataDir = path.join(process.cwd(), 'debug_chrome_profile');
const port = 9333;

const spawnArgs = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-fre',
    '--headless=new', // Try headless first to see if it even starts
    '--no-sandbox'    // Necessary in many restricted environments
];

console.log('Launching Chrome:', chromePath);
const chromeProcess = spawn(chromePath, spawnArgs, {
    stdio: 'inherit'
});

chromeProcess.on('error', (err) => {
    console.error('Failed to start chrome:', err);
});

setTimeout(() => {
    console.log('Killing chrome after 10s...');
    chromeProcess.kill();
    process.exit();
}, 10000);

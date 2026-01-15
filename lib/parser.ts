import { exec } from 'child_process';
import path from 'path';

export interface ParseResult {
    sku: string;
    region: string;
    price: string;
    status: 'success' | 'error';
    error?: string;
    screenshot?: string;
}

export async function fetchPrice(sku: string, subdomain: string, originalUrl?: string, useProxy: boolean = false, referencePrice: number = 0): Promise<ParseResult> {
    const scriptPath = path.join(process.cwd(), 'lib', 'parser_pyautogui.py');
    const venvPath = path.join(process.cwd(), 'venv', 'bin', 'python3');

    return new Promise((resolve) => {
        const command = `xvfb-run -a -s "-screen 0 1920x1080x24" "${venvPath}" "${scriptPath}" "${sku}" "${subdomain}" "${originalUrl || ''}" "${useProxy}" "60" "${referencePrice}"`;
        exec(command, (error, stdout, stderr) => {
            // DEBUG LOGGING
            const fs = require('fs');
            const logEntry = `
[${new Date().toISOString()}] SKU: ${sku}
Command: ${command}
Error: ${error ? JSON.stringify(error) : 'None'}
Length Stdout: ${stdout.length}
Stderr: ${stderr}
Stdout Head: ${stdout.substring(0, 1000)}
Stdout Tail: ${stdout.substring(Math.max(0, stdout.length - 1000))}
--------------------------------------------------
`;
            fs.appendFileSync('debug_parser.log', logEntry);

            if (error) {
                console.error(`Exec error for ${sku}:`, error);
                resolve({
                    sku,
                    region: subdomain || 'moscow',
                    price: '0',
                    status: 'error',
                    error: error.message
                });
                return;
            }

            try {
                // Find the JSON output from stdout
                const lines = stdout.split('\n');
                let result = null;

                for (const line of lines) {
                    try {
                        const json = JSON.parse(line);
                        if (json.status) {
                            result = json;
                            break;
                        }
                    } catch (e) { }
                }

                if (result && result.status === 'success') {
                    resolve({
                        sku,
                        region: subdomain || 'moscow',
                        price: String(result.price),
                        status: 'success',
                        screenshot: result.screenshot
                    });
                } else {
                    resolve({
                        sku,
                        region: subdomain || 'moscow',
                        price: '0',
                        status: 'error',
                        error: result?.error || 'Failed to parse output',
                        screenshot: result?.screenshot
                    });
                }
            } catch (e: any) {
                resolve({
                    sku,
                    region: subdomain || 'moscow',
                    price: '0',
                    status: 'error',
                    error: 'Error parsing parser output: ' + e.message
                });
            }
        });
    });
}

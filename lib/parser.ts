import { exec } from 'child_process';
import path from 'path';

export interface ParseResult {
    sku: string;
    region: string;
    price: string;
    status: 'success' | 'error';
    error?: string;
}

export async function fetchPrice(sku: string, subdomain: string): Promise<ParseResult> {
    const scriptPath = path.join(process.cwd(), 'lib', 'standalone-parser.js');

    return new Promise((resolve) => {
        exec(`node "${scriptPath}" ${sku} ${subdomain}`, (error, stdout, stderr) => {
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
                        status: 'success'
                    });
                } else {
                    resolve({
                        sku,
                        region: subdomain || 'moscow',
                        price: '0',
                        status: 'error',
                        error: result?.error || 'Failed to parse output'
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

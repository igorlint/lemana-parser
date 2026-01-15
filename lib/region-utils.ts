import fs from 'fs';
import path from 'path';

export interface Region {
    name: string;
    subdomain: string;
}

export function getRegions(): Region[] {
    try {
        const regionsFilePath = path.join(process.cwd(), 'data', 'regions.md');
        if (!fs.existsSync(regionsFilePath)) {
            return [];
        }

        const content = fs.readFileSync(regionsFilePath, 'utf-8');
        const lines = content.split('\n');
        const regions: Region[] = [];

        // Content-aware loop
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith('|')) continue;
            if (trimmedLine.includes('---') || trimmedLine.toLowerCase().includes('город')) continue;

            const parts = trimmedLine.split('|').map(p => p.trim()).filter(Boolean);
            if (parts.length >= 2) {
                const name = parts[0];
                const link = parts[1];

                // Extract subdomain from link
                const urlMatch = link.match(/https:\/\/([^.]+)\.lemanapro.ru/);
                let subdomain = '';
                if (urlMatch) {
                    subdomain = urlMatch[1];
                } else if (link.includes('https://lemanapro.ru')) {
                    subdomain = ''; // Moscow
                }

                regions.push({ name, subdomain });
            }
        }

        return regions;
    } catch (error) {
        console.error('Error reading regions file:', error);
        return [];
    }
}

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

        // Skip header and separator
        for (let i = 5; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || !line.startsWith('|')) continue;

            const parts = line.split('|').map(p => p.trim()).filter(Boolean);
            if (parts.length >= 2) {
                const name = parts[0];
                const link = parts[1];

                // Extract subdomain from link like [https://spb.lemanapro.ru/?fromRegion=34](https://spb.lemanapro.ru/?fromRegion=34)
                const urlMatch = link.match(/https:\/\/([^.]+)\.lemanapro\.ru/);
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

import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const EXCEL_FILE_PATH = path.join(process.cwd(), 'data', 'matrix.xlsx');

export interface Product {
    sku: string;
    name: string;
}

export function getProductsFromExcel(): Product[] {
    try {
        if (!fs.existsSync(EXCEL_FILE_PATH)) {
            console.error('Excel file not found at:', EXCEL_FILE_PATH);
            return [];
        }

        const fileBuffer = fs.readFileSync(EXCEL_FILE_PATH);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet) as any[];

        console.log('Excel data count:', data.length);
        if (data.length > 0) {
            console.log('First row keys:', Object.keys(data[0]));
        }

        return data.map(row => {
            const sku = String(row['Код партнера'] || row['Код партнера '] || '').trim();
            const name = String(row['Номенклатура'] || row['Номенклатура '] || '').trim();
            return { sku, name };
        }).filter(p => p.sku && p.sku !== 'undefined');
    } catch (error) {
        console.error('Error reading Excel file:', error);
        return [];
    }
}

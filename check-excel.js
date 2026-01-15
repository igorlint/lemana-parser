const XLSX = require('xlsx');
const path = require('path');

const EXCEL_FILE_PATH = path.join(process.cwd(), 'data', 'matrix.xlsx');
const workbook = XLSX.readFile(EXCEL_FILE_PATH);
const sheetName = workbook.SheetNames[0];
const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

console.log('Total rows:', data.length);
console.log('Sample data (first 3 rows):');
console.log(data.slice(0, 3));

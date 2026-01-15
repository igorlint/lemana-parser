import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

export async function generateViolationsExcel(violations: any[]) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Нарушения');

    // Group by SKU
    const skus = Array.from(new Set(violations.map(v => v.sku)));
    const regions = Array.from(new Set(violations.map(v => v.region)));

    const columns: any[] = [
        { header: 'Дата', key: 'date', width: 22 },
        { header: 'Артикул', key: 'sku', width: 15 },
        { header: 'РИЦ', key: 'refPrice', width: 12 },
    ];

    // Add columns for each region
    regions.forEach(reg => {
        columns.push({ header: reg, key: reg, width: 25 });
    });

    worksheet.columns = columns;

    worksheet.getRow(1).height = 30;
    worksheet.getRow(1).font = { bold: true, size: 12 };

    for (const [idx, sku] of skus.entries()) {
        const rowNumber = idx + 2;
        const skuViolations = violations.filter(v => v.sku === sku);
        const refPrice = skuViolations[0].referencePrice;
        const date = new Date(skuViolations[0].createdAt).toLocaleString('ru-RU');

        const rowData: any = {
            date,
            sku,
            refPrice: refPrice ? `${refPrice} ₽` : '-'
        };

        // Fill region data
        regions.forEach(reg => {
            const v = skuViolations.find(sv => sv.region === reg);
            if (v) {
                rowData[reg] = `${v.price} ₽`;
            }
        });

        worksheet.addRow(rowData);
        worksheet.getRow(rowNumber).height = 80;

        // Add images
        for (const [regIdx, reg] of regions.entries()) {
            const v = skuViolations.find(sv => sv.region === reg);
            if (v && v.screenshot) {
                try {
                    const screenshotPath = path.join(process.cwd(), 'public', v.screenshot);
                    if (fs.existsSync(screenshotPath)) {
                        const imageId = workbook.addImage({
                            filename: screenshotPath,
                            extension: 'png',
                        });

                        worksheet.addImage(imageId, {
                            tl: { col: 3 + regIdx, row: rowNumber - 1 },
                            ext: { width: 160, height: 90 }
                        });
                    }
                } catch (e) {
                    console.error('Failed to add image to excel on server', e);
                }
            }
        }
    }

    const tempPath = path.join(process.cwd(), 'tmp_violations.xlsx');
    await workbook.xlsx.writeFile(tempPath);
    return tempPath;
}

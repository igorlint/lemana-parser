import { prisma } from './prisma';
import fs from 'fs';
import path from 'path';

export async function cleanupOldData(days: number) {
    console.log(`🧹 Cleaning up history older than ${days} days...`);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    try {
        // 1. Identify records to delete
        const oldRecords = await prisma.priceHistory.findMany({
            where: { createdAt: { lt: cutoffDate } },
            select: { id: true, screenshot: true }
        });

        if (oldRecords.length === 0) return;

        // 2. Identify screenshots currently used by NEWER records (that we want to KEEP)
        const activeScreenshots = await prisma.priceHistory.findMany({
            where: {
                createdAt: { gte: cutoffDate },
                screenshot: { not: null }
            },
            select: { screenshot: true }
        });
        const activeSet = new Set(activeScreenshots.map(r => r.screenshot));

        // 3. Delete files that are ONLY in old records
        for (const record of oldRecords) {
            if (record.screenshot && !activeSet.has(record.screenshot)) {
                const filePath = path.join(process.cwd(), 'public', record.screenshot);
                if (fs.existsSync(filePath)) {
                    try {
                        fs.unlinkSync(filePath);
                    } catch (e) {
                        console.error(`Failed to delete file: ${filePath}`, e);
                    }
                }
            }
        }

        // 4. Delete records from DB
        const { count } = await prisma.priceHistory.deleteMany({
            where: { createdAt: { lt: cutoffDate } }
        });

        console.log(`✅ Deleted ${count} old history records.`);
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

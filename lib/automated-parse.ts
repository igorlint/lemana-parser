import { prisma } from './prisma';
import { fetchPrice } from './parser';
import { generateViolationsExcel } from './excel-server';
import { sendTelegramFile, sendTelegramMessage } from './telegram';
import fs from 'fs';
import path from 'path';
import { cleanupOldData } from './cleanup';

export async function runScheduledParse(targetRegions?: string[]) {
    const settings = await prisma.globalSettings.findFirst();
    if (!settings || !settings.enabled || !settings.tgBotToken || !settings.tgChatId) {
        console.log('⏭️ Scheduled parse skipped: Settings incomplete or disabled.');
        return;
    }

    console.log('🤖 Starting scheduled parse...');

    // 1. Check/Set Lock
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const activeJob = await prisma.parsingJob.findFirst({
        where: { status: 'RUNNING', startTime: { gte: oneHourAgo } }
    });

    if (activeJob) {
        console.log('⏳ Another job is running. Skipping scheduled parse.');
        return;
    }

    const job = await prisma.parsingJob.create({
        data: { userId: 1, status: 'RUNNING' } // Fixed to user 1 for automated tasks
    });

    try {
        // 2. Fetch all products from Excel source
        const { getProductsFromExcel } = require('./excel-utils');
        const productsRes = getProductsFromExcel();

        console.log(`📦 Loaded ${productsRes.length} products from Excel matrix.`);

        // We need the names too, but we can get them from products API or just use SKU
        // Actually, let's just get whatever we have in the database for now.
        // Or better, read regions.md
        const { getRegions } = require('./region-utils');
        const allRegions = getRegions();

        if (productsRes.length === 0) {
            console.log('❌ No products found to parse.');
            await prisma.parsingJob.update({ where: { id: job.id }, data: { status: 'COMPLETED' } });
            return;
        }

        const tasks: any[] = [];
        for (const p of productsRes) {
            for (const r of allRegions) {
                // If targetRegions is provided, skip regions not in the list
                if (targetRegions && targetRegions.length > 0) {
                    const isTarget = targetRegions.includes(r.subdomain) || (r.subdomain === '' && targetRegions.includes('moscow'));
                    if (!isTarget) continue;
                }

                tasks.push({
                    sku: p.sku,
                    subdomain: r.subdomain,
                    url: p.url,
                    referencePrice: p.referencePrice || 0
                });
            }
        }

        console.log(`🚀 Automated parse: processing ${tasks.length} tasks...`);
        const BATCH_SIZE = 5;
        const results = [];
        const timestamp = new Date();

        for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
            const batch = tasks.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(
                batch.map(task => fetchPrice(task.sku, task.subdomain, task.url, false, task.referencePrice))
            );

            for (const res of batchResults) {
                const task = tasks.find(t =>
                    t.sku === res.sku &&
                    (t.subdomain === res.region || (t.subdomain === '' && res.region === 'moscow'))
                );

                const enrichedResult = {
                    ...res,
                    createdAt: timestamp,
                    referencePrice: task?.referencePrice || 0
                };

                if (res.status === 'success') {
                    await prisma.priceHistory.create({
                        data: {
                            userId: 1,
                            sku: res.sku,
                            region: res.region,
                            price: res.price,
                            referencePrice: task?.referencePrice || 0,
                            url: task?.url || '',
                            screenshot: res.screenshot,
                            createdAt: timestamp
                        }
                    });
                }
                results.push(enrichedResult);
            }
        }

        // 3. Find violations
        const violations = results.filter(res => {
            if (res.status !== 'success') return false;
            const task = tasks.find(t =>
                t.sku === res.sku &&
                (t.subdomain === res.region || (t.subdomain === '' && res.region === 'moscow'))
            );
            if (!task?.referencePrice) return false;
            const numericPrice = parseInt(String(res.price).replace(/[^0-9]/g, ''), 10);
            return numericPrice < task.referencePrice;
        });

        console.log(`✅ Finished. Found ${violations.length} violations.`);

        if (violations.length > 0) {
            // 4. Generate Excel
            const excelPath = await generateViolationsExcel(violations);

            // 5. Send to Telegram
            await sendTelegramFile(
                settings.tgBotToken,
                settings.tgChatId,
                excelPath,
                `🔔 <b>Отчет о нарушениях РИЦ</b>\nНайдено нарушений: ${violations.length}\nДата: ${timestamp.toLocaleString('ru-RU')}`
            );

            // Cleanup
            fs.unlinkSync(excelPath);
        } else {
            await sendTelegramMessage(
                settings.tgBotToken,
                settings.tgChatId,
                `✅ <b>Парсинг завершен</b>\nНарушений не обнаружено.\nДата: ${timestamp.toLocaleString('ru-RU')}`
            );
        }

        await prisma.parsingJob.update({ where: { id: job.id }, data: { status: 'COMPLETED' } });

        // 6. Cleanup old data
        await cleanupOldData(settings.historyRetentionDays);

    } catch (error: any) {
        console.error('❌ Scheduled parse failed:', error);
        await prisma.parsingJob.update({ where: { id: job.id }, data: { status: 'FAILED' } });

        if (settings.tgBotToken && settings.tgChatId) {
            await sendTelegramMessage(settings.tgBotToken, settings.tgChatId, `❌ <b>Ошибка парсинга по расписанию</b>\n${error.message}`);
        }
    }
}

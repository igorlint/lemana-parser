import { NextResponse } from 'next/server';
import { fetchPrice } from '@/lib/parser';
import { getSessionFromCookie, verifySession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cleanupOldData } from '@/lib/cleanup';

export const maxDuration = 300;

export async function POST(request: Request) {
    let jobId: number | null = null;
    try {
        const token = getSessionFromCookie(request);
        const session = token ? await verifySession(token) : null;
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // --- CHECK LOCK ---
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const activeJob = await prisma.parsingJob.findFirst({
            where: {
                status: 'RUNNING',
                startTime: { gte: oneHourAgo }
            },
            include: { user: true }
        });

        if (activeJob) {
            return NextResponse.json({
                error: `Парсинг уже запущен пользователем ${activeJob.user?.name || activeJob.user?.email}. Пожалуйста, подождите.`
            }, { status: 429 });
        }

        // --- CREATE JOB ---
        const job = await prisma.parsingJob.create({
            data: {
                userId: Number(session.id),
                status: 'RUNNING'
            }
        });
        jobId = job.id;

        const body = await request.json();
        const { products, regions, useProxy } = body;

        const settings = await prisma.globalSettings.findFirst();
        const retentionDays = settings?.historyRetentionDays || 3;

        // Cleanup old data
        await cleanupOldData(retentionDays);

        if (!products || !regions || !Array.isArray(products) || !Array.isArray(regions)) {
            throw new Error('Invalid request body. Need products and regions arrays.');
        }

        // Log Start
        await prisma.log.create({
            data: {
                userId: Number(session.id),
                action: 'PARSE_START',
                details: `Started parsing ${products.length} products in ${regions.length} regions.`
            }
        });

        const allTasks: { sku: string, subdomain: string, url: string, referencePrice: number }[] = [];
        for (const product of products) {
            for (const region of regions) {
                allTasks.push({
                    sku: product.sku,
                    subdomain: region.subdomain,
                    url: product.url,
                    referencePrice: product.referencePrice || 0
                });
            }
        }

        const BATCH_SIZE = 10;
        const results = [];

        for (let i = 0; i < allTasks.length; i += BATCH_SIZE) {
            const batch = allTasks.slice(i, i + BATCH_SIZE);
            console.log(`🚀 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(allTasks.length / BATCH_SIZE)} (${batch.length} items)`);

            const batchResults = await Promise.all(
                batch.map(task => fetchPrice(task.sku, task.subdomain, task.url, useProxy, task.referencePrice))
            );

            results.push(...batchResults);
        }

        // Log Completion
        const successCount = results.filter(r => r.status === 'success').length;

        // Save price history
        const timestamp = new Date();
        for (const res of results) {
            if (res.status === 'success') {
                const task = allTasks.find(t =>
                    t.sku === res.sku &&
                    (t.subdomain === res.region || (t.subdomain === '' && res.region === 'moscow'))
                );

                await prisma.priceHistory.create({
                    data: {
                        userId: Number(session.id),
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
        }

        await prisma.log.create({
            data: {
                userId: Number(session.id),
                action: 'PARSE_COMPLETE',
                details: `Finished. Success: ${successCount}, Errors: ${results.length - successCount}. Saved to history.`
            }
        });

        // Update Job status
        await prisma.parsingJob.update({
            where: { id: jobId },
            data: { status: 'COMPLETED' }
        });

        return NextResponse.json(results);
    } catch (error: any) {
        if (jobId) {
            await prisma.parsingJob.update({
                where: { id: jobId },
                data: { status: 'FAILED' }
            });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}


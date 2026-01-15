import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession, getSessionFromCookie } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        const token = getSessionFromCookie(request);
        const session = token ? await verifySession(token) : null;
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let settings = await prisma.globalSettings.findFirst();
        if (!settings) {
            settings = await prisma.globalSettings.create({
                data: {
                    id: 1,
                    enabled: false,
                    scheduleDays: JSON.stringify([]),
                    scheduleHours: JSON.stringify([])
                }
            });
        }

        return NextResponse.json(settings);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const token = getSessionFromCookie(request);
        const session = token ? await verifySession(token) : null;
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { tgBotToken, tgChatId, scheduleDays, scheduleHours, enabled, historyRetentionDays } = body;

        const settings = await prisma.globalSettings.upsert({
            where: { id: 1 },
            update: {
                tgBotToken,
                tgChatId,
                scheduleDays: Array.isArray(scheduleDays) ? JSON.stringify(scheduleDays) : scheduleDays,
                scheduleHours: Array.isArray(scheduleHours) ? JSON.stringify(scheduleHours) : scheduleHours,
                enabled: !!enabled,
                historyRetentionDays: parseInt(String(historyRetentionDays)) || 3
            },
            create: {
                id: 1,
                tgBotToken,
                tgChatId,
                scheduleDays: JSON.stringify(scheduleDays || []),
                scheduleHours: JSON.stringify(scheduleHours || []),
                enabled: !!enabled,
                historyRetentionDays: parseInt(String(historyRetentionDays)) || 3
            }
        });

        const { updateScheduler } = await import('@/lib/scheduler');
        await updateScheduler();

        return NextResponse.json(settings);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

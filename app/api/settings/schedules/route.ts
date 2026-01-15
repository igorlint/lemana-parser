import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromCookie, verifySession } from '@/lib/auth';
import { updateScheduler } from '@/lib/scheduler';

export async function GET(request: Request) {
    try {
        const token = getSessionFromCookie(request);
        const session = token ? await verifySession(token) : null;
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const schedules = await prisma.parsingSchedule.findMany({
            orderBy: { time: 'asc' }
        });
        return NextResponse.json(schedules);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const token = getSessionFromCookie(request);
        const session = token ? await verifySession(token) : null;
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { id, time, days, regions, enabled } = body;

        let schedule;
        if (id) {
            schedule = await prisma.parsingSchedule.update({
                where: { id },
                data: {
                    time,
                    days: JSON.stringify(days),
                    regions: JSON.stringify(regions),
                    enabled
                }
            });
        } else {
            schedule = await prisma.parsingSchedule.create({
                data: {
                    time,
                    days: JSON.stringify(days),
                    regions: JSON.stringify(regions),
                    enabled: enabled ?? true
                }
            });
        }

        // Refresh the scheduler
        await updateScheduler();

        return NextResponse.json(schedule);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

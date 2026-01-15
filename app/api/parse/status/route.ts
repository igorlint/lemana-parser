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

        // Find any running job (Global Lock)
        // We consider jobs running for more than 1 hour as "stuck"
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const activeJob = await prisma.parsingJob.findFirst({
            where: {
                status: 'RUNNING',
                startTime: { gte: oneHourAgo }
            },
            include: {
                user: {
                    select: { name: true, email: true }
                }
            }
        });

        if (!activeJob) {
            return NextResponse.json({ running: false });
        }

        return NextResponse.json({
            running: true,
            jobId: activeJob.id,
            startTime: activeJob.startTime,
            userName: activeJob.user?.name || activeJob.user?.email
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

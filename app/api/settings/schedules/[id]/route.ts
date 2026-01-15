import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromCookie, verifySession } from '@/lib/auth';
import { updateScheduler } from '@/lib/scheduler';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const token = getSessionFromCookie(request);
        const session = token ? await verifySession(token) : null;
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = await params;

        await prisma.parsingSchedule.delete({
            where: { id: parseInt(id) }
        });

        // Refresh the scheduler
        await updateScheduler();

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

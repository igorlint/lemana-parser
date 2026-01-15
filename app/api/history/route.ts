import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromCookie, verifySession } from '@/lib/auth';

export async function GET(request: Request) {
    const token = getSessionFromCookie(request);
    const session = token ? await verifySession(token) : null;

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const history = await prisma.priceHistory.findMany({
        where: {
            userId: Number(session.id),
        },
        orderBy: {
            createdAt: 'desc',
        },
        take: 200, // Show last 200 violations
    });

    // Filter for violations in JS: price numeric value < referencePrice
    const violations = history.filter((item: any) => {
        if (!item.referencePrice) return false;
        const numericPrice = parseInt(String(item.price).replace(/[^0-9]/g, ''), 10);
        if (isNaN(numericPrice)) return false;
        return numericPrice < item.referencePrice;
    });

    return NextResponse.json(violations);
}

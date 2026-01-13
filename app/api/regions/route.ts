import { NextResponse } from 'next/server';
import { getRegions } from '@/lib/region-utils';

export async function GET() {
    try {
        const regions = getRegions();
        return NextResponse.json(regions);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

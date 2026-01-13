import { NextResponse } from 'next/server';
import { fetchPrice } from '@/lib/parser';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { skus, regions } = body;

        if (!skus || !regions || !Array.isArray(skus) || !Array.isArray(regions)) {
            return NextResponse.json({ error: 'Invalid request body. Need skus and regions arrays.' }, { status: 400 });
        }

        const results = [];

        // We parse items sequentially or with limited concurrency to avoid blocking
        // For simplicity here, we'll do them sequentially for now, or use Promise.all for small batches
        for (const sku of skus) {
            for (const region of regions) {
                const result = await fetchPrice(sku, region.subdomain);
                results.push(result);

                // Add a small delay between requests to be nice to the server
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        return NextResponse.json(results);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

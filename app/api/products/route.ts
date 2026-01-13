import { NextResponse } from 'next/server';
import { getProductsFromExcel } from '@/lib/excel-utils';

export async function GET() {
    try {
        const products = getProductsFromExcel();
        return NextResponse.json(products);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

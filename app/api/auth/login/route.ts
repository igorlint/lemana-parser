import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signSession } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return NextResponse.json(
                { error: 'Неверные учетные данные' },
                { status: 401 }
            );
        }

        const session = await signSession({ id: user.id, email: user.email, name: user.name });

        const response = NextResponse.json({ success: true });
        response.cookies.set('session_token', session, {
            httpOnly: true,
            secure: false, // Changed to false to allow HTTP access on IP address
            sameSite: 'strict',
            maxAge: 60 * 60 * 24, // 1 day
            path: '/',
        });

        return response;
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

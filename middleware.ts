import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth';

export async function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    // Public paths
    if (path.startsWith('/api/auth') || path === '/login' || path === '/register' || path.startsWith('/_next') || path.startsWith('/screenshots') || path.startsWith('/static') || path.includes('.')) {
        return NextResponse.next();
    }

    const token = request.cookies.get('session_token')?.value;
    const session = token ? await verifySession(token) : null;

    if (!session) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Pass user ID as header for API routes to use easily? 
    // Getting headers in API routes is easier if we just parse the cookie again since headers are read-only in some contexts?
    // But we can set a request header.
    const response = NextResponse.next();
    response.headers.set('x-user-id', String(session.id));
    return response;
}

export const config = {
    matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|screenshots).*)'],
};

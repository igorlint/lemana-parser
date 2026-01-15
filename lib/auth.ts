import { SignJWT, jwtVerify } from 'jose';

const secretKey = process.env.JWT_SECRET || 'secret';
const key = new TextEncoder().encode(secretKey);

export async function signSession(payload: any) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(key);
}

export async function verifySession(token: string) {
    try {
        const { payload } = await jwtVerify(token, key, {
            algorithms: ['HS256'],
        });
        return payload;
    } catch (error) {
        return null;
    }
}

export function getSessionFromCookie(request: Request) {
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return null;
    const cookies = Object.fromEntries(cookieHeader.split('; ').map(c => c.split('=')));
    return cookies['session_token'];
}
